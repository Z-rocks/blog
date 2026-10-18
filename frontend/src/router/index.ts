import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw, Router } from "vue-router";
import { getToken } from "../api/request";
import { getLenis, scrollToSelector } from "../composables/useSmoothScroll";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: () => import("../views/Home.vue"),
    meta: { title: "作品集" },
  },
  {
    path: "/work/:id",
    name: "work",
    component: () => import("../views/WorkDetail.vue"),
    meta: { title: "项目案例" },
  },
  {
    path: "/blog",
    name: "blog",
    component: () => import("../views/BlogList.vue"),
    meta: { title: "技术文章" },
  },
  {
    path: "/blog/:id",
    name: "post",
    component: () => import("../views/Post.vue"),
    meta: { title: "文章详情" },
  },
  {
    path: "/login",
    name: "login",
    component: () => import("../views/Login.vue"),
    meta: { title: "管理登录" },
  },
  {
    path: "/admin/edit/:id?",
    name: "admin",
    component: () => import("../views/AdminEdit.vue"),
    meta: { title: "文章管理", requiresAuth: true },
  },
];

/** 等一帧再滚：路由的 scrollBehavior 早于新页面绘制，直接查 DOM 会扑空。 */
function nextFrame(): Promise<void> {
  return new Promise((resolve): void => {
    requestAnimationFrame((): void => {
      requestAnimationFrame((): void => resolve());
    });
  });
}

const router: Router = createRouter({
  history: createWebHistory(),
  routes,
  async scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.hash) {
      await nextFrame();
      // 100px 与 .section-block 的 scroll-margin-top 保持一致，避开吸顶头部。
      // 命中目标就自己滚（走 Lenis），没命中交回路由器原生定位。
      if (scrollToSelector(to.hash, { offset: -100 })) return false;
      return { el: to.hash, top: 100 };
    }
    getLenis()?.scrollTo(0, { immediate: true });
    return { top: 0 };
  },
});
router.beforeEach((to) => {
  if ((to.meta.requiresAuth || to.path.startsWith("/admin/")) && !getToken()) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
});
router.afterEach((to): void => {
  document.title = `${typeof to.meta.title === "string" ? to.meta.title : "页面未找到"} · DEV.LOG`;
});
export default router;
