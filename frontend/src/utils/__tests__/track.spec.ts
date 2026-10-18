import { describe, expect, it } from "vitest";
import {
  TRACK_PHASES,
  coverflowState,
  focusIndexAt,
  scatterLayout,
  trackFrame,
  travelAt,
} from "../track";
import type { TrackMetrics } from "../track";

const metrics: TrackMetrics = {
  width: 1440,
  height: 900,
  pitch: 600,
  cardWidth: 480,
  cardHeight: 317,
  focusX: 1440 * 0.38,
};
const focusLine = metrics.focusX - metrics.width / 2;

describe("scatterLayout", () => {
  it("固定种子：两次调用结果完全一致", () => {
    expect(scatterLayout(4)).toEqual(scatterLayout(4));
  });

  it("归一化偏移都在 ±1 以内，卡片不可能出界", () => {
    for (const total of [1, 2, 3, 4, 5, 6]) {
      for (const spot of scatterLayout(total)) {
        expect(Math.abs(spot.nx)).toBeLessThanOrEqual(1);
        expect(Math.abs(spot.ny)).toBeLessThanOrEqual(1);
        expect(Math.abs(spot.rotation)).toBeLessThanOrEqual(7);
        expect(spot.scale).toBeGreaterThan(0.6);
        expect(spot.scale).toBeLessThan(0.75);
      }
    }
  });

  it("同一数量的卡片彼此散得开（两两距离 > 0.5）", () => {
    for (const total of [2, 3, 4, 5, 6]) {
      const spots = scatterLayout(total);
      for (let i = 0; i < spots.length; i += 1) {
        for (let j = i + 1; j < spots.length; j += 1) {
          const dx = spots[i].nx - spots[j].nx;
          const dy = spots[i].ny - spots[j].ny;
          expect(Math.hypot(dx, dy)).toBeGreaterThan(0.5);
        }
      }
    }
  });
});

describe("coverflowState", () => {
  it("聚焦线（距离 0）就是基准态", () => {
    expect(coverflowState(0, 600)).toEqual({
      rotateY: 0,
      z: 0,
      scale: 1,
      opacity: 1,
      glow: 1,
    });
  });

  it("左右对称：倾斜方向相反，其余数值一致", () => {
    const right = coverflowState(600, 600);
    const left = coverflowState(-600, 600);
    expect(right.rotateY).toBe(-left.rotateY);
    expect(right.z).toBe(left.z);
    expect(right.scale).toBe(left.scale);
    expect(right.opacity).toBe(left.opacity);
    expect(right.glow).toBe(left.glow);
  });

  it("越远越暗、越小、越靠后", () => {
    const near = coverflowState(600, 600);
    const far = coverflowState(1200, 600);
    expect(far.opacity).toBeLessThan(near.opacity);
    expect(far.scale).toBeLessThan(near.scale);
    expect(far.z).toBeLessThan(near.z);
    expect(near.z).toBeLessThan(0);
  });

  it("倾斜方向朝向中心，且角度与后退距离有上限", () => {
    expect(coverflowState(300, 600).rotateY).toBeLessThan(0);
    expect(coverflowState(-300, 600).rotateY).toBeGreaterThan(0);
    expect(Math.abs(coverflowState(9999, 600).rotateY)).toBeLessThanOrEqual(16 * 1.4);
    expect(coverflowState(9999, 600).z).toBeGreaterThanOrEqual(-180);
    expect(coverflowState(9999, 600).opacity).toBeGreaterThanOrEqual(0.18);
  });

  it("发光只在聚焦线附近可见", () => {
    expect(coverflowState(0, 600).glow).toBe(1);
    expect(coverflowState(150, 600).glow).toBeGreaterThan(0);
    expect(coverflowState(600, 600).glow).toBe(0);
  });
});

