/**
 * 主页项目轨道的全部几何计算。
 *
 * 三个阶段共用一条进度 p（0 → 1，由 ScrollTrigger 的 pin 区间给出）：
 *   0 → explodeEnd              爆炸散落：从中心叠在一起，散到四周
 *   explodeEnd → collapseEnd    收束：回到水平轨道
 *   collapseEnd → 1             横移聚焦：卡片依次经过聚焦线
 *
 * 页面只负责把 CardFrame 写进 style；所有数值都是 p 的纯函数，
 * 不读 DOM，因此可以脱离浏览器测试，也不会在滚动时反复触发排版。
 */

export interface ScatterSpot {
  /** 归一化偏移，±1 表示可用区域的边界，天然保证卡片不出界。 */
  nx: number;
  ny: number;
  /** 2D 旋转（度）。 */
  rotation: number;
  scale: number;
}

export interface TrackMetrics {
  width: number;
  height: number;
  /** 相邻两张卡的间距（卡片宽度 + 间隙）。 */
  pitch: number;
  cardWidth: number;
  cardHeight: number;
  /** 聚焦线的水平位置（默认视口宽度的 38%）。 */
  focusX: number;
}

export interface CoverflowState {
  rotateY: number;
  z: number;
  scale: number;
  opacity: number;
  /** 0 → 1，越高越靠近聚焦线。 */
  glow: number;
}

export interface CardFrame {
  x: number;
  y: number;
  z: number;
  rotateY: number;
  /** 2D 旋转（度）。 */
  rotate: number;
  scale: number;
  opacity: number;
  glow: number;
}

export const TRACK_PHASES = { explodeEnd: 0.18, collapseEnd: 0.45 } as const;

/** 进入横移阶段后，用这一段进度把景深效果混进来，避免散落阶段就带 3D 倾斜。 */
const DEPTH_BLEND = 0.08;

/** 散落起点：卡片还叠在中心时的缩放。 */
const STACK_SCALE = 0.5;
/** 散落时的缩放区间：比轨道卡小，四张才散得开、不互相压死。 */
const SCATTER_SCALE_MIN = 0.62;
const SCATTER_SCALE_RANGE = 0.08;
/** 计算散落可用区域时按这个缩放估算卡片占位，保证环上的卡不越界、也不重叠。 */
const SCATTER_FOOTPRINT = 0.66;
/** 景深参数：卡片间距为 1 时的倾斜角、后退距离与缩小比例。 */
const TILT_DEG = 16;
const DEPTH_PX = 90;
const DEPTH_SCALE = 0.1;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeInCubic(t: number): number {
  return t ** 3;
}

/** 把 -0 归一成 0：写进 style 没差别，但能让断言用严格相等。 */
function norm(value: number): number {
  return value === 0 ? 0 : value;
}

