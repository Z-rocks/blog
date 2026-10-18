<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { getToken } from "./api/request";
import {
  destroySmoothScroll,
  initSmoothScroll,
  scrollToSelector,
} from "./composables/useSmoothScroll";
import { profile } from "./data/projects";

const route = useRoute();
const menuOpen = ref<boolean>(false);
// 登录后导航栏追加「文章工作台」;路由切换时同步一次登录态。
const loggedIn = ref<boolean>(!!getToken());
watch(
  () => route.fullPath,
  (): void => {
    menuOpen.value = false;
    loggedIn.value = !!getToken();
  },
);
// Lenis 全站一份，生命周期跟着应用走；页面只负责注销自己的 ScrollTrigger。
onMounted((): void => {
  initSmoothScroll();
  scrollToInitialHash();
});
onBeforeUnmount(destroySmoothScroll);

/**
 * 直接打开 /#projects 这类深链时，浏览器的原生锚点滚动早于路由组件挂载，
 * 目标还不存在，页面会停在顶部。这里等目标出现后补一次。
 */
function scrollToInitialHash(attempt = 0): void {
  if (!window.location.hash) return;
  if (scrollToSelector(window.location.hash, { offset: -100 })) return;
  if (attempt < 6) window.setTimeout((): void => scrollToInitialHash(attempt + 1), 120);
}
</script>

<template>
  <a class="skip-link" href="#main-content">跳转到主要内容</a>
  <header class="site-header">
    <div class="header-inner">
      <RouterLink to="/" class="brand" aria-label="DEV.LOG 首页"
        ><span class="brand-icon" aria-hidden="true">&lt;/&gt;</span>DEV<span
          class="brand-dot"
          >.</span
        >LOG<span class="brand-caption">开发 · 记录 · 生长</span></RouterLink
      >
      <button
        class="icon-button mobile-menu"
        @click="menuOpen = !menuOpen"
        :aria-expanded="menuOpen"
        aria-controls="main-nav"
        aria-label="切换导航"
      >
        {{ menuOpen ? "×" : "☰" }}
      </button>
      <nav
        id="main-nav"
        class="navigation"
        :class="{ open: menuOpen }"
        aria-label="主导航"
      >
        <RouterLink
          to="/"
          :class="{ active: route.name === 'home' && !route.hash }"
          >首页</RouterLink
        >
        <RouterLink
          to="/#projects"
          :class="{ active: route.hash === '#projects' }"
          >项目作品</RouterLink
        >
        <RouterLink
          to="/blog"
          :class="{ active: route.name === 'blog' || route.name === 'post' }"
          >技术文章</RouterLink
        >
        <RouterLink
          v-if="loggedIn"
          to="/admin/edit"
          :class="{ active: route.name === 'admin' }"
          >文章工作台</RouterLink
        >
      </nav>
      <a
        v-if="profile.github"
        class="header-contact"
        :href="profile.github"
        target="_blank"
        rel="noopener noreferrer"
        >GitHub <span aria-hidden="true">↗</span></a
      >
      <RouterLink v-else class="header-contact" to="/#contact"
        >聊一聊 <span aria-hidden="true">↗</span></RouterLink
      >
    </div>
  </header>
  <main id="main-content">
    <RouterView v-if="route.matched.length" />
    <section v-else class="page-shell empty-state">
      <span class="eyebrow">404 / NOT FOUND</span>
      <h1>这一页还没有被写下</h1>
      <p>地址可能有误，回到首页继续探索吧。</p>
      <RouterLink class="button primary" to="/"
        >返回首页 <span aria-hidden="true">↗</span></RouterLink
      >
    </section>
  </main>
  <footer class="site-footer">
    <div class="footer-inner">
      <div>
        <RouterLink to="/" class="footer-brand"
          >DEV.LOG<span class="tiny-dot"></span></RouterLink
        ><span class="footer-note">认真写代码，也认真记录。</span>
      </div>
      <div class="footer-right">
        <span
          >© {{ new Date().getFullYear() }} {{ profile.name }} · Built with Vue
          & NestJS</span
        >
      </div>
    </div>
  </footer>
</template>
