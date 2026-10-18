import { onBeforeUnmount, onMounted, ref } from "vue";
import type { Ref } from "vue";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * 把「滚动进度 → 第几步」收敛成一个离散状态机：
 * 只在跨过 0.34 / 0.67 阈值时切换，快速滚动直接落到最终态，
 * 不会出现插件方块卡在屏幕边缘的半截画面。
 *
 * 只接收元素引用，不接管模板 ref，组件侧用 useTemplateRef 传进来即可。
 */
export function useStepProgress(
  track: { readonly value: HTMLElement | null },
  lastStep = 2,
): Ref<number> {
  const step = ref(0);
  let trigger: ScrollTrigger | null = null;
  let media: ReturnType<typeof gsap.matchMedia> | null = null;

  onMounted((): void => {
    const element = track.value;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      step.value = lastStep;
      return;
    }
    media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", (): void => {
      trigger = ScrollTrigger.create({
        trigger: element,
        start: "top 65%",
        end: "bottom 45%",
        onUpdate: (self): void => {
          const next = self.progress < 0.34 ? 0 : self.progress < 0.67 ? 1 : 2;
          if (next !== step.value) step.value = next;
        },
      });
    });
  });

  onBeforeUnmount((): void => {
    trigger?.kill();
    trigger = null;
    media?.revert();
    media = null;
  });

  return step;
}
