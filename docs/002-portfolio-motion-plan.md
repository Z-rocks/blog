# 002 · 作品集动效升级实施方案

> 本文是对初版《zrocks.me 作品集高级感动效升级方案》的落地版：保留原有信息架构判断
> （主页摘要 / 详情页深度），把每条动效换算成这个仓库里真实存在的文件、参数和降级路径。
>
> 状态：**已实施（2026-10-18）**，其中**第 4 节的主页 Card-Deck 已被
> [003-portfolio-track.md](003-portfolio-track.md) 取代**（改为散落 → 收束 → Coverflow 水平聚焦）。
> 其余判断（Lenis、Hero 动效、详情页、降级原则）沿用。实施过程中对方案做的 9 处修正与实测数据
> 见文末第 14 节；本文保留原始判断，作为"当时为什么这么定"的记录。

---

## 0. 结论先行

一句话：**架构判断全部采纳，动效参数全部下调，并先修三个会让方案"白做"的既有问题。**

| # | 初版方案 | 本方案 | 理由 |
|---|---|---|---|
| 1 | 主页 Card-Deck + 滚动吸附（snap） | 保留堆叠，**默认关闭 snap** | 4 张卡 + Lenis + snap 三者抢滚动控制权，用户想快划会被拽回来。改成卡片序号进度（`01 / 04`）+ 240vh 滚动预算，节奏由间距控制 |
| 2 | 项目区 `pin` 满屏，4 张卡 ≈ 400vh | 每张卡 `78svh`，总滚动 **≈ 240vh** | 主页要留出"往下还有文章和联系方式"的暗示。400vh 会让首次访问者以为这站只有作品 |
| 3 | 卡片点击进详情页，卡片内保留展开 | **去掉卡片内的展开交互**，整卡可点 | 卡内展开 + 固定容器 = 内容溢出且不可滚。堆叠卡有整屏空间，亮点直接平铺，不再需要折叠 |
| 4 | 引入高对比衬线字体做 Hero / 章节标题 | **中文标题不上衬线**，衬线只用于拉丁展示字 | 思源宋体全量 8MB+，子集化要跟随文案变化；Windows 上 SimSun 回退效果很差。收益不匹配成本 |
| 5 | 用 Google Fonts 引入 DM Sans / Noto Sans SC | **删掉那行 `@import`** | 生产 CSP 是 `style-src 'self'`，这行**在线上根本不生效**。现在 dev 和 prod 用的不是同一套字体（详见 1.1） |
| 6 | 详情页"应用截图" | 复用现有的 CSS 手机视觉放大，**不上截图** | 仓库里没有任何截图素材（`frontend/public/` 不存在）。CSS 绘制的手机与主页视觉同源，零字节、零版权风险 |
| 7 | 插件架构动效用滚动进度逐帧驱动 | **离散三步 + CSS 过渡** | 逐帧 scrub 快速滚动时会停在半截状态（插件卡在屏幕外）。离散状态天然"可跳过"，落到哪一步就是哪一步 |
| 8 | 未提及测试 | 堆叠进度映射抽成**纯函数 + 单测** | 这个仓库的测试文化是"能证明行为对"，动效也可以有可验证的部分 |

---

## 1. 开工前必须处理的三个既有问题

这三条不修，动效做得再好也白搭。

### 1.1 线上字体和本地字体不是同一套

`frontend/src/styles/main.css` 第 1 行：

```css
@import url("https://fonts.googleapis.com/css2?family=DM+Sans...");
```

而 `deploy/nginx.conf` 两个 server 块的 CSP 都是：

```
style-src 'self'; font-src 'self'
```

**`style-src 'self'` 会直接拦掉这个 `@import`**（它是外站样式表），控制台报 CSP 违规，
字体回落到 `-apple-system / Segoe UI / sans-serif`。也就是说：

- 本地 `npm run dev`（无 CSP）看到的是 DM Sans；
- 线上 `zrocks.me` 看到的是系统字体。

这解释了为什么"本地调好的字距，上线后感觉不对"。**处理方式：删掉这行 `@import`，
把系统字体栈作为唯一来源**（当前栈在 Windows / macOS / iOS / Android 上都够用）。

> **已实测验证**（2026-10-18）：用 `deploy/nginx.conf` 里同一份 CSP 起静态服务加载构建产物，
> Chromium 报
> `Loading the stylesheet 'https://fonts.googleapis.com/...' violates the following Content Security Policy directive: "style-src 'self'"`
> 请求失败，`document.styleSheets` 只剩 1 条（本地那份）。即线上每一次访问都在报这条 CSP 错误，
> 字体静默回退系统栈。复现脚本见下方命令（属于临时验证，不入库）。
>
> ```bash
> # 用 nginx.conf 的 CSP 起静态服务 → 打开页面 → 看控制台是否出现 CSP 拒绝
> ```

如果确实要展示字体，只能自托管：`frontend/public/fonts/*.woff2` + `@font-face`，
`font-display: swap`，`font-src 'self'` 允许同源字体文件。**不要**再引入任何 CDN 字体。

### 1.2 `prefers-reduced-motion` 只挡得住 CSS，挡不住 GSAP