/** 固定种子：每次加载的散落位置一致，不靠 Math.random。 */
function mulberry32(seed: number): () => number {
  let state = seed;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 伪随机的散落布局：卡片沿椭圆环分布，再叠加固定种子的小幅抖动。
 * 归一化坐标都落在 ±1 以内，渲染时乘以"可用区域半径"，卡片不可能越界。
 */
export function scatterLayout(total: number): ScatterSpot[] {
  const random = mulberry32(0x5eed1e);
  const count = Math.max(1, Math.floor(total));
  const spots: ScatterSpot[] = [];
  for (let index = 0; index < count; index += 1) {
    // 从正右方开始均匀分布，叠加 ±0.25rad 抖动，避免一眼看出是规则环。
    const angle = (index / count) * Math.PI * 2 + (random() - 0.5) * 0.5;
    const radiusX = 0.72 + random() * 0.18;
    const radiusY = 0.52 + random() * 0.16;
    spots.push({
      nx: norm(Math.cos(angle) * radiusX),
      ny: norm(Math.sin(angle) * radiusY),
      rotation: norm((random() - 0.5) * 14),
      scale: SCATTER_SCALE_MIN + random() * SCATTER_SCALE_RANGE,
    });
  }
  return spots;
}

/** 距离聚焦线越远：转得越多、退得越深、越暗、发光越弱。 */
export function coverflowState(distance: number, pitch: number): CoverflowState {
  const ratio = Math.abs(distance) / Math.max(1, pitch);
  const depth = Math.min(ratio, 2);
  // 距离为 0 时显式取 0，避免 -0 这类"看起来相等但 Object.is 不等"的值。
  const direction = distance === 0 ? 0 : Math.sign(distance);
  return {
    rotateY: norm(-direction * Math.min(ratio, 1.4) * TILT_DEG),
    z: norm(-depth * DEPTH_PX),
    scale: norm(1 - Math.min(ratio, 1.2) * DEPTH_SCALE),
    opacity: norm(Math.max(0.18, 1 - depth * 0.42)),
    glow: norm(Math.max(0, 1 - ratio * 1.8)),
  };
}

/** 某一进度下的横移量（以"第几张卡在聚焦线"计，0 → total-1）。 */
export function travelAt(progress: number, total: number): number {
  const p = clamp01(progress);
  if (p <= TRACK_PHASES.collapseEnd) return 0;
  const span = 1 - TRACK_PHASES.collapseEnd;
  return ((p - TRACK_PHASES.collapseEnd) / span) * Math.max(0, total - 1);
}

export function focusIndexAt(progress: number, total: number): number {
  const last = Math.max(0, Math.floor(total) - 1);
  return Math.min(last, Math.max(0, Math.round(travelAt(progress, total))));
}

/**
 * 单张卡在进度 p 下的帧。
 * 位置以舞台中心为原点；渲染时卡片自身是 left:50%; top:50%，
 * 再由 transform 里的 -50% 居中。
 */
export function trackFrame(
  progress: number,
  index: number,
  total: number,
  metrics: TrackMetrics,
): CardFrame {
  const p = clamp01(progress);
  const count = Math.max(1, Math.floor(total));
  const spots = scatterLayout(count);
  const spot = spots[Math.min(index, spots.length - 1)];

  // 散落阶段按缩小后的占位算可用区域，环形布局才不会互相压住。
  const areaX = Math.max(
    1,
    metrics.width / 2 - (metrics.cardWidth * SCATTER_FOOTPRINT) / 2 - 20,
  );
  const areaY = Math.max(
    1,
    metrics.height / 2 - (metrics.cardHeight * SCATTER_FOOTPRINT) / 2 - 20,
  );

  const explode = easeOutCubic(clamp01(p / TRACK_PHASES.explodeEnd));
  const collapse = easeInOutCubic(
    clamp01(
      (p - TRACK_PHASES.explodeEnd) /
        (TRACK_PHASES.collapseEnd - TRACK_PHASES.explodeEnd),
    ),
  );

  const travel = travelAt(p, count);
  const focusLine = metrics.focusX - metrics.width / 2;
  const slotX = focusLine + (index - travel) * metrics.pitch;

  const scatterX = spot.nx * areaX;
  const scatterY = spot.ny * areaY;

  const x = lerp(lerp(0, scatterX, explode), slotX, collapse);
  // 纵向回落比横向归位晚：卡片先在自己的高度上排成一列，最后再一起落进轨道，
  // 避免中间帧四张卡挤在同一个高度互相压住。
  const y = lerp(0, scatterY, explode) * (1 - easeInCubic(collapse));
  const rotate = lerp(lerp(0, spot.rotation, explode), 0, collapse);
  const baseScale = lerp(lerp(STACK_SCALE, spot.scale, explode), 1, collapse);
  // 散落阶段卡片保持接近不透明：叠在一起时才像一叠纸，而不是一坨灰。
  const baseOpacity = lerp(0.85, 1, explode);

  // 景深（倾斜/后退/缩小）只在进入横移阶段后才混入，收束完成时是完整平铺的一排。
  const depthWeight = clamp01((p - TRACK_PHASES.collapseEnd) / DEPTH_BLEND);
  // 高光比景深早一点点出现：收束结束的瞬间，聚焦线上的那张就该亮起来。
  const glowWeight = clamp01(
    (p - (TRACK_PHASES.collapseEnd - 0.06)) / 0.06,
  );
  const depth = coverflowState(x - focusLine, metrics.pitch);

  return {
    x: norm(x),
    y: norm(y),
    z: norm(depth.z * depthWeight),
    rotateY: norm(depth.rotateY * depthWeight),
    rotate: norm(rotate),
    scale: norm(baseScale * lerp(1, depth.scale, depthWeight)),
    opacity: norm(baseOpacity * lerp(1, depth.opacity, depthWeight)),
    glow: norm(depth.glow * glowWeight),
  };
}
