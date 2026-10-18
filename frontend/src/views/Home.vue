<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getPosts } from "../api/post";
import ProjectVisual from "../components/ProjectVisual.vue";
import { onSmoothScroll } from "../composables/useSmoothScroll";
import { profile, projects } from "../data/projects";
import { deckState } from "../utils/deck";
import type { PostSummary } from "../types";

gsap.registerPlugin(ScrollTrigger);

const posts = ref<PostSummary[]>([]);
const loading = ref<boolean>(true);
const error = ref<string>("");
// 卡片序号与总数都由 projects 推导，新增作品时不必再改模板。
const projectCount = String(projects.length).padStart(2, "0");
// 只有"小屏 + 允许动效"时才给卡片加入场类名，避免 resize 后卡片停在透明态。
const motionOn = ref<boolean>(false);

const pad = (value: number): string => String(value).padStart(2, "0");

let deckMedia: ReturnType<typeof gsap.matchMedia> | null = null;
let unsubscribeScroll: (() => void) | null = null;
let observer: IntersectionObserver | null = null;

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

/** 桌面端：逐张 pin + 前一张缩小下压，参数统一来自 utils/deck.ts。 */
function buildDeck(): void {
  const cards = gsap.utils.toArray<HTMLElement>(".deck-card");
  if (cards.length < 2) return;
  const last = cards[cards.length - 1];
  cards.forEach((card, index): void => {
    if (card === last) return; // 最后一张不 pin，它负责垫底
    ScrollTrigger.create({
      trigger: card,
      // 站点头部 sticky 高 84px，钉在 top: 0 会被压住
      start: "top 84px",
      endTrigger: last,
      end: "top 84px",
      pin: true,
      pinSpacing: false, // 否则每张卡各撑一屏，总长又变回 400vh
      invalidateOnRefresh: true,
    });
    const { scale, opacity } = deckState(index, cards.length);
    gsap.to(card, {
      scale,
      opacity,
      ease: "none",
      scrollTrigger: {
        trigger: card,
        start: "top 84px",
        endTrigger: last,
        end: "top 84px",
        scrub: true,
      },
    });
  });
  ScrollTrigger.refresh();
}

/** 小屏入场交给 IntersectionObserver + CSS，桌面端由 GSAP 独占，两边不同时生效。 */
function observeCards(): void {
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !window.matchMedia("(max-width: 800px)").matches
  ) {
    return;
  }
  motionOn.value = true;
  observer = new IntersectionObserver(
    (entries): void => {
      entries.forEach((entry): void => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-inview");
        observer?.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px" },
  );
  document
    .querySelectorAll<HTMLElement>(".deck-card")
    .forEach((element): void => observer?.observe(element));
}

onMounted((): void => {
  void loadPosts();
  unsubscribeScroll = onSmoothScroll((): void => ScrollTrigger.update());

  deckMedia = gsap.matchMedia();
  // 没有 matchMedia 包裹的 GSAP 代码会在"减少动态效果"下照旧播放，视为 bug。
  deckMedia.add(
    "(min-width: 801px) and (prefers-reduced-motion: no-preference)",
    buildDeck,
  );
  // Hero 只动代码窗：h1 是 LCP 元素，首帧必须可见。
  deckMedia.add("(prefers-reduced-motion: no-preference)", (): void => {
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
  observeCards();
});

onBeforeUnmount((): void => {
  observer?.disconnect();
  observer = null;
  unsubscribeScroll?.();
  unsubscribeScroll = null;
  deckMedia?.revert();
  deckMedia = null;
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
          <p>一些认真构建的作品，以及它们背后的思考。</p>
        </div>
        <span class="section-aside"
          >PROJECTS <span class="count-pill">{{ projectCount }}</span></span
        >
      </div>
      <div class="deck" :class="{ 'is-motion': motionOn }">
        <article
          v-for="(project, index) in projects"
          :key="project.id"
          class="deck-card"
        >
          <RouterLink
            class="deck-link"
            :to="`/work/${project.id}`"
            :aria-label="`查看 ${project.name} 案例`"
          >
            <div class="deck-meta">
              <span class="deck-index"
                >{{ pad(index + 1) }} / {{ pad(projects.length) }}</span
              >
              <span class="deck-category">{{ project.category }}</span>
            </div>
            <ProjectVisual
              :visual="project.visual"
              :status="project.placeholder ? '项目占位' : '当前项目'"
            />
            <div class="deck-copy">
              <h3>{{ project.name }}</h3>
              <p class="deck-desc">{{ project.description }}</p>
              <ul class="deck-highlights">
                <li v-for="item in project.highlights" :key="item">
                  {{ item }}
                </li>
              </ul>
              <div class="deck-foot">
                <div class="tag-list">
                  <span v-for="tag in project.tags" :key="tag" class="tag">{{
                    tag
                  }}</span>
                </div>
                <span class="deck-cta"
                  >查看案例 <span aria-hidden="true">↗</span></span
                >
              </div>
            </div>
          </RouterLink>
        </article>
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
