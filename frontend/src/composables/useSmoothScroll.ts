import Lenis from "lenis";

/**
 * 全站只保留一个 Lenis 实例，挂在 App 层。
 * 页面只注册/注销自己的回调，不持有实例，避免"谁负责销毁"的歧义。
 */
let lenis: Lenis | null = null;
let frame = 0;
const scrollListeners = new Set<() => void>();

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 只在桌面端启用平滑滚动：
 * - 触屏指针保留原生惯性（Lenis 的阻尼在触控板上会与惯性叠加，手感变糊）；
 * - 系统开启"减少动态效果"时完全回到原生滚动。
 */
export function shouldEnableSmoothScroll(): boolean {
  if (typeof window === "undefined") return false;
  if (prefersReducedMotion()) return false;
  if (window.matchMedia("(pointer: coarse)").matches) return false;
  return true;
}

export function getLenis(): Lenis | null {
  return lenis;
}

/** 订阅 Lenis 的滚动帧，用于同步 ScrollTrigger，而不必把 gsap 拉进入口 chunk。 */
export function onSmoothScroll(listener: () => void): () => void {
  scrollListeners.add(listener);
  return (): void => {
    scrollListeners.delete(listener);
  };
}

function tick(time: number): void {
  lenis?.raf(time);
  frame = window.requestAnimationFrame(tick);
}

export function initSmoothScroll(): void {
  if (lenis || !shouldEnableSmoothScroll()) return;
  lenis = new Lenis({ duration: 1.05, smoothWheel: true, syncTouch: false });
  lenis.on("scroll", (): void => {
    scrollListeners.forEach((listener): void => listener());
  });
  frame = window.requestAnimationFrame(tick);
}

export function destroySmoothScroll(): void {
  if (frame) window.cancelAnimationFrame(frame);
  frame = 0;
  scrollListeners.clear();
  lenis?.destroy();
  lenis = null;
}

/**
 * 滚动到某个元素；没有目标时返回 false。
 *
 * 锚点走浏览器原生平滑滚动而不是 lenis.scrollTo：
 * 路由切换时目标元素可能刚挂载，Lenis 内部的尺寸缓存还没刷新，programmatic
 * scrollTo 会静默失败（表现为"点了没反应"）。原生滚动不依赖任何缓存，
 * 而且 Lenis 会从 scroll 事件里把内部位置同步回去，不会出现"跳过去又弹回来"。
 * 滚轮阻尼仍然由 Lenis 负责。
 */
export function scrollToSelector(
  selector: string,
  options: { offset?: number } = {},
): boolean {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return false;
  const offset = options.offset ?? 0;
  const top = Math.max(
    0,
    element.getBoundingClientRect().top + window.scrollY + offset,
  );
  window.scrollTo({
    top,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
  return true;
}
