<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getPosts } from "../api/post";
import ProjectVisual from "../components/ProjectVisual.vue";
import { onSmoothScroll } from "../composables/useSmoothScroll";
import { profile, projects } from "../data/projects";
import { TRACK_PHASES, focusIndexAt, trackFrame } from "../utils/track";
import type { TrackMetrics } from "../utils/track";
import type { PostSummary } from "../types";

gsap.registerPlugin(ScrollTrigger);

const posts = ref<PostSummary[]>([]);
const loading = ref<boolean>(true);
const error = ref<string>("");
// 卡片序号与总数都由 projects 推导，新增作品时不必再改模板。
const projectCount = String(projects.length).padStart(2, "0");

// 轨道模式只在"桌面 + 允许动效"时开启；其余情况就是一组普通卡片。
const enhanced = ref<boolean>(false);
// 文字层：is-visible 表示处在横移阶段，is-in 表示当前内容已淡入完成。
const copyShown = ref<boolean>(false);
const copyIn = ref<boolean>(true);
const copyIndex = ref<number>(0);
const current = computed(
  () => projects[Math.min(copyIndex.value, projects.length - 1)],
);

const stage = useTemplateRef<HTMLElement>("stage");

let media: ReturnType<typeof gsap.matchMedia> | null = null;
let unsubscribeScroll: (() => void) | null = null;
let swapTimer = 0;
let pendingIndex = -1;
let cardEls: HTMLElement[] = [];
let lastProgress = 0;
let hoverIndex = -1;
let metrics: TrackMetrics = {
  width: 0,
  height: 0,
  pitch: 600,
  cardWidth: 480,
  cardHeight: 317,
  focusX: 0,
};

const pad = (value: number): string => String(value).padStart(2, "0");

async function loadPosts(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    posts.value = (await getPosts({ page: 1, pageSize: 3 })).items;
  } catch (cause: unknown) {
    error.value = cause instanceof Error ? cause.message : "文章加载失败";
  } finally {
    loading.value = false;
  }
}
function formatDate(value: string): string {
  return new Date(value)
    .toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replaceAll("/", ".");
}

/** 只量一次尺寸，滚动过程中不再读 DOM，避免每帧强制排版。 */
function measure(element: HTMLElement): TrackMetrics {
  const width = element.clientWidth || 1180;
  const height = element.clientHeight || window.innerHeight - 84;
  const cardWidth = Math.round(Math.min(480, Math.max(300, width * 0.36)));
  const cardHeight = Math.round(cardWidth * 0.66);
  const gap = Math.round(Math.min(120, width * 0.08));
  element.style.setProperty("--track-card-w", `${cardWidth}px`);
  element.style.setProperty("--track-card-h", `${cardHeight}px`);
  return {
    width,
    height,
    cardWidth,
    cardHeight,
    pitch: cardWidth + gap,
    focusX: width * 0.38,
  };
}

/** 文字层换页：先淡出 → 180ms 间隙 → 换内容 → 淡入。 */
function requestFocus(next: number): void {
  if (next === pendingIndex) return;
  pendingIndex = next;
  if (next === copyIndex.value && copyIn.value) return;
  copyIn.value = false;
  if (swapTimer) return; // 已在间隙里，等它落地时读最新的 pendingIndex
  swapTimer = window.setTimeout((): void => {
    swapTimer = 0;
    copyIndex.value = Math.min(pendingIndex, projects.length - 1);
    copyIn.value = true;
  }, 180);
}

function render(progress: number): void {
  if (!cardEls.length) return;
  lastProgress = progress;
  cardEls.forEach((card, index): void => {
    const frame = trackFrame(progress, index, cardEls.length, metrics);
    // 悬停上浮只能在这里加：卡片 transform 由 JS 独占，CSS 再写会被覆盖。
    const lift = index === hoverIndex ? -8 : 0;
    card.style.transform =
      `translate3d(calc(-50% + ${frame.x.toFixed(1)}px), calc(-50% + ${(frame.y + lift).toFixed(1)}px), ${frame.z.toFixed(1)}px) ` +
      `rotateY(${frame.rotateY.toFixed(2)}deg) rotate(${frame.rotate.toFixed(2)}deg) scale(${frame.scale.toFixed(3)})`;
    card.style.opacity = frame.opacity.toFixed(3);
    card.style.zIndex = String(200 - Math.round(Math.abs(frame.z)));
    // 发光用一个类开关 + CSS 过渡：卡片 overflow: hidden 会把内部光晕裁掉，
    // 逐帧写 box-shadow 又是绘制很贵的属性。
    card.classList.toggle("is-focus", frame.glow > 0.45);
  });

  // 进度是浮点采样，收束点附近留一点余量，避免正好卡在阈值上时文字层不出现。
  const inTravel = progress >= TRACK_PHASES.collapseEnd - 0.01;
  copyShown.value = inTravel;
  if (inTravel) requestFocus(focusIndexAt(progress, cardEls.length));
}

