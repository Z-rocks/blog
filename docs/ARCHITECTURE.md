# 架构说明

> 这份文档解释"代码为什么长这样"。接口细节见 [API.md](API.md)，本地跑起来见 [DEVELOPMENT.md](DEVELOPMENT.md)，
> 安全相关见 [SECURITY.md](SECURITY.md)。

- 对应版本：v0.1.0（`main` 分支）
- 最后更新：2026-10

---

## 1. 整体定位

单人使用的作品集 + 博客站点。所有设计都围绕三条约束：

| 约束 | 推论 |
|---|---|
| **只有一个作者** | 不需要用户表、角色、注册、权限矩阵；管理员身份来自环境变量 |
| **内容量小** | 不需要搜索、缓存层、CDN、读写分离；一张表 + 一个索引够用 |
| **要能长期维护** | 依赖少、约定显式、发布可回滚；宁可手写也不引入重框架 |

---

## 2. 运行时拓扑

```
              Internet
                 │
        ┌────────▼─────────┐
        │  Nginx (80/443)  │
        │                  │
        │  /      → 静态   │  /var/www/devlog/frontend/dist
        │  /api/  → 反代   │  → 127.0.0.1:3000
        └────────┬─────────┘
                 │
        ┌────────▼─────────┐
        │ NestJS (systemd) │  只监听 127.0.0.1:3000（不对公网开放）
        └────────┬─────────┘
                 │
        ┌────────▼─────────┐
        │ MySQL 8.0        │  只监听 127.0.0.1:3306
        └──────────────────┘
```

三个进程一台机器。Nginx 同时承担四件事：静态文件、SPA 回退、API 反向代理、登录限流。

**为什么前后端不同端口、不同进程**：前端是纯静态产物，改样式不需要重启 Node；后端重启时静态页仍然可访问（只是接口 502），故障面更小。

---

## 3. 后端（`backend/`）

### 3.1 模块划分

```
AppModule
├── ConfigModule（全局，读 .env）
├── TypeOrmModule.forRootAsync(databaseConfig)
├── AuthModule     登录、JWT 签发、JwtStrategy
└── PostModule     文章 CRUD（受 JwtAuthGuard 保护）
```

只有两个业务模块。`AuthModule` 不建用户表，`AuthService` 在构造时就把 `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH`
读进内存并校验格式——配置有问题时**启动即失败**，不会带着半残状态跑起来。

### 3.2 一次请求的生命周期

```
HTTP 请求
  │
  ├─ express.json({ limit: '1mb' })      请求体上限（正文最大 10 万字符）
  ├─ CORS（只放行 CORS_ORIGINS 列出的来源）
  │
  ├─ GlobalPrefix 'api'                  所有路由挂在 /api 下
  ├─ JwtAuthGuard                        除 @Public() 外都要求 Bearer token
  ├─ ValidationPipe                      whitelist + forbidNonWhitelisted
  │     · transform: true                查询参数 "2" → number
  │     · 多余字段 → 400
  │     · 类型错误 → 400（message 是中文数组）
  │
  ├─ Controller → Service → TypeORM
  │
  ├─ TransformInterceptor                成功：{ code: 0, message: 'ok', data }
  └─ HttpExceptionFilter                 失败：真实状态码 + { code: status, message, data: null }
```

注册顺序在 `src/main.ts`：管道 → 拦截器 → 过滤器。顺序错了会导致异常没被包装成统一格式。

### 3.3 鉴权流程

```
POST /api/auth/login { username, password }
  → 密码超过 72 字节直接拒绝（bcrypt 只取前 72 字节，不拒绝会造成"两个密码都能登录"）
  → bcrypt.compare(password, ADMIN_PASSWORD_HASH)
  → 用户名或哈希任一不符：401「用户名或密码错误」（不区分是哪一项错）
  → 签发 JWT：{ sub: 'admin', username }
       HS256，issuer=devlog-api，audience=devlog-admin，有效期 7 天

后续请求：Authorization: Bearer <token>
  → JwtStrategy 校验签名 / 过期 / issuer / audience / sub === 'admin'
  → 任何一项不符 → 401
```

**为什么校验 issuer/audience**：只校验签名的话，任何用同一个 `JWT_SECRET` 签出的 token 都能通过。
限定 issuer 与 audience 后，即使密钥被复用到别的服务，token 也不能跨服务使用。

**为什么没有刷新 token**：单人站点，7 天足够长；多一个刷新端点就多一个攻击面。过期就重新登录。

### 3.4 数据模型

只有一张表：