`main.css` 末尾已有：

```css
@media (prefers-reduced-motion: reduce) {
  *, *:before, *:after { animation: none !important; transition: none !important; }
}
```

它管不了 GSAP —— GSAP 是直接写 `element.style`，不产生 CSS animation/transition。
所以每个 GSAP 动效都必须自带闸门：

```ts
const mm = gsap.matchMedia();
mm.add("(prefers-reduced-motion: no-preference)", () => { /* 只有这时才建 timeline */ });
```

没有 `mm.add` 包裹的 GSAP 代码，一律视为 bug。

### 1.3 CSP 不会拦 GSAP（这点先确认，免得白担心）

`script-src 'self'` 拦的是外站脚本和内联 `<script>`。GSAP 是打包进产物的同源脚本，
它通过 CSSOM（`el.style.transform = ...`）改样式，**不受 `style-src` 限制**——
CSP 的 style 限制针对内联 `<style>` 和 HTML 的 `style` 属性，不针对 JS 运行时修改。
Vue 的 `:style` 绑定同理，现在的站点已经在用了。

结论：不需要为动效放宽 CSP。这条写下来是为了避免实施时有人去改 `nginx.conf` 加 `'unsafe-inline'`。

---

## 2. 现状盘点（决定方案边界的事实）

| 事实 | 影响 |
|---|---|
| 5 条路由，全部 `() => import()` 懒加载 | 新增 `/work/:id` 天然独立 chunk，详情页不拖累首页 |
| `main.css` 单文件 2700 行，断点 1500 / 1100 / 800 / 540 | 新样式按区块追加，不拆文件（拆文件是另一件事） |
| 首页 chunk 11.65 KB、入口 149 KB、文章页 192 KB（gz） | 首页还有约 40 KB 的余量给 gsap |
| `projects.ts` 只有 3 条 `highlights` 字符串 | 详情页需要新的数据结构，不能硬塞进 `Project` |
| `router.scrollBehavior` 用 `{ el, behavior: "smooth" }` | 引入 Lenis 后这条会失效，必须改（见 3.2） |
| 卡片视觉已参数化：`--vs` / `--visual-h` | 堆叠卡直接复用，不重写视觉图 |
| 站点无 `public/` 目录、无图片资源 | 详情页"成果"区不上截图 |
| 首页已有 `.code-cursor` 闪烁动画（`@keyframes blink`） | Hero 动效是"改造"，不是"新建" |

---

## 3. 模块一：Lenis 平滑滚动

### 3.1 为什么它是 P0

它是另外三个动效的底座：堆叠卡的位移、Hero 的入场、详情页的分步，都靠滚动驱动。
底座不稳，上面全晃。

### 3.2 三处必须同步的地方

**① ScrollTrigger 同步**（标准接法，不要自创）：

```ts
const lenis = new Lenis({ duration: 1.05, smoothWheel: true, syncTouch: false });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

`syncTouch: false` 是刻意的：移动端保留原生滚动惯性，只让桌面端有阻尼。

**② 锚点跳转**。`App.vue` 里有两处 `to="/#projects"`、`to="/#contact"`，
`router/index.ts` 的 `scrollBehavior` 目前返回 `{ el, behavior: "smooth" }`。
Lenis 接管滚动后，浏览器原生 `scrollIntoView` 会和 Lenis 的位置插值打架，表现为"跳过去又弹回来"。

改法：把 Lenis 实例放进模块级单例，`scrollBehavior` 走它。

```ts
// composables/useSmoothScroll.ts
let lenis: Lenis | null = null;
export function getLenis(): Lenis | null { return lenis; }
```

```ts
// router/index.ts
scrollBehavior(to, _from, savedPosition) {
  if (savedPosition) return savedPosition;
  if (to.hash) {
    const el = document.querySelector(to.hash);
    if (el) { getLenis()?.scrollTo(el as HTMLElement, { offset: -100 }); return false; }
    return { el: to.hash, top: 100 };
  }
  getLenis()?.scrollTo(0, { immediate: true });
  return { top: 0 };
}
```

返回 `false` 表示"浏览器别管了，我已经滚了"。跨页跳转（从 `/blog` 点"项目作品"）要等目标页 DOM 就绪，
在 `Home.vue` 的 `onMounted` 里补一次 `lenis.scrollTo(hash)`，或用 `requestAnimationFrame` 兜一帧。

**③ 路由切换后刷新 ScrollTrigger**。从详情页返回首页时，`Home.vue` 重新挂载，
旧的 pin 如果没销毁会把新页面顶歪：

```ts
onBeforeUnmount(() => {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  lenis?.destroy();          // 只在离开首页时销毁，注意与 App 层的实例区分
});
```

建议：**Lenis 挂在 `App.vue`（全站一份），ScrollTrigger 的实例挂在 `Home.vue`（随页面销毁）**。
两者生命周期不同，不要混在一起。

### 3.3 降级

```ts
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isCoarse = window.matchMedia("(pointer: coarse)").matches;
if (prefersReduced || isCoarse) return;   // 不初始化 Lenis，用原生滚动
```

不做 Lenis 时，`scrollBehavior` 里的 `getLenis()` 返回 `null`，自动回落到原生 `smooth`。

---

## 4. 模块二：Card-Deck 卡片堆叠（核心）

### 4.1 卡片重构

现在首页卡片是 `<article>` + `<button class="project-title">` 展开详情。堆叠后要改：

- 整张卡是 `<RouterLink :to="`/work/${id}`">`，`aria-label="查看 ${name} 案例"`；
- 亮点（`highlights`）**直接平铺**，不再折叠 —— 堆叠卡有整屏高度，放得下；
- 删掉 `expanded` 这个 ref 和 `.project-details` 那一段（约 30 行模板 + 25 行 CSS）；
- 卡片右下角固定位置放 `查看案例 ↗`，与主页 `inline-link` 同款样式。

信息层级（从上到下，位置固定，这是"统一秩序"的来源）：

```
序号 01 / 04                                  类别 FULL STACK
┌──────────────────────────────────────────────┐
│  视觉图（复用 --vs / --visual-h，高度 46%）    │
└──────────────────────────────────────────────┘
项目名（衬线/大字重）
一句话描述（2 行，超出省略）
· 亮点一    · 亮点二    · 亮点三
[标签] [标签] [标签]                     查看案例 ↗
```

### 4.2 DOM 结构

```html
<section id="projects" class="section-block">
  <div class="section-heading">…</div>
  <div class="deck">
    <article v-for="(p, i) in projects" :key="p.id" class="deck-card">
      <RouterLink class="deck-link" :to="`/work/${p.id}`">
        <div class="deck-meta">
          <span class="deck-index">{{ pad(i + 1) }} / {{ pad(projects.length) }}</span>
          <span class="project-status">{{ p.category }}</span>
        </div>
        <div class="project-visual" :class="`visual-${p.visual}`">…</div>
        <div class="deck-copy">
          <h3>{{ p.name }}</h3>
          <p>{{ p.description }}</p>
          <ul class="deck-highlights"><li v-for="h in p.highlights">{{ h }}</li></ul>
          <div class="tag-list">…</div>
          <span class="deck-cta">查看案例 ↗</span>
        </div>
      </RouterLink>
    </article>
  </div>
