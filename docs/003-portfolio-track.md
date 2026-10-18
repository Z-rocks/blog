# 003 · 首页项目轨道（散落 → 收束 → Coverflow 聚焦）

> 本文替代 [002](002-portfolio-motion-plan.md) 第 4 节的主页实现：Card-Deck 堆叠已被
> 项目轨道取代，其余判断（Lenis、Hero 动效、详情页、降级原则）沿用 002。
>
> 状态：**已实施**。

---

## 1. 形态

一段 pin 住的滚动编排，由同一条进度 `p`（0 → 1）驱动三幕：

| 阶段 | 进度区间 | 画面 |
|---|---|---|
| 爆炸散落 | `0 → 0.18` | 四张卡从中心叠放炸开，散到椭圆环上的固定伪随机位置，各自带 ±7° 旋转与 0.62–0.70 缩放 |
| 收束 | `0.18 → 0.45` | 横向先归位、纵向后落平，最后收成一条水平轨道（完整尺寸、旋转归零） |
| 水平聚焦 | `0.45 → 1` | 轨道向左行进，每张卡依次经过聚焦线（视口 38% 处）；右侧文字层同步换页 |

`pin` 总滚动 **300vh**（002 里 Card-Deck 是 234svh；三段编排需要更多预算，但仍在"两屏多"以内）。

## 2. 参数

| 项 | 值 | 说明 |
|---|---|---|
| 卡片尺寸 | `min(480, max(300, 舞台宽 × 0.36))` × 0.66 | 1440 下 425×280 |
| 间距 pitch | 卡片宽 + `min(120, 舞台宽 × 0.08)` | 1440 下 519 |
| 聚焦线 | 舞台宽 × 0.38 | 让右侧文字层有位置，也避开头部 |
| 景深 | 相邻一张：`rotateY 16°`、`translateZ -90px`、`scale -10%`、`opacity -42%` | 上限 `rotateY 22.4°` / `z -180` / `opacity 0.18` |
| 高光 | `1 - |距离|/pitch × 1.8`，在 0.555 个 pitch 外归零 | 由类开关 + CSS 过渡，不逐帧写 `box-shadow` |
| 文字层位置 | `right: 6%`，宽 `min(300px, 26vw)`，垂直居中 | 宽屏不压聚焦卡 |
| 文字层切换 | 淡出 180ms → 间隙 180ms → 淡入 220ms | `copyShown` / `copyIn` 两个状态 + 180ms 定时器 |
| 右侧渐隐 | `width: calc(6% + 450px)`，最后 60px 柔化 | 只在横移阶段出现，末尾几张从文字层下方经过时被纸色吃掉 |

## 3. 数据结构

全部几何在 `frontend/src/utils/track.ts`，都是 `p` 的纯函数，页面只负责写 `style`：

```ts
scatterLayout(total)            // 固定种子的散落布局（归一化坐标，±1 内）
coverflowState(distance, pitch) // 距离 → 倾斜 / 后退 / 缩小 / 透明度 / 高光
travelAt(progress, total)       // 横移量（第几张卡在聚焦线上）
focusIndexAt(progress, total)   // 当前聚焦索引
trackFrame(progress, i, n, m)   // 单卡完整帧
```

- **不读 DOM**：滚动过程中只写 `transform` / `opacity` / `z-index`，尺寸只在 setup 与
  `onRefreshInit` 量一次，避免每帧强制排版。
- **单测**：`utils/__tests__/track.spec.ts` 覆盖散落边界与两两距离、景深对称与单调、
  三个阶段的关键帧（中心 / 散落 / 轨道 / 最后一个聚焦点）、索引单调性。

## 4. 交互与可访问性

- 整卡是 `<RouterLink>`，`aria-label` 带序号；悬停时卡片上浮 8px（由 JS 在每帧的 `y` 里加，
  避免和 JS 写的 `transform` 打架）并露出「查看案例」。
- 文字层 `aria-live="off"`：内容随滚动变，但不会打断屏幕阅读器。
- 标题常显在卡片底部信息条里，不依赖 hover 才能看到项目名（初版方案要求 hover 才显示，
  这里刻意保留常显——四张卡散落时没有任何标签会让人不知道自己在看什么）。

## 5. 降级

| 条件 | 行为 |
|---|---|
| 视口 < 801px | 不建 `pin`、不建 3D；两列栅格（≤540px 一列），标题与描述常显 |
| `prefers-reduced-motion: reduce` | 同上，且文案层不出现；卡片 `opacity: 1`、无 `transform` |
| 没有 JS | 轨道卡在 DOM 里是普通栅格，不会白屏（`is-enhanced` 由 JS 添加） |

## 6. 实测（headless Chrome + CDP，1440×1000）

| 项 | 结果 |
|---|---|
| pin 结构 | 1 个 `pin-spacer`，pin 高度 `100svh − 84px` |
| 收束完成帧 | 四张卡等距 `pitch`，`rotateY 0`、`scale 1`、`opacity 1` |
| 聚焦帧（p=0.62） | 聚焦卡在第 2 张，`rotateY -1.18°`、`translateZ -6.6px`、`opacity 0.97`；左侧上一张 `+14.8°`、`opacity 0.61` |
| 文字层切换 | 换页瞬间 `opacity 0.36 / is-in=false`，400ms 后新标题 `opacity 1` |
| 减少动态效果 | `pin-spacer = 0`、无内联 `transform`、文字层 `display: none` |
| 移动端 390px | `pin-spacer = 0`，单列栅格 |
| 详情页往返 | 进详情页 `pin-spacer = 0`，返回后重建为 1 并恢复滚动位置 |
| 体积 | `Home` 13.75 KB（gz 6.00），`ScrollTrigger` 独立 chunk 44.35 KB gz |

## 7. 与初版总结的差异

| 初版要求 | 本实现 |
|---|---|
| 滚动吸附 | **不做**：Lenis + scrub + snap 三个控制器抢同一个滚动 |
| 卡片 hover 才显示标题 | 标题常显，hover 只负责上浮与露出 CTA |
| 逐帧 `box-shadow` 发光 | 类开关 + CSS 过渡（`box-shadow` 逐帧写是绘制负担） |
| 文字层微视差（卡片垂直中心差 × 0.15） | **未做**：轨道是一行等高的卡，差值恒为 0，公式会退化成常量；悬浮感由入场 `translateY` 提供 |
| 「查看更多」卡片 | **暂不做**（无项目列表页）；当前 4 个项目全部有详情页 |
| 场景截图片 | 仓库没有截图素材，继续用 CSS 视觉 |
| 中文衬线标题 | 只用拉丁衬线（`--display`），中文维持系统无衬线 |
