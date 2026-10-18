import { defineAsyncComponent } from "vue";
import type { Component } from "vue";
import type { WorkDetail } from "../../types";

/**
 * 核心动效注册表。key 取自 WorkDetail["core"]["visual"] 的字面量联合类型，
 * 新增一种视觉而忘了登记时，vue-tsc 会直接报错，不会白屏。
 * 异步加载：详情页首屏只出骨架，动效组件到时再拉。
 */
export const coreVisuals: Record<WorkDetail["core"]["visual"], Component> = {
  "plugin-arch": defineAsyncComponent(() => import("./PluginArch.vue")),
  "step-flow": defineAsyncComponent(() => import("./StepFlow.vue")),
};