</section>
```

### 4.3 滚动预算（关键参数）

```css
.deck-card {
  height: min(78svh, 780px);   /* 用 svh，避免移动端地址栏收起时跳一下 */
  position: relative;
}
```

4 张卡、每张 78svh、`pinSpacing: false` → 总滚动距离 ≈ **3 × 78svh ≈ 234svh**。
对比初版的 400vh，省下近两屏，主页仍然"往下还有内容"。

`78svh` 不是拍脑袋：卡片内容 = 视觉图 46% + 文案区，低于 72svh 文案会挤，
高于 82svh 就滑向"整屏霸占"。

### 4.4 GSAP 参数

用 GSAP 官方论坛那套"逐张 pin + 前一张缩小"的配方，不要自己发明：

```ts
const cards = gsap.utils.toArray<HTMLElement>(".deck-card");
const last = cards[cards.length - 1];

cards.forEach((card, i) => {
  if (card === last) return;                    // 最后一张不 pin，它负责"垫底"

  ScrollTrigger.create({
    trigger: card,
    start: "top 84px",                          // 84px = 站点头部高度，别用 top top
    endTrigger: last,
    end: "top 84px",
    pin: true,
    pinSpacing: false,                          // 关键：否则会撑出几屏空白
  });

  gsap.to(card, {
    scale: 1 - (cards.length - 1 - i) * 0.035,  // 越靠后缩得越少，形成阶梯
    opacity: 0.45,
    ease: "none",
    scrollTrigger: { trigger: card, start: "top 84px", endTrigger: last, end: "top 84px", scrub: true },
  });
});
```

三个容易踩的点，写在这里省得实施时再查：

1. **`start` 不能用 `top top`**：站点头部是 `position: sticky; height: 84px; z-index: 30`，
   卡片钉在 `top: 0` 会被头部压住 84px。用 `top 84px`。
2. **不要用 `filter: blur()` 做景深**：四张大卡同时 blur，合成层压力直接掉帧。
   要"雾化"就在卡片上加一层 `::after { background: rgba(247,248,243,.55) }`，
   由 `opacity` 驱动 —— 只动 opacity，走合成层，便宜一个数量级。
3. **`pinSpacing: false` 必须配 `endTrigger: last`**，否则每张卡各 pin 一屏，总长又变成 400vh。

### 4.5 关于 snap（滚动吸附）

**默认不做。** 理由不是"做不出来"，是三个东西抢同一个控制权：

- Lenis 在插值滚动位置；
- ScrollTrigger 的 pin 在接管滚动区间；
- snap 要在松手后强制归位。

三者叠加的典型症状：用户快速划过第 2 张卡，页面自己滑回第 2 张；触控板上尤其明显。
初版方案把"松手后自动停到下一张卡片"当优点，但作品集的真实行为是**扫读**，
不是逐张欣赏——强行归位会让人想关掉页面。

替代方案（成本几乎为零）：卡片左上角常驻 `01 / 04` 序号，用户始终知道自己在第几张。

如果实施后确实想要吸附，**只在桌面端、只作为可选开关**：

```ts
ScrollTrigger.create({
  trigger: ".deck", start: "top 84px", end: "bottom bottom",
  snap: { snapTo: 1 / (cards.length - 1), duration: 0.35, ease: "power1.inOut", delay: 0.1 },
});
```

上线后观察一周，用真实行为决定要不要开。

### 4.6 移动端降级（< 800px）

小屏上 `pin` 是灾难：pin-spacer 和地址栏收缩打架，堆叠卡还会遮住后续内容。

```ts
mm.add("(min-width: 801px) and (prefers-reduced-motion: no-preference)", () => {
  buildDeck();                                  // 只有桌面端建堆叠
});
```

`< 800px` 时：

```css
.deck-card { height: auto; margin-bottom: 20px; }
.deck-card .deck-link { /* 复用现有 .project-card 的边框/圆角/阴影 */ }
```

入场动效改成 `IntersectionObserver` 加类名，CSS 过渡 300ms / 12px 上移，一次性的：

```css
.deck-card { opacity: 0; transform: translateY(12px); transition: opacity .3s, transform .3s; }
.deck-card.is-inview { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .deck-card { opacity: 1; transform: none; } }
```

注意：这条 CSS 只在小屏生效（用媒体查询包住），桌面端交给 GSAP，两边不要同时生效，
否则 GSAP 的 `opacity: 0.45` 会被 CSS 的 `1` 覆盖。

### 4.7 可测的部分

把"滚动进度 → 卡片状态"抽成纯函数，脱离浏览器就能测：

```ts
// utils/deck.ts
export function deckState(index: number, total: number): { scale: number; opacity: number } {
  const depth = total - 1 - index;
  return { scale: 1 - depth * 0.035, opacity: Math.max(0.45, 1 - depth * 0.15) };
}
```

配 `utils/__tests__/deck.spec.ts`（Vitest）：`total = 4` 时四张卡的 scale 递减且都 ≤ 1、
最后一张恒为 `{ scale: 1, opacity: 1 }`。**GSAP 参数变了，这条测试会先红**，
比肉眼盯动画可靠。

---

## 5. 模块三：Hero 终端输入动效

### 5.1 现状

`Home.vue` 的 `.code-window` 已经有 10 行 `.code-line`，光标 `.code-cursor` 已有
`@keyframes blink` 无限闪烁。所以这是**改造**：给已有的 10 行加错峰显现，不新建组件。

### 5.2 参数

- 逐行显现：`from({ opacity: 0, x: -6 })`，`stagger: 0.07`，`duration: 0.35`，`ease: "power2.out"`；
- 10 行合计 ≈ **1.0s**，符合初版"1–2 秒内"的要求；
- 光标不动（已经在闪），动画结束后不加任何循环；
- **不做逐字打字机**：中英混排逐字出现会让 10 行读起来像加载卡顿，
  而且延迟核心内容阅读，与"动效服务于展示逻辑"直接冲突。

### 5.3 不能给 Hero 标题加动画

`h1`（"把复杂的问题，写成清晰的代码"）是 LCP 元素。给它加 `opacity: 0 → 1`，
浏览器会等到它可见才记 LCP，等于**人为把 LCP 推迟 1 秒**，SEO 和体感双输。

所以：`h1`、`.hero-description`、`.hero-actions` 全部保持首帧可见，只动代码窗。

### 5.4 防闪烁

GSAP 与 Home 在同一个 chunk（静态 import），`onMounted` 里执行 `from()`，
此时浏览器还没绘制，不会出现"先看见再消失"。

**不要**改成动态 import —— 一旦 GSAP 在首次绘制之后才到位，
10 行代码会先完整显示、再跳回透明重放一遍。

---

## 6. 模块四：项目详情页

### 6.1 路由

```ts
{
  path: "/work/:id",
  name: "work",
  component: () => import("../views/WorkDetail.vue"),
  meta: { title: "项目案例" },
}
```

- 共 6 条路由；`/work/*` 不在 `adm.zrocks.me` 的独占名单里，两个域名都能访问（符合预期）；
- Nginx 不需要改：SPA fallback 已经覆盖（`/blog/:id` 同理）；
- `id` 不存在 → 在组件内渲染与 404 同款的 `empty-state`，**不要**跳回首页（用户会以为链接坏了）。

标题：`router.afterEach` 用静态 `meta.title`，详情页在 `onMounted` 里覆盖成
`document.title = `${detail.name} · DEV.LOG``。`afterEach` 先于组件挂载执行，所以组件里的赋值是最终值。

### 6.2 数据模型

`Project` 保持精简（首页只需要摘要），详情另立类型：

```ts
// types/index.ts 追加
export interface WorkStep {
  key: string;
  title: string;      // 步骤名，如「通用内核」
  caption: string;    // 该步骤的解释文案
}

export interface WorkDetail {
  id: string;
  name: string;
  tagline: string;                 // 一句话定位
  stack: string[];
  links: Project["links"];
  visual: Project["visual"];       // Hero 区复用首页视觉
  problem: { heading: string; body: string[] };
  core: {
    heading: string;
    visual: "plugin-arch";         // 注册表 key，决定用哪个动效组件
    steps: [WorkStep, WorkStep, WorkStep];
  };
  tech: { heading: string; points: { title: string; body: string }[]; snippet?: { lang: string; code: string } };
  result: { heading: string; body: string[] };
}
```

文件组织：

```
frontend/src/data/works/
├── index.ts              # 显式注册表：{ "campus-assistant": campusAssistant }
└── campus-assistant.ts   # 导出 WorkDetail
```

**用显式注册表而不是 `import.meta.glob`**：`glob` 的类型是 `Record<string, () => Promise<unknown>>`，
拿回来还得断言一遍；显式表让 `Record<string, WorkDetail>` 在编译期就锁死，
漏写一个 id 直接 `vue-tsc` 报错。

### 6.3 五个区块

| 区块 | 内容 | 动效 |
|---|---|---|
| Hero | 名称、tagline、技术栈、视觉图（复用首页 `--vs` 体系放大） | 淡入 12px 上移，0.5s，一次性 |
| 问题背景 | 2–3 段文字 + 「每校一套代码 vs 一套内核」对比示意 | 无（读文字时不要动） |
| 核心架构 | 三步骤动效（见第 7 节） | 滚动分步 |
| 技术要点 | 3 条要点 + 一段代码（插件接口定义） | 无 |
| 成果入口 | 下载 / 源码 / 镜像三个按钮 | 无 |

技术要点里的代码片段**不要**引入 `highlight.js` 新实例 —— 文章页已经在用，
详情页用同一套 `utils/markdown.ts` 里的高亮配置，或者干脆纯 `<pre><code>` 手写着色类名
（`.syntax-purple` 等已在 `main.css` 里）。前者会多拉 192 KB 的 chunk，不值得。

### 6.4 模板化

`WorkDetail.vue` 只做三件事：取数据、渲染骨架、把 `core.visual` 交给注册表。

```ts
// components/work-visuals/registry.ts
export const coreVisuals: Record<WorkDetail["core"]["visual"], Component> = {
  "plugin-arch": defineAsyncComponent(() => import("./PluginArch.vue")),
};
```

后续加项目 = 加一个 `data/works/xxx.ts` + （可选）一个视觉组件。
**结构骨架不动，只换核心动效** —— 这是初版"模板化"诉求的落地方式。

`WorkDetail["core"]["visual"]` 是字面量联合类型，新增 key 时注册表不补会编译报错，
比运行时 "组件未找到" 的白屏可靠。

---

## 7. 模块五：插件架构分步动效

### 7.1 三步状态机

| 步骤 | 画面 | 文案（示例） |
|---|---|---|
| 0 | 内核居中，四周空 | 「统一课表内核：周视图、单双周、节次时间，只写一次」 |
| 1 | 4 个插件方块从四角滑入，连线亮起 | 「插件负责取数：教务 URL、字段映射、真实作息都写在 `.js` 里」 |
| 2 | 内核高亮外扩，方块打勾 | 「换学校 = 换插件，内核一行不改」 |

### 7.2 为什么用离散状态而不是 scrub

初版写的是"滚动进度对应三个阶段"，实现上有两种做法：

- **scrub（逐帧）**：`gsap.timeline({ scrollTrigger: { scrub: true } })`。
  快速滚动时会停在"插件滑到一半"的画面 —— 用户看到四个方块卡在屏幕边缘，
  这是纯粹的视觉事故，且和"可跳过"的要求矛盾。
- **离散状态 + CSS 过渡**（本方案）：进度只在跨过 0.33 / 0.66 阈值时切类名，
  方块用 `transition: transform .5s ease` 自己走完。快速滚动 = 直接落到最终态，画面永远完整。

```ts
const track = trackEl.value;
ScrollTrigger.create({
  trigger: track,
  start: "top 65%",
  end: "bottom 45%",
  onUpdate: (self) => {
    const step = self.progress < 0.34 ? 0 : self.progress < 0.67 ? 1 : 2;
    if (step !== current) { current = step; trackEl.value.dataset.step = String(step); }
  },
});
```

CSS 侧：

```css
.plugin-chip { transform: translate(var(--x), var(--y)) scale(.9); opacity: .3; transition: transform .5s ease, opacity .5s ease; }
[data-step="1"] .plugin-chip,
[data-step="2"] .plugin-chip { transform: translate(0, 0) scale(1); opacity: 1; }
[data-step="2"] .plugin-chip::after { content: "✓"; opacity: 1; }
```

文案与画面同步：三个 `caption` 都在 DOM 里，只有 `[data-step]` 匹配的那条 `opacity: 1`，
其余 `.35`。用户滚到哪一步，读到的就是哪一步的说明。

### 7.3 可访问性

- 动效区加 `aria-hidden="true"`，三步文案用 `<ol>` 正常渲染（屏幕阅读器读的是文案，不是动画）；
- `prefers-reduced-motion` 时 `data-step` 直接置 `2`（最终态），不做过渡；
- 不做自动播放：不滚动就停在 step 0，页面静止时不消耗 CPU。

---

## 8. 模块六：视觉规范

### 8.1 新增 5 个 token

`main.css` 现在颜色全是硬编码（2700 行）。**不做全量重构**，只给新代码加 token，
`:root` 追加：

```css
--card-radius: 10px;
--card-border: #e0e5d7;
--card-bg: #fdfdf9;
--card-shadow-rest: 0 1px 2px #26372e0a;
--card-shadow-deck: 0 24px 60px -22px #26372e2e;
```

堆叠卡用 `--card-shadow-deck`（大范围、低透明度，符合"空气感"），普通卡用 `--card-shadow-rest`。

### 8.2 卡片参数表（四张卡必须完全一致）

| 项 | 值 |
|---|---|
| 圆角 | `--card-radius`（10px） |
| 边框 | `1px solid var(--card-border)` |
| 内边距 | `28px 30px`（≥1100px）/ `20px`（≤800px） |
| 视觉图高度 | `46%` 卡片高（由 `--visual-h` 推导，不写死 px） |
| 标题字号 | 26px / 600（≥1100px），20px（≤800px） |
| 描述 | 13px / 行高 1.85，**最多 2 行**，`-webkit-line-clamp: 2` |
| 亮点 | 12px，前置 `·`，三条一行排完 |
| 标签 | 沿用 `.tag`，不新增样式 |

### 8.3 字体

- **删掉 Google Fonts `@import`**（见 1.1）；
- 正文 / UI 保持系统无衬线栈，不动；
- 若确实要"展品式标题"，只对**拉丁展示字**用衬线：序号 `01 / 04`、`SELECTED WORK`、
  `DEV.LOG` 字标。选一个拉丁子集（如 Instrument Serif，OFL，约 15–20 KB woff2），
  放 `frontend/public/fonts/`，`@font-face { font-display: swap; }`；
- **中文标题不换字体**。理由见 0 节第 4 条。

### 8.4 影调

没有截图，所以"统一调色层"这件事暂时不适用。将来加截图时：图片外包一层
`::after { background: #f7f8f3; mix-blend-mode: multiply; opacity: .08 }`，
不要对图片本体做 `filter: saturate(.9)` —— 前者可撤销，后者会把截图里的品牌色一起洗掉。

---

## 9. 依赖与体积预算

```bash
npm install gsap lenis --prefix frontend
npm install -D vitest --prefix frontend
```

| 项 | 预算 | 测量方式 |
|---|---|---|
| Home chunk 增量 | ≤ 45 KB gz | `npm run build` 输出里 `Home-*.js` 的 gzip 值 |
| 新增独立 chunk | gsap 与 lenis 允许进 Home chunk，**不要**进入口 `index-*.js` | 同上，看 `index-*.js` 是否变大 |
| LCP | ≤ 2.5s（4G 模拟） | DevTools Performance，LCP 元素应为 `h1` |
| CLS | 0（pin-spacer 不得引起位移） | DevTools Performance |
| 滚动帧率 | 无明显掉帧 | Performance 面板录一次完整滚动 |

入口 chunk 目前 149 KB（vue + router + axios）。如果发现 gsap 被 Rollup 提到入口，
在 `vite.config.ts` 加 `build.rollupOptions.output.manualChunks` 把它按路由切开。

---

## 10. 分期实施

### 阶段一：底座（改动小，风险低，先合）

| 文件 | 改动 |
|---|---|
| `styles/main.css` | 删 `@import`；`:root` 加 5 个 token；新增 `.deck*` 基础布局 |
| `composables/useSmoothScroll.ts` | 新建，Lenis 单例 + `getLenis()` + 降级判断 |
| `App.vue` | `onMounted` 初始化 Lenis，`onBeforeUnmount` 销毁 |
| `router/index.ts` | `scrollBehavior` 改走 Lenis |

验收：锚点跳转不弹回；`prefers-reduced-motion` 下完全无平滑；移动端手感与现在一致。

### 阶段二：Card-Deck

| 文件 | 改动 |
|---|---|
| `utils/deck.ts` + `utils/__tests__/deck.spec.ts` | 新建，纯函数 + 单测 |
| `views/Home.vue` | 卡片改 `<RouterLink>`、平铺亮点、删 `expanded`；`onMounted` 建堆叠 |
| `styles/main.css` | `.deck-card` / `.deck-link` / `.deck-copy` / `.deck-cta`；删 `.project-details` |

验收：桌面端四张卡逐张覆盖、总滚动 ≈ 2.3 屏；≤800px 是普通纵向列表；
返回首页后页面不被顶歪。

### 阶段三：Hero + 详情页

| 文件 | 改动 |
|---|---|
| `views/Home.vue` | `.code-line` 错峰显现（`gsap.matchMedia` 包裹） |
| `types/index.ts` | 追加 `WorkDetail` / `WorkStep` |
| `data/works/index.ts`、`data/works/campus-assistant.ts` | 新建 |
| `views/WorkDetail.vue` | 新建，五区块骨架 |
| `components/work-visuals/PluginArch.vue`、`registry.ts` | 新建 |
| `router/index.ts` | 加 `/work/:id` |

验收：`/work/campus-assistant` 可直达；三步骤随滚动推进且文案同步；
快速滚动直接到最终态；`/work/unknown` 显示 404 态。

### 阶段四：打磨

- 性能三项（LCP / CLS / 帧率）实测回填到第 9 节表格；
- 手工验收清单逐条过（见第 11 节）；
- 同步文档：`docs/ARCHITECTURE.md` 前端结构一节补 `/work/:id` 与 `data/works/`；
  `docs/README.md` 文档清单加本文；`README.md` 路由表补一行。

---

## 11. 验收清单

**自动化**

- [ ] `npm run typecheck` 通过（`WorkDetail` 类型与注册表 key 对齐）
- [ ] `npm run build` 通过，Home chunk 增量 ≤ 45 KB gz
- [ ] `npm run test` 通过（`deck.spec.ts`）
- [ ] 入口 `index-*.js` 体积未增长

**手工（桌面 1440 / 平板 900 / 手机 390）**

- [ ] 四张卡圆角、边框、内边距、标题字号完全一致，无参差
- [ ] 堆叠切换无明显掉帧；卡片文字始终完整可读，不被下一张压住
- [ ] 每张卡整卡可点，跳转到对应 `/work/:id`
- [ ] 从详情页返回首页，滚动位置与卡片状态正常，无空白屏
- [ ] `#projects` / `#contact` 锚点跳转不弹回、不被头部遮挡
- [ ] Hero 代码逐行显现 ≤ 1.5s，`h1` 首帧即可见
- [ ] 详情页三步骤：滚到哪一步读到哪一步的文案
- [ ] 快速甩动滚动条，详情页动效直接到最终态，不卡在半截
- [ ] `/work/not-exist` 显示 404 态而非白屏
- [ ] 系统开启"减少动态效果"后：无平滑滚动、无堆叠、无入场，内容全部可见可读
- [ ] 手机端堆叠完全关闭，卡片为普通纵向列表
- [ ] 键盘 Tab 能依次聚焦四张卡与三个下载链接，焦点可见
- [ ] 控制台无 CSP 违规、无 ScrollTrigger 警告

---

## 12. 风险与回滚

| 风险 | 应对 |
|---|---|
| 堆叠区在某些浏览器上 pin 错位 | `pinSpacing: false` + `endTrigger` 已规避；上线后如出现，`mm.add` 里把宽度阈值提到 1101px，等于只在宽屏启用 |
| Lenis 与 pin 抖动 | 已限定桌面 + `syncTouch: false`；最坏情况注释掉 `useSmoothScroll` 的初始化，其他动效不依赖它也能跑 |
| 详情页动效拖慢首屏 | 详情页是独立 chunk，`PluginArch` 再 `defineAsyncComponent` 一次，首屏只加载骨架 |
| 动效"用力过猛" | 三条硬约束：只动 `transform` / `opacity`；单页动效不超过 3 处；不给正文加动画 |
| 需要紧急回退 | 站点是"版本目录 + 软链接"，`./deploy/rollback.sh` 一条命令回上一版；代码侧 `git revert` 对应提交即可 |

---

## 13. 明确不做的事

- **不做 MP4 / 视频背景** —— 初版已否决，保持否决；
- **不做 3D / WebGL** —— 与"工程感"气质不符，且首屏成本太高；
- **不做暗色模式** —— 是独立议题，混进本次会拖长验收周期；
- **不做全站动效** —— 博客列表、文章页、后台一律不动；
- **不给 4 个项目各做一套首页叙事** —— 首页只负责摘要，深度全在详情页；
- **不为动效放宽 CSP** —— 见 1.3，不需要。

---

## 附：与初版的对应关系

| 初版章节 | 本方案对应 |
|---|---|
| 五、主页方案 5.1 Card-Deck | 第 4 节 |
| 5.2 Lenis 平滑滚动 | 第 3 节 |
| 5.3 Hero 终端输入动效 | 第 5 节 |
| 六、Flutter 详情页 | 第 6、7 节 |
| 6.6 详情页模板化 | 6.4 注册表 |
| 七、视觉规范与排版 | 第 8 节 |
| 八、实施计划 | 第 10 节（细化为文件级） |
| 九、风险与应对 | 第 12 节 |
| 十、验收标准 | 第 11 节（拆成可勾选条目） |

---

## 14. 实施记录（2026-10-18）

### 14.1 对方案本身的 9 处修正

写代码时发现方案里有几处会直接踩坑或自相矛盾，实施时按修正后的做法：

| # | 方案原文 | 问题 | 实际做法 |
|---|---|---|---|
| 1 | 6.2 只给 `campus-assistant` 建详情数据，4.2 却让**每张卡**都链到 `/work/${id}` | 另外 3 张卡点进去是 404，正好踩中方案自己说的"用户会以为链接坏了" | 四个项目全部建详情（`data/works/` 四个文件 + 注册表），内容全部由 `projects.ts` 里已公开的描述 / 亮点展开，不编新数字 |
| 2 | 4.4 GSAP 用 `opacity: 0.45`，4.7 的 `deckState()` 却算出 `1 - depth*0.15` | 两套数字不一致，4.7 那条单测根本测不到 GSAP 实际用的参数 | GSAP 改为直接读 `deckState(index, cards.length)`，单测与线上同一来源 |
| 3 | 3.2 ③ 写"`lenis?.destroy()` 只在离开首页时销毁"，同节又建议"Lenis 挂在 App.vue（全站一份）" | 两句话互相矛盾，照做会让全站平滑滚动在离开首页后失效 | Lenis 只在 `App.vue` 初始化/销毁；`Home.vue` 卸载时只 revert 自己的 matchMedia 与 ScrollTrigger |
| 4 | 4.6 写"`.deck-card { opacity: 0 }` 只在小屏生效（用媒体查询包住）"，但代码块没包 | 桌面端会被 CSS 的 `opacity: 0` 压住 GSAP 的 0.45 | 入场规则整段放进 `@media (max-width: 800px)`，并且只在 `.deck.is-motion` 下生效 |
| 5 | 3.2 ② 用 `getLenis()?.scrollTo(el)` 处理锚点 | **实测**：目标元素刚挂载时 `lenis.scrollTo` 静默失败（点了没反应），深链 `/#projects` 也停在顶部 | 锚点改走原生 `window.scrollTo({ behavior: 'smooth' })`，Lenis 只负责滚轮阻尼；实测落点正好避开 84px 吸顶头部 |
| 6 | 未提深链 | 直接打开 `/#projects`，浏览器原生锚点滚动早于路由组件挂载 | `App.vue` 增加带重试的 `scrollToInitialHash`（最多 6 次 × 120ms） |
| 7 | 4.4 未提卡片定位 | pin 会把当前卡变成 `position: fixed`，定位元素绘制在静态元素之上——后面的卡会**钻到下面**而不是压上来 | `.deck-card { position: relative }`，让所有卡同处定位层，绘制顺序回到 DOM 顺序 |
| 8 | 10 阶段三只写"加 vitest" | 没有接进 `scripts/verify.sh`，CI 永远不会跑这条测试 | `frontend` 加 `test` 脚本并把 `npm test` 写进 `verify.sh` 前端段 |
| 9 | 6.3 技术要点里要放代码片段 | 只有校园助手的插件接口能如实描述，其余三个项目没有可公开的接口形状 | `snippet` 设为可选：只给校园助手一段**标注"示意"**的插件形状，其余三项不写，避免编造代码 |

### 14.2 实测数据

用 headless Chrome + CDP 实测（1440×1000 / 390×844，虚拟时间与真实滚动都试过）：

| 项目 | 预算 | 实测 |
|---|---|---|
| Home chunk 增量 | ≤ 45 KB gz | **4.53 KB gz**（`Home` 10.57 KB，视觉图另拆 `ProjectVisual` 1.05 KB） |
| GSAP / ScrollTrigger | 不进入口 | 独立 chunk `ScrollTrigger` 112.83 KB / **44.35 KB gz**，只在首页与详情页加载 |
| 入口 `index-*.js` | —— | 149.74 → **171.77 KB**（+6.4 KB gz）：Lenis 是全站单例，随 `App.vue` 进入口，符合预期 |
| 详情页 chunk | 独立加载 | `WorkDetail` 13.27 KB / **6.41 KB gz**（含四份案例数据） |
| CSS | —— | 37.45 → 43.91 KB（+1.5 KB gz） |

行为验证（CDP 驱动真实滚动）：

- 卡片堆叠：3 个 `pin-spacer`（最后一张不 pin），滚到 `scrollY=1986` 时四张卡 opacity = `[0.759, 0.909, 1, 1]`、scale = `[0.944, 0.979, 1, 1]` —— 与 `deckState()` 完全一致。
- 三步动效：`data-step` 随滚动 `0 → 1 → 2`，四块插件 chip 的 opacity 到 `1`。
- 减少动态效果：`pin-spacer = 0`、所有卡片 `opacity = 1`、`transform = none`、详情页直接 `data-step = 2`、滚轮一步到位（无缓动）。
- 移动端 390px：`pin-spacer = 0`，卡片为纵向列表，整卡可点。
- 锚点：跨页点「项目作品」与直接打开 `/#projects`，落点都是 `gap = 100px`（避开 84px 头部）。
- 详情页往返：`/work/*` 打开时 `pin-spacer = 0`（旧触发器已销毁），`history.back()` 回首页后 `pin-spacer` 重建为 3、滚动位置恢复到 `1037`。

### 14.3 仍需人工过一遍的条目

自动化覆盖不到视觉与手感，第 11 节里这些还需要人眼确认：

- 四张卡的圆角 / 边框 / 内边距 / 标题字号是否完全一致（1440 / 900 / 390 三档）；
- 堆叠切换的观感与帧率（本机 headless 无 GPU，测不出真实帧率）；
- Hero 代码逐行显现的节奏（0.07s × 10 行，合计约 1.0s）；
- 键盘 Tab 的焦点顺序与可见性；
- LCP ≤ 2.5s（本机没有 4G 模拟环境）。