function onPointerOver(event: PointerEvent): void {
  // 触屏没有 hover，别让 tap 残留一个"悬停"状态。
  if (!window.matchMedia("(hover: hover)").matches) return;
  const card = (event.target as HTMLElement).closest<HTMLElement>(".track-card");
  const next = card ? Number(card.dataset.index) : -1;
  const resolved = Number.isFinite(next) ? next : -1;
  if (resolved === hoverIndex) return;
  hoverIndex = resolved;
  render(lastProgress);
}

function onPointerLeave(): void {
  if (hoverIndex === -1) return;
  hoverIndex = -1;
  render(lastProgress);
}

function setupTrack(element: HTMLElement): () => void {
  element.classList.add("is-enhanced");
  enhanced.value = true;
  cardEls = Array.from(
    element.querySelectorAll<HTMLElement>(".track-card"),
  );
  element.addEventListener("pointerover", onPointerOver);
  element.addEventListener("pointerleave", onPointerLeave);
  metrics = measure(element);
  render(0);

  const trigger = ScrollTrigger.create({
    trigger: element,
    // 站点头部 sticky 高 84px，钉在 top: 0 会被压住
    start: "top 84px",
    end: (): string => `+=${Math.round(window.innerHeight * 3)}`,
    pin: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onRefreshInit: (): void => {
      metrics = measure(element);
    },
    onRefresh: (self): void => {
      metrics = measure(element);
      render(self.progress);
    },
    onUpdate: (self): void => {
      render(self.progress);
    },
  });

  return (): void => {
    trigger.kill();
    element.removeEventListener("pointerover", onPointerOver);
    element.removeEventListener("pointerleave", onPointerLeave);
    element.classList.remove("is-enhanced");
    enhanced.value = false;
    copyShown.value = false;
    copyIn.value = true;
    pendingIndex = -1;
    hoverIndex = -1;
    if (swapTimer) window.clearTimeout(swapTimer);
    swapTimer = 0;
    // 清掉内联几何，回到静态栅格。
    cardEls.forEach((card): void => {
      card.classList.remove("is-focus");
      card.style.transform = "";
      card.style.opacity = "";
      card.style.zIndex = "";
    });
    cardEls = [];
  };
}

onMounted((): void => {
  void loadPosts();
  unsubscribeScroll = onSmoothScroll((): void => ScrollTrigger.update());

  media = gsap.matchMedia();
  // 没有 matchMedia 包裹的 GSAP 代码会在"减少动态效果"下照旧播放，视为 bug。
  media.add(
    "(min-width: 801px) and (prefers-reduced-motion: no-preference)",
    (): (() => void) | void => {
      const element = stage.value;
      if (!element) return;
      return setupTrack(element);
    },
  );
  // Hero 只动代码窗：h1 是 LCP 元素，首帧必须可见。
  media.add("(prefers-reduced-motion: no-preference)", (): void => {
    const lines = gsap.utils.toArray<HTMLElement>(".code-body .code-line");
    if (!lines.length) return;
    gsap.from(lines, {
      opacity: 0,
      x: -6,
      duration: 0.35,
      stagger: 0.07,
      ease: "power2.out",
    });
  });
});

onBeforeUnmount((): void => {
  unsubscribeScroll?.();
  unsubscribeScroll = null;
  media?.revert();
  media = null;
  if (swapTimer) window.clearTimeout(swapTimer);
  swapTimer = 0;
  ScrollTrigger.getAll().forEach((trigger): void => trigger.kill());
});
</script>

