<script setup lang="ts">
import type { Project } from "../types";

withDefaults(
  defineProps<{
    visual: Project["visual"];
    /** 左上角序号，如「01 /」。 */
    label?: string;
    /** 右上角状态标签。 */
    status?: string;
    /** hero 变体用于详情页放大展示。 */
    variant?: "card" | "hero";
  }>(),
  { label: "", status: "", variant: "card" },
);

// 手机卡片里的课表格子：7 列（周一至周日）× 4 行，1 表示有课。
const phoneCells = [
  0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  0, 1, 0,
];
</script>

<template>
  <div
    class="project-visual"
    :class="[`visual-${visual}`, `is-${variant}`]"
    aria-hidden="true"
  >
    <span v-if="label" class="visual-index">{{ label }}</span
    ><span v-if="status" class="project-status">{{ status }}</span>
    <div v-if="visual === 'browser'" class="mini-browser">
      <div class="mini-browser-bar">
        <i></i><i></i><i></i><span>dev.log /</span>
      </div>
      <div class="mini-browser-content">
        <span class="mini-brand">DEV.LOG<span>↗</span></span
        ><strong>Ideas into<br /><em>reality.</em></strong>
        <div class="mini-text-line"></div>
        <div class="mini-button">Explore work ↗</div>
        <div class="mini-blocks"><i></i><i></i><i></i></div>
      </div>
      <span class="mini-code">&lt;/&gt;</span>
    </div>
    <div v-else-if="visual === 'flow'" class="flow-graphic">
      <span class="flow-box">▱<small>REQUEST</small></span
      ><span class="flow-line"></span
      ><span class="flow-center">⑂<small>SERVICE</small></span
      ><span class="flow-line"></span
      ><span class="flow-box">✓<small>COMMIT</small></span
      ><span class="flow-caption">THINK. DESIGN. BUILD.</span>
    </div>
    <div v-else-if="visual === 'mobile'" class="mini-phone">
      <div class="phone-status"><span>第 6 周</span><i class="phone-battery"></i></div>
      <div class="phone-grid">
        <span
          v-for="(cell, cellIndex) in phoneCells"
          :key="cellIndex"
          class="phone-cell"
          :class="{ 'is-on': cell === 1 }"
        ></span>
      </div>
      <div class="phone-dock"><i></i><i class="is-active"></i><i></i></div>
    </div>
    <div v-else class="mini-terminal">
      <div class="terminal-top">
        <span>&gt;_</span><span>~/workspace/toolbox</span><span>—</span>
      </div>
      <div class="terminal-lines">
        <p><span>❯</span> npm run build:ideas</p>
        <p class="terminal-muted">Turning coffee into code...</p>
        <p><span>✓</span> Think. Build. Improve.</p>
        <p><span>✓</span> Make something useful.</p>
        <p><span>❯</span> <i></i></p>
      </div>
    </div>
  </div>
</template>
