<script setup lang="ts">
import { useTemplateRef } from "vue";
import type { WorkStep } from "../../types";
import { useStepProgress } from "../../composables/useStepProgress";

defineProps<{ steps: WorkStep[] }>();

const track = useTemplateRef<HTMLElement>("track");
const step = useStepProgress(track, 2);
</script>

<template>
  <div ref="track" class="step-flow-track" :data-step="step">
    <ol class="step-flow">
      <li
        v-for="(item, index) in steps"
        :key="item.key"
        :class="{ 'is-active': step === index, 'is-done': step > index }"
      >
        <span class="step-flow-dot">{{ index + 1 }}</span>
        <div class="step-flow-body">
          <h4>{{ item.title }}</h4>
          <p>{{ item.caption }}</p>
        </div>
      </li>
    </ol>
  </div>
</template>