<template>
  <div class="home page-shell">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <div class="availability">
          <span class="status-dot"></span>开放工作机会<span
            class="availability-divider"
          ></span
          >{{ profile.role }}
        </div>
        <p class="hero-greeting">
          你好，世界。<span class="wave" aria-hidden="true">✳</span>
        </p>
        <h1 id="hero-title">
          把复杂的问题，<br />写成<span class="highlight-word"
            >清晰的代码<svg
              viewBox="0 0 310 14"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M3 10 Q 145 -2 307 8" /></svg></span
          >。
        </h1>
        <p class="hero-description">
          我是 {{ profile.name }}，一名热爱构建与探索的开发者。<br />{{
            profile.positioning
          }}
        </p>
        <div class="hero-actions">
          <RouterLink class="button primary" to="/#projects"
            >探索我的作品 <span aria-hidden="true">↗</span></RouterLink
          ><RouterLink class="button text-button" to="/blog"
            >阅读技术文章 <span aria-hidden="true">→</span></RouterLink
          >
        </div>
        <div class="hero-stack">
          <span class="stack-label">本站技术栈</span
          ><span class="stack-item"
            ><b class="tech-symbol ts">TS</b>TypeScript</span
          ><span class="stack-item"><b class="tech-symbol vue">V</b>Vue 3</span
          ><span class="stack-item"
            ><b class="tech-symbol nest">N</b>NestJS</span
          ><span class="stack-item">⌘ MySQL</span>
        </div>
      </div>
      <div class="hero-visual" aria-label="TypeScript 开发者代码卡片">
        <div class="orbital orbital-one"></div>
        <div class="orbital orbital-two"></div>
        <span class="visual-spark spark-one" aria-hidden="true">+</span
        ><span class="visual-spark spark-two" aria-hidden="true">✳</span>
        <div class="code-window">
          <div class="window-top">
            <div class="traffic-lights"><i></i><i></i><i></i></div>
            <span>developer.ts</span><span>&lt;/&gt;</span>
          </div>
          <div class="code-body">
            <div class="code-line">
              <span class="line-number">01</span
              ><code
                ><span class="syntax-purple">const</span> developer:
                <span class="syntax-yellow">Developer</span> = {</code
              >
            </div>
            <div class="code-line">
              <span class="line-number">02</span
              ><code>
                name:
                <span class="syntax-green">'{{ profile.name }}'</span>,</code
              >
            </div>
            <div class="code-line">
              <span class="line-number">03</span
              ><code>
                focus:
                <span class="syntax-green">'Backend Development'</span>,</code
              >
            </div>
            <div class="code-line">
              <span class="line-number">04</span><code> mindset: [</code>
            </div>
            <div class="code-line">
              <span class="line-number">05</span
              ><code> <span class="syntax-green">'保持好奇'</span>,</code>
            </div>
            <div class="code-line">
              <span class="line-number">06</span
              ><code> <span class="syntax-green">'动手构建'</span>,</code>
            </div>
            <div class="code-line">
              <span class="line-number">07</span
              ><code> <span class="syntax-green">'持续迭代'</span></code>
            </div>
            <div class="code-line">
              <span class="line-number">08</span><code> ],</code>
            </div>
            <div class="code-line">
              <span class="line-number">09</span
              ><code>
                next: <span class="syntax-purple">() =&gt;</span>
                <span class="syntax-yellow">buildSomethingGreat</span>()</code
              >
            </div>
            <div class="code-line">
              <span class="line-number">10</span
              ><code>};<span class="code-cursor"></span></code>
            </div>
          </div>
          <div class="window-status">
            <span><span class="tiny-dot"></span>Always learning</span
            ><span>UTF-8 · TypeScript</span>
          </div>
        </div>
        <div class="floating-label">
          <span class="floating-icon" aria-hidden="true">&gt;_</span>
          <div>
            <strong>Less talk. More building.</strong
            ><span>让想法落地，让代码说话。</span>
          </div>
          <span class="floating-check" aria-hidden="true">✓</span>
        </div>
      </div>
    </section>
    <div class="intro-strip">
      <span
        ><span class="tiny-dot"></span
        >用工程思维解决问题，用文字沉淀经验。</span
      ><a href="#projects">向下探索 <span aria-hidden="true">↓</span></a>
    </div>
    <section id="projects" class="section-block">
      <div class="section-heading">
        <div>
          <span class="eyebrow">01 / SELECTED WORK</span>
          <h2>不止于想法<span class="heading-dot">.</span></h2>
          <p>滚动看它们在空间里散开、收拢，再逐张经过聚焦线。</p>
        </div>
        <span class="section-aside"
          >PROJECTS <span class="count-pill">{{ projectCount }}</span></span
        >
      </div>
      <div
        ref="stage"
        class="track-stage"
        :class="{ 'is-enhanced': enhanced, 'is-tracking': copyShown }"
      >
        <div class="track-layer">
          <article
            v-for="(project, index) in projects"
            :key="project.id"
            class="track-card"
            :data-index="index"
          >
            <RouterLink
              class="track-link"
              :to="`/work/${project.id}`"
              :aria-label="`查看 ${project.name} 案例（${pad(index + 1)} / ${pad(projects.length)}）`"
            >
              <ProjectVisual
                :visual="project.visual"
                :status="project.placeholder ? '项目占位' : '当前项目'"
              />
              <div class="track-card-copy">
                <span class="track-card-index"
                  >{{ pad(index + 1) }} / {{ pad(projects.length) }}</span
                >
                <h3>{{ project.name }}</h3>
                <p class="track-card-desc">{{ project.description }}</p>
                <span class="track-card-cta"
                  >查看案例 <span aria-hidden="true">↗</span></span
                >
              </div>
            </RouterLink>
          </article>
        </div>
        <div class="track-scrim" aria-hidden="true"></div>
        <div
          class="track-copy"
          :class="{ 'is-visible': copyShown, 'is-in': copyShown && copyIn }"
          aria-live="off"
        >
          <span class="eyebrow">{{ current.category }}</span>
          <h3>{{ current.name }}</h3>
          <p>{{ current.description }}</p>
          <div class="track-copy-tags">
            <span v-for="tag in current.tags" :key="tag" class="tag">{{
              tag
            }}</span>
          </div>
        </div>
      </div>
    </section>
    <section class="section-block articles-section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">02 / NOTES & THOUGHTS</span>
          <h2>写下来，才真正想明白<span class="heading-dot">.</span></h2>
          <p>从实践出发，记录技术细节与解题过程。</p>
        </div>
        <RouterLink class="inline-link" to="/blog"
          >全部文章 <span aria-hidden="true">↗</span></RouterLink
        >
      </div>
      <div v-if="loading" class="state-panel" role="status">
        <span class="loading-dot"></span>正在整理文章…
      </div>
      <div v-else-if="error" class="state-panel" role="alert">
        <span class="state-symbol">{ }</span>
        <div>
          <strong>文章暂时未能加载</strong>
          <p>{{ error }}</p>
        </div>
        <button class="button small" @click="loadPosts">重新加载 ↻</button>
      </div>
      <div v-else-if="!posts.length" class="state-panel">
        <span class="state-symbol">Aa</span>
        <div>
          <strong>好文章，从第一次记录开始。</strong>
          <p>这里还没有已发布的文章，第一篇思考正在酝酿。</p>
        </div>
      </div>
      <div v-else class="article-list">
        <RouterLink
          v-for="(post, i) in posts"
          :key="post.id"
          :to="`/blog/${post.id}`"
          class="article-row"
          ><span class="article-number">0{{ i + 1 }}</span>
          <div class="article-row-content">
            <div class="article-row-meta">
              <span v-if="post.tags[0]" class="article-topic">{{
                post.tags[0]
              }}</span
              ><time :datetime="post.createdAt">{{
                formatDate(post.createdAt)
              }}</time>
            </div>
            <h3>{{ post.title }}</h3>
            <p>{{ post.summary || "点击阅读完整文章。" }}</p>
          </div>
          <span class="article-arrow" aria-hidden="true">↗</span></RouterLink
        >
      </div>
    </section>
    <section id="contact" class="contact-strip">
      <div>
        <span class="eyebrow">LET’S BUILD SOMETHING GOOD</span>
        <h2>下一个有意思的项目，也许和你一起。</h2>
        <p>
          {{
            profile.email
              ? "如果你有合适的工作机会，或只是想交流技术，欢迎联系。"
              : "期待一次关于技术、产品与未来的对话。联系信息待补充。"
          }}
        </p>
      </div>
      <div class="contact-actions">
        <a
          v-if="profile.email"
          :href="`mailto:${profile.email}`"
          class="button primary"
          >联系我 ↗</a
        ><a
          v-if="profile.resume"
          :href="profile.resume"
          class="button"
          target="_blank"
          rel="noopener noreferrer"
          >查看简历 ↗</a
        ><RouterLink
          v-if="!profile.email && !profile.resume"
          class="button"
          to="/blog"
          >先读读我的文章 ↗</RouterLink
        >
      </div>
    </section>
  </div>
</template>