```sql
CREATE TABLE post (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(160)  NOT NULL,
  summary     VARCHAR(500)  NOT NULL,
  content     MEDIUMTEXT    NOT NULL,   -- 实体上 select: false
  tags        JSON          NOT NULL,
  status      ENUM('draft','published') NOT NULL DEFAULT 'draft',
  createdAt   DATETIME(6)   NOT NULL,
  updatedAt   DATETIME(6)   NOT NULL,
  INDEX IDX_post_status_created_id (status, createdAt, id)
);
```

几个刻意的选择：

- **`content` 默认不查**（`@Column({ select: false })`）。列表接口如果忘了排除正文，一次请求就会带出几十篇文章的全文。
  在实体层关掉之后，只有 `detail()` 显式 `addSelect('post.content')` 才拿得到。这是"默认安全"而不是"记得排除"。
- **复合索引 `(status, createdAt, id)`** 正好覆盖列表查询：`WHERE status = ? ORDER BY createdAt DESC, id DESC`。
  `id` 进索引是为了排序稳定（同一秒创建的两篇文章顺序确定，分页不会重复/漏项）。
- **`tags` 用 JSON 列**，查询用 `JSON_CONTAINS(tags, ?)`。没建关联表是因为标签只用于筛选展示，
  不需要"标签云统计"或重命名级联。真需要时再拆表。
- **时间统一 UTC**：连接串 `timezone: 'Z'`，字段 `datetime(6)`，接口返回 ISO 字符串，浏览器按本地时区显示。
  服务器、数据库、应用三处时区不一致是这类项目最常见的 bug 来源。

### 3.5 列表与分页

```ts
builder
  .select(['post.id','post.title','post.summary','post.tags','post.status','post.createdAt','post.updatedAt'])
  .orderBy('post.createdAt', 'DESC')
  .addOrderBy('post.id', 'DESC')
  .skip((page - 1) * pageSize)
  .take(pageSize);
```

- 用 `skip/take` 而不是 `offset/limit`：TypeORM 在有关联时会做子查询，`skip/take` 是它的推荐写法
- 显式 `select` 列，配合实体上的 `select: false`，双保险
- 分页参数在 DTO 层就被约束：`page ≥ 1`、`1 ≤ pageSize ≤ 50`，`pageSize` 不设上限等于允许别人一次拉全表

### 3.6 错误处理

`HttpExceptionFilter` 做三件事：

1. 统一响应体：`{ code, message, data: null }`
2. **保留真实 HTTP 状态码**（不是一律 200）
3. 5xx 只记异常类名，不把堆栈、SQL、环境变量返回给客户端

`ValidationPipe` 的报错会被转成中文数组，过滤器用 `；` 拼成一条可读消息。

---

## 4. 前端（`frontend/`）

### 4.1 结构

```
src/
├── main.ts            挂路由 + 全局样式 + highlight.js 主题
├── App.vue            站点外壳：导航、移动端菜单、登录态感知
├── router/index.ts    5 条路由 + 全局守卫 + document.title
├── api/
│   ├── request.ts     axios 实例、token 存取、两个拦截器
│   └── post.ts        8 个接口函数（只返回业务 data）
├── views/             Home / BlogList / Post / Login / AdminEdit
├── data/projects.ts   作品集数据（静态，改这里就能换内容）
├── types/index.ts     全部类型定义
├── utils/markdown.ts  安全渲染
└── styles/main.css    手写样式（含响应式与深色代码块主题）
```

**没有 Pinia / Vuex**。状态只有两类：登录态（从 localStorage 读）和页面内的加载状态。
引入 store 会增加一层间接，而这里没有跨页共享的可变状态。

### 4.2 路由与守卫

| 路由 | 组件 | 守卫 |
|---|---|---|
| `/` | Home.vue | — |
| `/blog` | BlogList.vue | — |
| `/blog/:id` | Post.vue | — |
| `/login` | Login.vue | — |
| `/admin/edit/:id?` | AdminEdit.vue | `requiresAuth` |

守卫规则：`requiresAuth === true` **或** 路径以 `/admin/` 开头，且本地没有 token → 跳 `/login?redirect=<原路径>`。
双条件是因为 `meta` 容易漏写，路径前缀是兜底。

`scrollBehavior`：有 hash 时滚到锚点（`top: 100` 给固定导航栏留位置），浏览器前进后退时恢复原位置。

> 前端守卫只改善体验，**不构成安全边界**。真正的鉴权在后端每个写接口的 `JwtAuthGuard` 上。

### 4.3 请求层

```
请求拦截器：有 token 就加 Authorization: Bearer
响应拦截器（成功）：code !== 0 视为失败 → 抛 Error
响应拦截器（失败）：401 → 清 token；在 /admin/ 下则 replace 到 /login?redirect=...&expired=1
```

用 `window.location.replace` 而不是 `router.push`：401 意味着当前状态已经不可信，
`replace` 不会在历史栈里留下一个"退回去还是 401"的页面。

