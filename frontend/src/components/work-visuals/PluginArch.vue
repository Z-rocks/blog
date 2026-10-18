<script setup lang="ts">
import { useTemplateRef } from "vue";
import type { WorkStep } from "../../types";
import { useStepProgress } from "../../composables/useStepProgress";

defineProps<{ steps: WorkStep[] }>();

const track = useTemplateRef<HTMLElement>("track");
const step = useStepProgress(track, 2);
</script>

<template>
  <div ref="track" class="plugin-track" :data-step="step">
    <div class="plugin-stage" aria-hidden="true">
      <span class="plugin-ripple"></span>
      <div class="plugin-core">
        统一课表内核<small>WEEK · PERIOD · REMIND</small>
      </div>
      <div class="plugin-chip c1">
        登录<span class="plugin-check">✓</span>
      </div>
      <div class="plugin-chip c2">
        抓取<span class="plugin-check">✓</span>
      </div>
      <div class="plugin-chip c3">
        字段映射<span class="plugin-check">✓</span>
      </div>
      <div class="plugin-chip c4">
        作息表<span class="plugin-check">✓</span>
      </div>
    </div>
    <ol class="step-captions">
      <li
        v-for="(item, index) in steps"
        :key="item.key"
        :class="{ 'is-active': step === index }"
      >
        <strong>{{ item.title }}</strong> · {{ item.caption }}
      </li>
    </ol>
  </div>
</template>
