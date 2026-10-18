<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute } from "vue-router";
import ProjectVisual from "../components/ProjectVisual.vue";
import { coreVisuals } from "../components/work-visuals/registry";
import { getWork } from "../data/works";

const route = useRoute();
const detail = computed(() => getWork(String(route.params.id)));
const coreVisual = computed(() =>
  detail.value ? coreVisuals[detail.value.core.visual] : null,
);

// afterEach 已经把标题设为「项目案例」，这里覆盖成具体名字；
// watch 同时兼顾 /work/a → /work/b 的组件复用。
watch(
  detail,
  (value): void => {
    if (value) document.title = `${value.name} · DEV.LOG`;
  },
  { immediate: true },
);
</script>

<template>
  <section v-if="!detail" class="page-shell empty-state">
    <span class="eyebrow">404 / CASE NOT FOUND</span>
    <h1>这个案例还没有被写下</h1>
    <p>链接可能有误，回作品集看看其它项目吧。</p>
    <RouterLink class="button primary" to="/#projects"
      >返回作品集 <span aria-hidden="true">↗</span></RouterLink
    >
  </section>
  <div v-else class="work page-shell">
    <section class="work-hero">
      <div class="work-enter">
        <span class="eyebrow">{{ detail.category }}</span>
        <h1>{{ detail.name }}</h1>
        <p class="work-tagline">{{ detail.tagline }}</p>
        <div class="work-stack">
          <span v-for="item in detail.stack" :key="item" class="tag">{{
            item
          }}</span>
        </div>
        <div class="work-links">
          <a
            v-if="detail.links.source"
            class="button small"
            :href="detail.links.source"
            target="_blank"
            rel="noopener noreferrer"
            >源码 <span aria-hidden="true">↗</span></a
          ><a
            v-if="detail.links.mirror"
            class="button small"
            :href="detail.links.mirror"
            target="_blank"
            rel="noopener noreferrer"
            >镜像仓库 <span aria-hidden="true">↗</span></a
          ><a
            v-if="detail.links.release"
            class="button small"
            :href="detail.links.release"
            target="_blank"
            rel="noopener noreferrer"
            >发布页 <span aria-hidden="true">↗</span></a
          ><a
            v-if="detail.links.demo"
            class="button small"
            :href="detail.links.demo"
            target="_blank"
            rel="noopener noreferrer"
            >在线体验 <span aria-hidden="true">↗</span></a
          >
        </div>
      </div>
      <div class="work-stage">
        <ProjectVisual :visual="detail.visual" variant="hero" />
      </div>
    </section>

    <section class="work-section">
      <h2>{{ detail.problem.heading }}</h2>
      <div class="work-body">
        <p v-for="(paragraph, index) in detail.problem.body" :key="index">
          {{ paragraph }}
        </p>
      </div>
    </section>

    <section class="work-section">
      <h2>{{ detail.core.heading }}</h2>
      <p class="work-lead">滚动经过这里，三步依次点亮；滚得快就直接落到最终态。</p>
      <div class="work-stage">
        <component
          :is="coreVisual"
          v-if="coreVisual"
          :steps="detail.core.steps"
        />
      </div>
    </section>

    <section class="work-section">
      <h2>{{ detail.tech.heading }}</h2>
      <div class="work-points">
        <article
          v-for="point in detail.tech.points"
          :key="point.title"
          class="work-point"
        >
          <h3>{{ point.title }}</h3>
          <p>{{ point.body }}</p>
        </article>
      </div>
      <pre v-if="detail.tech.snippet" class="work-code"><code>{{ detail.tech.snippet.code }}</code></pre>
    </section>

    <section class="work-section">
      <h2>{{ detail.result.heading }}</h2>
      <div class="work-body">
        <p v-for="(paragraph, index) in detail.result.body" :key="index">
          {{ paragraph }}
        </p>
      </div>
      <div class="work-cta">
        <a
          v-if="detail.links.source"
          class="button primary"
          :href="detail.links.source"
          target="_blank"
          rel="noopener noreferrer"
          >查看源码 <span aria-hidden="true">↗</span></a
        ><RouterLink class="button" to="/#projects"
          >其它作品 <span aria-hidden="true">→</span></RouterLink
        >
      </div>
      <RouterLink class="work-back" to="/#projects"
        ><span aria-hidden="true">←</span> 返回作品集</RouterLink
      >
    </section>
  </div>
</template>
