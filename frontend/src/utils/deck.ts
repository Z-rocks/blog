/**
 * 卡片堆叠的状态参数：GSAP 与单测共用这一份，避免"文档一套数字、代码另一套"。
 * index 为卡片在列表中的下标，total 为总张数；depth 越大表示这张卡被压得越深。
 */
export const DECK_SCALE_STEP = 0.035;
export const DECK_OPACITY_STEP = 0.15;
export const DECK_MIN_OPACITY = 0.45;

export interface DeckState {
  scale: number;
  opacity: number;
}

export function deckState(index: number, total: number): DeckState {
  const depth = Math.max(0, total - 1 - index);
  return {
    scale: Math.max(0, 1 - depth * DECK_SCALE_STEP),
    opacity: Math.max(DECK_MIN_OPACITY, 1 - depth * DECK_OPACITY_STEP),
  };
}
