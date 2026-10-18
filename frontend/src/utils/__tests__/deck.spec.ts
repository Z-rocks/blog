import { describe, expect, it } from "vitest";
import {
  DECK_MIN_OPACITY,
  DECK_OPACITY_STEP,
  DECK_SCALE_STEP,
  deckState,
} from "../deck";

describe("deckState", () => {
  it("最后一张卡保持基准状态：不缩放、不完全透明", () => {
    expect(deckState(3, 4)).toEqual({ scale: 1, opacity: 1 });
  });

  it("越靠前的卡被压得越深：scale 与 opacity 都单调递减", () => {
    const states = [0, 1, 2, 3].map((index) => deckState(index, 4));
    for (let i = 1; i < states.length; i += 1) {
      expect(states[i].scale).toBeGreaterThan(states[i - 1].scale);
      expect(states[i].opacity).toBeGreaterThan(states[i - 1].opacity);
    }
  });

  it("缩放比例与步长参数一致，且不超过 1", () => {
    const total = 4;
    [0, 1, 2, 3].forEach((index) => {
      const { scale } = deckState(index, total);
      expect(scale).toBeLessThanOrEqual(1);
      expect(scale).toBeCloseTo(1 - (total - 1 - index) * DECK_SCALE_STEP, 6);
    });
  });

  it("透明度有下限，不会把卡片压到看不见", () => {
    const { opacity } = deckState(0, 4);
    expect(opacity).toBeGreaterThanOrEqual(DECK_MIN_OPACITY);
    expect(opacity).toBeCloseTo(1 - 3 * DECK_OPACITY_STEP, 6);
  });

  it("只有一张卡时就是基准状态", () => {
    expect(deckState(0, 1)).toEqual({ scale: 1, opacity: 1 });
  });

  it("下标越界不会产生负数或 NaN", () => {
    const negative = deckState(-5, 2);
    const overflow = deckState(99, 2);
    expect(Number.isFinite(negative.scale)).toBe(true);
    expect(negative.scale).toBeGreaterThanOrEqual(0);
    expect(overflow).toEqual({ scale: 1, opacity: 1 });
  });
});