describe("trackFrame", () => {
  it("进度 0：四张卡叠在中心，小尺寸、接近不透明", () => {
    for (let index = 0; index < 4; index += 1) {
      const frame = trackFrame(0, index, 4, metrics);
      expect(frame.x).toBeCloseTo(0, 6);
      expect(frame.y).toBeCloseTo(0, 6);
      expect(frame.scale).toBeCloseTo(0.5, 6);
      expect(frame.opacity).toBeCloseTo(0.85, 6);
      expect(frame.rotateY).toBe(0);
      expect(frame.glow).toBe(0);
    }
  });

  it("散落阶段结束：落在各自的伪随机位置且不出界", () => {
    const spots = scatterLayout(4);
    const limitX = metrics.width / 2 - metrics.cardWidth / 2;
    for (let index = 0; index < 4; index += 1) {
      const frame = trackFrame(TRACK_PHASES.explodeEnd, index, 4, metrics);
      expect(Math.abs(frame.x)).toBeLessThanOrEqual(limitX);
      expect(frame.y).toBeLessThan(metrics.height / 2);
      // 散落相位还没有景深
      expect(frame.rotateY).toBe(0);
      expect(frame.glow).toBe(0);
      // 与伪随机布局同向
      expect(Math.sign(frame.x)).toBe(Math.sign(spots[index].nx));
    }
  });

  it("收束结束：回到水平轨道，等距排布", () => {
    for (let index = 0; index < 4; index += 1) {
      const frame = trackFrame(TRACK_PHASES.collapseEnd, index, 4, metrics);
      expect(frame.x).toBeCloseTo(focusLine + index * metrics.pitch, 6);
      expect(frame.y).toBeCloseTo(0, 6);
      expect(frame.rotate).toBeCloseTo(0, 6);
      expect(frame.rotateY).toBe(0);
      expect(frame.scale).toBeCloseTo(1, 6);
      expect(frame.opacity).toBeCloseTo(1, 6);
    }
  });

  it("进度 1：最后一张正好停在聚焦线，最远的一张退到暗部", () => {
    const last = trackFrame(1, 3, 4, metrics);
    expect(last.x).toBeCloseTo(focusLine, 6);
    expect(last.scale).toBeCloseTo(1, 6);
    expect(last.opacity).toBeCloseTo(1, 6);
    expect(last.glow).toBeCloseTo(1, 6);

    const first = trackFrame(1, 0, 4, metrics);
    expect(first.x).toBeCloseTo(focusLine - 3 * metrics.pitch, 6);
    expect(first.opacity).toBeLessThan(0.3);
    expect(first.scale).toBeLessThan(0.95);
    expect(first.glow).toBe(0);
  });

  it("单卡时永远停在聚焦线", () => {
    const frame = trackFrame(1, 0, 1, metrics);
    expect(frame.x).toBeCloseTo(focusLine, 6);
    expect(frame.glow).toBeCloseTo(1, 6);
  });
});

describe("travelAt / focusIndexAt", () => {
  it("收束之前不横移，之后线性推进到 total-1", () => {
    expect(travelAt(0, 4)).toBe(0);
    expect(travelAt(TRACK_PHASES.collapseEnd, 4)).toBe(0);
    expect(travelAt(1, 4)).toBeCloseTo(3, 6);
    expect(travelAt(0.725, 4)).toBeCloseTo(1.5, 6);
  });

  it("聚焦索引从 0 走到 total-1 且不越界", () => {
    expect(focusIndexAt(0, 4)).toBe(0);
    expect(focusIndexAt(TRACK_PHASES.collapseEnd, 4)).toBe(0);
    expect(focusIndexAt(1, 4)).toBe(3);
    expect(focusIndexAt(1.4, 4)).toBe(3);
    expect(focusIndexAt(-0.5, 4)).toBe(0);
    expect(focusIndexAt(0.5, 1)).toBe(0);
  });

  it("索引随进度单调不减", () => {
    let previous = -1;
    for (let step = 0; step <= 100; step += 1) {
      const index = focusIndexAt(step / 100, 4);
      expect(index).toBeGreaterThanOrEqual(previous);
      previous = index;
    }
  });
});
