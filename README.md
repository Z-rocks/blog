# DEV.LOG

> 一个自己写、自己部署的全栈个人站点：**作品集 + 技术博客**。
> 前端 Vue 3，后端 NestJS，数据在 MySQL，推 `main` 自动发布到阿里云。

<p>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white">
  <img alt="Vue" src="https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white">
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white">
  <img alt="MySQL" src="https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue">
</p>

**在线访问**：<https://zrocks.me> ｜ [作品集](https://zrocks.me/) · [技术文章](https://zrocks.me/blog) · [管理登录](https://zrocks.me/login)

> 后台目前仍与前台同域。`adm.zrocks.me` 这个独立后台域名（Nginx 域名隔离 + 一层 HTTP Basic Auth）已在仓库里配好，上线步骤见 [deploy/deploy.md](deploy/deploy.md) §5.2。HTTPS 已用 Let's Encrypt 证书，HSTS 待开启。Gitee 镜像：<https://gitee.com/zrocks/blog>

---

## 目录

- [为什么做这个](#为什么做这个)
- [功能](#功能)
- [技术栈](#技术栈)
- [架构](#架构)
- [目录结构](#目录结构)
- [快速开始](#快速开始)
- [文档](#文档)
- [几个值得说明的取舍](#几个值得说明的取舍)
- [手工验收清单](#手工验收清单)
- [已知限制](#已知限制)
- [后续计划](#后续计划)
- [开源协议](#开源协议)
- [联系](#联系)

---

## 为什么做这个

简历是一张静态 PDF：写不下"为什么这么设计"，也放不了跑得起来的代码。

所以干脆自己做一个：**一个能长期写下去的地方**，顺便把"能不能独立把一个东西从零做到上线"这件事变成可验证的——不是截图，是能点开的地址和能读的源码。

它同时是三个东西：

| 身份 | 说明 |
|---|---|
| **作品集** | 首页项目卡片，每个项目写清楚做了什么、难点在哪、技术选择为什么 |
| **技术博客** | 长文写作 + Markdown 渲染 + 标签分页，用来沉淀工程复盘 |
| **一个完整的全栈练习** | 单人内容管理、JWT 鉴权、CI/CD、版本回滚、安全加固，全链路自己实现 |

**刻意不做的事**：不做注册、多用户、角色权限、评论、点赞、浏览量、搜索、文件上传。
单人站点的复杂度应该花在"内容"和"可靠性"上，而不是给自己造一个 CMS。

---

## 功能

### 前台

| 页面 | 内容 |
|---|---|
| `/` 首页 | 一句话定位、项目卡片（描述 + 三条亮点 + 技术标签 + 仓库 / 镜像 / 发布页链接）、最新三篇已发布文章 |
| `/blog` 文章列表 | 分页 + 标签筛选，**筛选状态保存在 URL 查询参数里**，刷新和分享都不丢 |
| `/blog/:id` 文章详情 | Markdown 渲染、代码高亮、加载 / 失败 / 404 状态 |

项目卡片的数据全在 `frontend/src/data/projects.ts`：姓名、定位、联系方式、每个项目的名称 / 描述 / 亮点 / 标签 / 外链都在这里维护。卡片序号与总数由数组长度推导，新增作品只需追加一项；空链接不会渲染成不可用按钮。`visual` 字段决定卡片视觉（`browser` / `terminal` / `flow` / `mobile`），四种视觉统一由 `--vs` 与 `--visual-h` 两个变量控制缩放，断点只改变量、不覆写 `transform`。

### 后台（单人）

| 能力 | 说明 |
|---|---|
| 登录 | 账号密码 → JWT（HS256，7 天）；无用户表，管理员从环境变量读取 |
| 写作台 | `/admin/edit` 单页完成新建 / 编辑 / 删除，左侧分页切换文章 |
| 草稿 / 发布 | 草稿只在后台可见；发布后才进首页与列表 |
| 安全兜底 | 未保存离开提醒、删除二次确认、401 自动清 token 回登录页 |
| 域名隔离 | 前台与后台共用一份构建产物，`/login`、`/admin/*`、`/api/admin/*` 由 Nginx 限定只在 `adm.zrocks.me` 上可达 |

### 工程侧

- **CI**：三条流水线——PR 门禁（类型检查 + 两端构建 + 后端接口测试）、发布流程、安全扫描（依赖审计 + CodeQL），校验命令只有 [`scripts/verify.sh`](scripts/verify.sh) 一份
- **版本化发布**：`/var/www/devlog-releases/<版本ID>/` + 软链接，一条命令回滚到任意历史版本
- **测试**：后端参数化接口测试（Jest + supertest）跑在**真实 MySQL** 上，覆盖草稿泄漏、正文外泄、标签匹配、鉴权与 DTO 校验
- **安全**：Markdown 两层过滤 + CSP 收紧到 `self` + 登录按 IP 限流 + 真实 HTTP 状态码

---

## 技术栈

| 层 | 选型 | 为什么 |
|---|---|---|
| 前端 | Vue 3 Composition API + TypeScript + Vite | 组件化够用、构建快；不用 UI 框架，页面是手写 CSS |
| 路由 | Vue Router 4 | 5 条路由 + 一条全局守卫，`createWebHistory` |
| 请求 | Axios | 一个实例 + 两个拦截器：注入 token、剥响应壳、401 清理 |
| 渲染 | markdown-it → highlight.js → DOMPurify | 先禁用原始 HTML，渲染完再清洗一遍 |
| 后端 | NestJS 11 + TypeORM 0.3 | 模块 / 守卫 / 拦截器 / 管道齐全，约束天然落位 |
| 数据库 | MySQL 8.0（utf8mb4） | `post` 一张表，标签用 JSON 列 + `JSON_CONTAINS` |
| 鉴权 | JWT（passport-jwt）+ bcrypt(cost 12) | 无会话、无用户表，单管理员从环境变量注入 |
| 校验 | class-validator + class-transformer | DTO 白名单，多余字段直接 400 |
| 测试 | Jest + supertest | 接口测试打在真实 MySQL 上，而不是 mock 掉仓储 |
| 部署 | Nginx + systemd + GitHub Actions | 静态托管 + `/api` 反代；发布脚本在服务器上跑 |

运行时只依赖 Node 22 + MySQL，**前端不加载任何远程字体、脚本或样式**，所以 CSP 能收到 `default-src 'self'`。

---

## 架构

```
                     ┌─────────────────────────────────────────┐
   浏览器  ────────▶ │  Nginx :80/:443                         │
                     │  ├─ /            静态文件（Vue 构建产物）│
                     │  ├─ /assets/     长缓存                 │
                     │  └─ /api/  ────┐ 反向代理 + 登录限流     │
                     └────────────────┼────────────────────────┘
                                      ▼
                     ┌─────────────────────────────────────────┐
                     │  NestJS :3000  (systemd 常驻)           │
                     │  JwtAuthGuard → ValidationPipe          │
                     │  → PostService → TypeORM                │
                     │  统一响应：TransformInterceptor          │
                     │  统一异常：HttpExceptionFilter           │
                     └────────────────┬────────────────────────┘
                                      ▼
                     ┌─────────────────────────────────────────┐
                     │  MySQL 8.0   blog.post                  │
                     └─────────────────────────────────────────┘

   发布链路：git push main → GitHub Actions → tar/scp → 服务器脚本
             → releases/<版本ID> → 切换软链接 → 健康检查 → 失败自动回滚
```

一次"读文章"的完整链路：

```
Post.vue → api/post.ts → axios(/api/posts/2)
        → Nginx /api/ → NestJS PostController
        → PostService.detail(2, publishedOnly=true)
        → TypeORM 查 post 表（草稿与不存在都返回 404）
        → HttpExceptionFilter 包装错误 / TransformInterceptor 包 {code,message,data}
        → 前端拦截器剥壳 → renderMarkdown() → DOMPurify → v-html
```

公开站与后台**共用同一份 `frontend/dist` 与同一个后端进程**——隔离只做在 Nginx 与接口层：`zrocks.me` 上 `/login`、`/admin/*` 由 Nginx 直接返回 404，`adm.zrocks.me` 才有完整路由并额外套一层 Basic Auth。前端因此不需要知道自己被哪个域名服务，本地开发（`localhost:5173`）也不需要任何特殊分支。

细节见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

---

## 目录结构

```
frontend/                    Vue 3 前端
├── src/views/               5 个页面：Home / BlogList / Post / Login / AdminEdit
├── src/api/                 request.ts（拦截器）+ post.ts（接口函数）
├── src/data/projects.ts     ★ 作品集数据：定位、联系方式、项目卡片都在这里
├── src/utils/markdown.ts    Markdown 安全渲染（markdown-it + highlight.js + DOMPurify）
├── src/styles/main.css      手写样式（无 UI 框架）
└── vite.config.ts           /api 开发代理

backend/                     NestJS 后端
├── src/post/                文章模块：entity / dto / service / controller
├── src/auth/                登录与 JWT 策略
├── src/common/              守卫、拦截器、异常过滤器、装饰器
├── src/config/db.config.ts  数据库配置（含生产环境 DB_SYNC 保护）
└── test/posts.e2e-spec.ts   接口测试（Jest + supertest，跑真实 MySQL）

deploy/                      部署
├── deploy.md                部署手册（从裸机到上线，含 adm 子域名上线步骤）
├── deploy.sh / rollback.sh  手动发布 / 回滚
├── nginx.conf               站点配置（gzip / CSP / 限流 / 反代 / 域名隔离）
└── remote/deploy-remote.sh  服务器侧：stage → activate

scripts/verify.sh            发布与 PR 共用的校验入口
docs/                        架构 / 接口 / 开发 / 安全四份文档
.github/workflows/           ci.yml（PR 门禁）、deploy.yml（发布）、security.yml（扫描）
```

---

## 快速开始

需要 **Node 22+**、**MySQL 8.0+**。

```bash
# 1. 后端
cd backend
npm ci
npm run hash-password      # 生成管理员密码哈希（bcrypt cost 12）
openssl rand -hex 32       # 生成 JWT_SECRET
# 按 docs/DEVELOPMENT.md 创建 backend/.env
npm run dev                # http://localhost:3000/api

# 2. 前端（另开终端）
cd frontend
npm ci
npm run dev                # http://localhost:5173
```

浏览器只访问相对路径 `/api`，由 Vite 代理到后端，前端代码里没有任何硬编码地址。

完整的数据库初始化、环境变量说明、验收清单、常见报错处理见 **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**。

---

## 文档

| 文档 | 内容 |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 分层与模块、请求链路、数据表、前端结构、构建与发布拓扑 |
| [docs/API.md](docs/API.md) | 8 个接口的完整说明：参数、校验规则、响应、错误码、curl 示例 |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | 环境准备、`.env` 全量说明、调试技巧、常见问题排查 |
| [docs/SECURITY.md](docs/SECURITY.md) | 威胁模型、已实施的控制、已知缺口与取舍 |
| [deploy/deploy.md](deploy/deploy.md) | 部署手册：裸机 → Nginx → HTTPS → 备份与回滚 |
| [docs/001-idempotency-payment-callback.md](docs/001-idempotency-payment-callback.md) | 文章草稿：支付回调的幂等设计（设计分析，非生产事故） |

---

## 几个值得说明的取舍

**1. 为什么不用 UI 框架**

一个作品集站点只有 5 个页面。引入组件库意味着要覆盖它的默认样式才能做出自己的视觉，还要额外承担一个依赖的升级成本。手写 CSS 大约 2700 行（含响应式与代码高亮主题），换来的是完全可控的排版和 0 个 UI 依赖。

**2. 为什么 Markdown 要过滤两遍**

`markdown-it` 用 `html: false` 直接禁用正文里的原始 HTML（第一道），渲染成 HTML 之后再交给 DOMPurify 清洗（第二道）。只做其中一道都能被绕过：前者挡不住 `[x](javascript:...)`，后者挡不住作者误贴 `<style>` 造成的样式污染。未知语言的代码块交给 markdown-it 默认转义，而不是拼字符串。

**3. 为什么错误不打折成 HTTP 200**

很多接口习惯用 `{"code": 500}` 配 HTTP 200 返回，前端得靠判断 `code` 才知道出错，日志和监控也失去意义。这里**错误保留真实状态码**（400/401/404/500），响应体里的 `code` 只是给业务层看的补充。代价是前端拦截器要多写一个 `error` 分支，收益是任何 HTTP 工具看到的都是真相。

**4. 为什么单人站点不建用户表**

只有一个管理员，密码哈希放环境变量、登录后签发 JWT，就不需要 `user` 表、角色表、密码重置流程和注册接口。少一张表就少一类漏洞。代价是改密码要改环境变量并重启（见"已知限制"）。

**5. 为什么发布用"版本目录 + 软链接"**

`scp` 覆盖正在运行的文件会出现"一半新一半旧"的中间状态。现在每个版本解到独立目录，`/var/www/devlog` 只是指向当前版本的软链接，切换是一次 `ln -sfn`（原子操作）。回滚就是把链接指回上一个目录——秒级完成，且不需要重新构建。

**6. 为什么 CI 失败不影响线上**

发布脚本分 `stage`（解包、装依赖、构建、写数据库快照）和 `activate`（切链接、重启、健康检查）两个阶段。`stage` 失败时线上完全没动；`activate` 后健康检查失败会自动切回上一版本。发布动作与线上状态解耦，才敢让 `git push` 直接触发部署。

**7. 为什么后台要单独一个子域名**

`/login`、`/admin/*`、`/api/admin/*` 在公开站上直接是 404，攻击者连"这里有个登录框"都看不到，暴露面只剩一个静态站。附带的好处是 `localStorage` 按 origin 隔离——公开站上即使出现 XSS，也读不到后台域名下的 token。Basic Auth 是第二层，挡的是"已经知道域名、想试密码"这类人；它不替代 JWT，API 仍然逐个校验。

---

## 手工验收清单

自动化测试覆盖接口层，下面这些仍是发布前要人眼看一遍的部分：

- [ ] 无 token 访问后台 API → 401；访问 `/admin/edit` → 登录页。
- [ ] 错误账号 / 密码 → 401；正确账号返回 7 天有效 JWT。
- [ ] 空标题、空白正文、非法状态、重复 / 超长标签、额外字段 → 400。
- [ ] 建立草稿后，后台列表能看到；前台列表不包含，前台详情 404。
- [ ] 发布后首页可读；标签筛选、分页及刷新 URL 都保持正确结果。
- [ ] 列表 JSON 不含 `content`，详情包含正文。
- [ ] 转回草稿后前台再次不可见；删除后详情 404。
- [ ] 粘贴 `<script>alert(1)</script>`、`[link](javascript:alert(1))` 等到正文，不执行脚本；未知语言代码块正确转义。
- [ ] token 过期时清除 localStorage 并回登录页；不会跳到外站。
- [ ] 空数据、接口错误、不存在的文章和移动端布局均有可理解的状态。

---

## 已知限制

- **前端还没有自动化测试**：后端接口测试已落地（`npm test`，跑真实 MySQL），前端仍靠上面的手工清单
- **单点部署**：一台 ECS，无负载均衡与多副本；数据库与站点同机
- **无多端冲突检测**：两个标签页同时编辑同一篇文章，后保存的覆盖先保存的
- **token 不可撤销**：退出登录只删浏览器里的 token；泄漏时需轮换 `JWT_SECRET`，改管理员密码不会吊销已签发 token
- **HSTS 未开启**：HTTPS 已用 Let's Encrypt 证书，但 `Strict-Transport-Security` 仍注释在 `deploy/nginx.conf` 里，等确认稳定再开，避免域名被长期锁定
- **adm 子域名尚未切线上**：配置在仓库里齐了，证书、Basic Auth 凭据与 DNS 仍待按手册上线
- **没有图片上传**：文章配图需要外链

---

## 后续计划

- [ ] **前端测试**：Vitest + Testing Library 覆盖登录、草稿流转、标签筛选；后端继续补并发与边界用例
- [ ] **后台域名上线**：`adm.zrocks.me` 证书 + `.htpasswd` 凭据，按 [deploy/deploy.md](deploy/deploy.md) §5.2 切换
- [ ] **HSTS**：确认 HTTPS 稳定后开启
- [ ] **SEO**：`meta description`、Open Graph、`sitemap.xml`、文章页预渲染
- [ ] **RSS**：静态生成 `feed.xml`
- [ ] **图片**：对象存储直传（不经过应用服务器）
- [ ] **可观测性**：结构化日志 + 简单的访问 / 错误看板

---

## 开源协议

[MIT](LICENSE)。代码可以随意参考、修改、商用，保留版权声明即可。

站内**文章内容**（`post` 表里的正文）版权归作者所有，不在 MIT 授权范围内。

---

## 联系

- 邮箱：<zrocks@qq.com>
- GitHub：<https://github.com/zys1101>
- Gitee 镜像：<https://gitee.com/zrocks/blog>