`baseURL: '/api'` —— 前端代码里没有任何后端地址，开发走 Vite 代理，生产走 Nginx 反代，切换零改动。

### 4.4 Markdown 渲染

```
源码
 → markdown-it({ html: false, linkify: true })
      · html: false      正文里的原始 HTML 直接被丢弃（第一道）
      · highlight()      命中已注册语言 → highlight.js；未命中返回 '' → markdown-it 默认转义
 → DOMPurify.sanitize(..., { FORBID_TAGS: [script, style, iframe, form, input, button],
                             FORBID_ATTR: ['style'] })          （第二道）
 → v-html
```

只注册了 8 种语言（TS/JS/JSON/SQL/Bash/XML/CSS/Java），按需注册让打包体积可控。
未知语言不会"猜"，而是当成纯文本转义——猜错的成本（XSS）远高于不高亮。

### 4.5 样式

无 UI 框架，`main.css` 手写：

- 用 CSS 变量管理颜色与间距，切换主题只改变量
- 移动端：导航折叠成汉堡菜单，网格降为单列
- 代码高亮用 `highlight.js/styles/github-dark.css`（随包引入，不走 CDN）
- 提供 `skip-link`（跳转到主内容）和 `aria-*` 属性，键盘与读屏可用

---

## 5. 构建与发布

### 5.1 构建产物

| 产物 | 命令 | 输出 | 用途 |
|---|---|---|---|
| 前端 | `npm run build` | `frontend/dist/` | 静态文件，Nginx 直接托管 |
| 后端 | `npm run build` | `backend/dist/` | `node dist/main.js` 由 systemd 拉起 |

前端 `build` 脚本是 `vue-tsc --noEmit && vite build`——**类型检查不通过就不会产出产物**，避免把类型错误带到线上。

### 5.2 目录布局

```
/var/www/
├── devlog -> devlog-releases/20261017-193000-gdbad954/   软链接，Nginx 只认这个路径
└── devlog-releases/
    ├── 20261017-193000-gdbad954/
    │   ├── frontend/dist/
    │   └── backend/dist/
    └── 20261016-101500-gf3b5c39/                         上一版本，回滚目标
```

### 5.3 发布流程

```
git push main
  → GitHub Actions
      ① npm ci + typecheck + build（前后端）
      ② tar 打包（排除 node_modules/dist/.env）
      ③ scp 到服务器 /tmp
      ④ ssh 执行 deploy-remote.sh stage   解包、装依赖、构建、备份数据库
      ⑤ ssh 执行 deploy-remote.sh activate 切软链接、重启、健康检查
      ⑥ 公网 curl 首页，非 200 则整个 job 失败
```

`stage` 与 `activate` 分离是关键：前四步失败时线上一点没变；只有 `activate` 会动软链接，
而它内部健康检查失败会自动 `ln -sfn` 回上一版本。

并发控制用 GitHub Actions 的 `concurrency: production`，同一时间只跑一个发布。

手动通道（`deploy/deploy.sh`、`deploy/rollback.sh`）保留给 SSH 不可用或需要本地紧急发布的场景。

---

## 6. 关键约束一览

| 约束 | 位置 | 违反后果 |
|---|---|---|
| 正文最大 100,000 字符 | `SavePostDto` + `useBodyParser({limit:'1mb'})` | 400 / 413 |
| 标题 1–160、摘要 ≤500 | `SavePostDto` | 400 |
| 标签 ≤8 个、去重、每个 1–30 | `SavePostDto` | 400 |
| `status` 只能是 draft/published | `IsEnum(PostStatus)` | 400 |
| 请求体不允许未声明字段 | `forbidNonWhitelisted: true` | 400 |
| 生产环境禁止 `DB_SYNC=true` | `db.config.ts` 启动检查 | 启动失败 |
| 缺 DB / 管理员 / JWT 配置 | `getOrThrow` | 启动失败 |
| 列表不返回正文 | 实体 `select: false` | — |
| 草稿对前台不可见 | `publishedOnly` 条件 + 404 | — |

---

## 7. 如果要做大，先改哪里

按投入产出排序：

1. **加自动化测试**（当前最大空白）——先覆盖鉴权与 CRUD 边界，再覆盖前端关键路径
2. **加 HTTPS**——CSP 已经收紧，缺的只是证书与 HSTS
3. **加缓存头**——静态资源已长缓存，API 可加 `Cache-Control` 或 ETag
4. **图片走对象存储**——避免应用服务器承担流量
5. **加全文检索**——内容上百篇后，MySQL `LIKE` 不够用了再上 `FULLTEXT` 或 Meilisearch
6. **多实例**——真需要时把 session/缓存外置，前端产物上 CDN
