# DEV.LOG · 个人作品集与技术博客

一个前后端分离的个人站点：首页用作品集介绍项目经历，博客部分发布技术文章、沉淀工程思考。前后端均为 **TypeScript 严格模式**，作品集数据（静态维护）与文章数据（MySQL 存储）分离。

当前已部署在阿里云 ECS（Ubuntu 22.04 + Nginx + systemd + MySQL 8），发布流程脚本化，支持版本回滚，详见[部署](#部署与运维)一节与 [deploy/deploy.md](deploy/deploy.md)。

**功能范围**：单人内容管理模式——单管理员登录、草稿 / 发布流转、标签与分页；刻意不做注册、多用户、角色权限、评论、点赞、浏览量、搜索和文件上传，把复杂度留给内容本身。

## 技术栈

| 层         | 技术与职责                                                              |
| ---------- | ----------------------------------------------------------------------- |
| 前端       | Vue 3 Composition API、TypeScript、Vite、Vue Router、Axios              |
| 文章渲染   | markdown-it → highlight.js → DOMPurify；禁用原始 HTML，最终 HTML 再清洗 |
| 后端       | NestJS、TypeScript、TypeORM、MySQL 8.0+                                 |
| 鉴权与校验 | JWT / passport-jwt、bcrypt、class-validator、class-transformer          |
| 部署       | Nginx 静态托管与 `/api` 反向代理、gzip、登录限流、systemd 常驻           |

没有引入 UI 框架，页面用手写 CSS 实现响应式布局；字体走系统字体栈，不依赖任何远程资源即可运行（CSP 因此可以完全收紧到 `self`）。

## 本地启动

### 1. 准备环境

- Node.js **22.12+**（建议 Node 22 LTS）、npm 10+
- MySQL **8.0+**（建议 8.4 LTS），字符集 `utf8mb4`
- 两个终端分别启动前后端；命令默认从仓库根目录开始

依赖通过仓库内的 `package-lock.json` 锁定（backend 与 frontend 各一份），首次安装或 CI 环境用 `npm ci`，日常开发用 `npm install`。

### 2. 初始化本地数据库

以数据库管理员身份运行以下 SQL（账号密码请替换为自己的值）：

```sql
CREATE DATABASE blog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'blog_app'@'127.0.0.1' IDENTIFIED BY 'REPLACE_WITH_DB_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
  ON blog.* TO 'blog_app'@'127.0.0.1';
```

该授权范围用于本地开发时的表结构自动同步。生产环境仅授予 CRUD，见 [部署笔记](deploy/deploy.md)。如果 MySQL 按主机名解析本地账号，请使用匹配实际连接主机的账号（例如 `localhost`），不要为了排错开放 `%`。

### 3. 安装后端并设置管理员

```bash
cd backend
npm ci
npm run hash-password
```

在本地终端输入至少 12 个字符的强密码（最多 72 个 UTF-8 字节）。**该辅助命令会回显输入，只在可信的本地终端执行**；密码不会写进 shell 命令历史。复制输出的 bcrypt 哈希用于下面的配置。

生成 JWT 随机密钥（输出 64 字符的随机十六进制字符串）：

```bash
openssl rand -hex 32
```

创建 `backend/.env`（已被 Git 忽略，密钥不进仓库）：

```dotenv
NODE_ENV=development
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=blog_app
DB_PASSWORD='REPLACE_WITH_DB_PASSWORD'
DB_NAME=blog
DB_SYNC=true
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH='$2b$12$REPLACE_WITH_THE_COMPLETE_HASH'
JWT_SECRET='REPLACE_WITH_THE_RANDOM_SECRET'
CORS_ORIGINS=http://localhost:5173
```

- 没有内置用户名密码，也不建立用户表，唯一管理员从环境变量读取。
- 密码与哈希不提交 Git；`.env` 中含 `#` 等特殊字符的值要加引号。
- 哈希使用 bcrypt cost 12；JWT 有效期固定 **7 天**，只接受 HS256，并校验 issuer / audience。
- `.env` 相对后端工作目录加载，务必在 `backend/` 运行后端命令。
- 本地 `DB_SYNC=true` 会创建 / 同步 `post` 表；该选项可能影响已有数据，**生产环境禁止开启**，生产环境开启时程序会拒绝启动。
- MySQL 配置、管理员配置与 JWT 密钥缺失时后端启动直接失败，不会悄悄切换数据库或伪造登录成功。

启动后端：

```bash
npm run dev
```

默认监听 `0.0.0.0:3000`，统一前缀 `/api`。

### 4. 启动前端

另开终端，从仓库根目录运行：

```bash
cd frontend
npm ci
npm run dev
```

打开终端显示的地址（默认 `http://localhost:5173`）。浏览器只访问相对地址 `/api`，由 Vite 代理到 `http://localhost:3000`，前端代码里没有任何硬编码的后端地址。

如需调整开发代理目标，启动 Vite 时设置进程环境变量 `API_PROXY_TARGET`。生产反向代理由 Nginx 负责，`vite preview` 仅用于查看构建产物，不代理 API。

### 5. 发布第一篇文章

1. 打开 `/login`，使用配置的管理员账号与原始密码登录（登录入口只在首页，登录后导航栏出现「文章工作台」）。
2. 进入 `/admin/edit`，输入标题、摘要、标签及 Markdown 正文。
3. 标签用英文或中文逗号分隔，最多 8 个、每个最长 30 字符；标题必填且最长 160 字符，摘要最长 500 字符，正文必填且最多 100,000 字符。
4. 「存草稿」仅后台可见；「发布文章」可在首页精选、博客列表及详情页阅读。
5. 左侧分页选择文章，可再编辑、转回草稿或删除。删除有二次确认；未保存离开有提醒。

## 页面与源码导航

| 路由               | 页面            | 说明                                            |
| ------------------ | --------------- | ----------------------------------------------- |
| `/`                | `Home.vue`      | 一句话定位、三个项目卡片、最新三篇已发布文章    |
| `/blog`            | `BlogList.vue`  | 分页与完整标签筛选；状态保存在 URL 查询参数中   |
| `/blog/:id`        | `Post.vue`      | 已发布文章、安全 Markdown 渲染、加载 / 失败状态 |
| `/login`           | `Login.vue`     | 管理员登录；token 保存到 localStorage           |
| `/admin/edit/:id?` | `AdminEdit.vue` | 同页文章管理与新建 / 编辑，前端路由守卫         |

一共五条路由。未知路径由根组件显示未找到提示。

- `frontend/src/data/projects.ts`：个人定位、联系方式与项目卡片数据（名称、描述、亮点、仓库链接）都在这里维护；空链接不会渲染成不可用按钮。
- `frontend/src/types/index.ts`：前端实体、列表类型、输入参数和通用分页类型。
- `frontend/src/api/request.ts`：token 请求拦截器、响应剥壳、401 清理。保留真实 `AxiosResponse<T>` 类型，接口函数只返回业务 `data`。
- `frontend/src/utils/markdown.ts`：安全渲染。高亮内置 TS、JS、JSON、SQL、Bash、HTML/XML、CSS、Java；未知语言转义为普通代码。
- `backend/src/post/post.entity.ts`：`post` 表定义，无用户表。
- `backend/src/post/post.service.ts`：列表显式选择非正文列，并使用 `skip/take`、稳定的日期 / ID 降序和参数化 `JSON_CONTAINS` 标签查询。

## API 约定

成功（创建为 HTTP 201，其余 HTTP 200）：

```json
{ "code": 0, "message": "ok", "data": {} }
```

失败保留真实 HTTP 状态码（400 / 401 / 404 / 500 等），不以 HTTP 200 冒充成功：

```json
{ "code": 401, "message": "Unauthorized", "data": null }
```

分页 `data` 格式为 `{ items, total, page, pageSize }`。查询默认 `page=1&pageSize=10`，`pageSize` 范围 1–50。列表不查询也不返回 `content`。时间采用 ISO 字符串，前端按浏览器时区显示。

| 方法   | 路径                                       | 鉴权 | 说明                                              |
| ------ | ------------------------------------------ | ---- | ------------------------------------------------- |
| POST   | `/api/auth/login`                          | 公开 | `{ username, password }` → `{ token, expiresIn }` |
| GET    | `/api/posts?page=1&pageSize=10&tag=NestJS` | 公开 | 仅已发布；标签为完整、区分大小写的匹配            |
| GET    | `/api/posts/tags`                          | 公开 | 全站已发布标签，升序去重；供前台标签栏使用        |
| GET    | `/api/posts/:id`                           | 公开 | 仅已发布；草稿与不存在均 404                      |
| GET    | `/api/admin/posts`                         | JWT  | 全部状态的列表，同样分页且不含正文                |
| GET    | `/api/admin/posts/:id`                     | JWT  | 编辑时读取完整正文，包括草稿                      |
| POST   | `/api/admin/posts`                         | JWT  | 创建文章                                          |
| PUT    | `/api/admin/posts/:id`                     | JWT  | 完整更新文章                                      |
| DELETE | `/api/admin/posts/:id`                     | JWT  | 删除成功返回 `{ id }`                             |

新建 / 更新请求：

```json
{
  "title": "从一次支付回调谈幂等性",
  "summary": "记录重复回调场景中的设计与验证过程。",
  "content": "## 问题背景\n\n这里填写 Markdown 正文。",
  "tags": ["幂等性", "MySQL"],
  "status": "draft"
}
```

`status` 仅允许 `draft` 或 `published`；PUT 必须提供全部五个字段。全局 ValidationPipe 拒绝未声明字段、非法分页与错误类型。所有写接口都由后端校验 JWT，前端路由守卫仅改善体验，不能替代接口鉴权。

## 类型、构建与测试

```bash
npm run typecheck --prefix backend
npm run build --prefix backend
npm test --prefix backend          # 接口测试，需要可连的 MySQL
npm run typecheck --prefix frontend
npm run build --prefix frontend
```

产物分别是 `backend/dist/` 与 `frontend/dist/`，不入 Git。

后端接口测试用 Jest + supertest 跑在**真实 MySQL** 上而不是 mock —— 草稿是否泄露、列表是否夹带正文，这类判断发生在 SQL 里，mock 掉仓储就正好绕过了要守的那一段。覆盖范围：草稿 / 发布隔离、列表不返回 `content`、标签完整匹配、标签聚合不受分页影响、无 token 与伪造 token 的 401、DTO 校验（缺字段 / 多余字段 / 非法枚举 / 超限分页）、以及新建 → 发布 → 删除的完整流转。

测试库需要先存在（`DB_SYNC` 只建表不建库）：

```bash
mysql -u root -e "CREATE DATABASE IF NOT EXISTS blog_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
```

连接参数默认 `127.0.0.1:3306` / `root` / 空密码 / `blog_test`，可用 `TEST_DB_HOST`、`TEST_DB_PORT`、`TEST_DB_USER`、`TEST_DB_PASSWORD`、`TEST_DB_NAME` 覆盖。测试进程注入的环境变量优先于 `backend/.env`，因此**测试不会连到开发库 `blog`**。表结构由 TypeORM 按实体同步，不额外维护一份 DDL。CI 会在发布前自动跑这套测试，不通过不会部署。

其余状态与边界仍由下面的手工清单覆盖。

### 手工验收清单

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

## 安全设计

- token 存放在 localStorage，因此 XSS 是主要威胁面：只把 DOMPurify 清洗后的 HTML 交给 `v-html`，生产环境配合 CSP（`script-src 'self'`，无任何远程脚本 / 样式 / 字体白名单）与 HTTPS。
- 退出登录仅删除浏览器 token；无刷新 token、服务端会话或撤销名单。令牌泄漏时轮换 `JWT_SECRET`；修改管理员密码不会吊销已签发 token。
- 后端跨域只允许配置的来源；同源部署下前端只走相对路径 `/api`。
- 登录暴力尝试由 Nginx 按 IP 限流（5 次/分钟）；本地 Nest 服务没有额外限流模块，**生产环境不得直接暴露 3000 端口**（安全组仅放行 80/443）。
- 当前没有多端版本冲突检测，两个标签页同时编辑同一篇文章时后一次保存覆盖前一次。

## 部署与运维

线上通过 **GitHub Actions 持续部署**：推送 `main` 先跑 `test` job（两端类型检查与构建 + 后端接口测试，跑在 MySQL 8 service container 上），通过后才进入 `deploy` job（上传 → 服务器构建 → 原子切换 → 健康检查 → 公网验收）。任意一步失败都不会影响线上版本（定义见 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)）。同一时间只允许一个发布流程（concurrency 排队），部署历史可在仓库的 Actions 页面查看。

服务器侧沿用"版本目录 + 软链接"布局：`/var/www/devlog-releases/<版本ID>/` 存每个版本，`/var/www/devlog` 为指向当前版本的软链接，Nginx 与 systemd 只认该路径；发布与回滚由服务器脚本 `/usr/local/lib/devlog-remote.sh` 完成（每次部署随仓库更新），健康检查失败自动切回上一版本。

仓库同时保留手动发布通道（SSH 不可用或需要紧急本地发布时）：

- `deploy/deploy.sh`：打包工作区 → workbench 上传 → 服务器构建、备份数据库、原子切换、健康检查。
- `deploy/rollback.sh`：回滚到上一版本或任意历史版本（`-l` 查看全部版本）。

```bash
./deploy/deploy.sh        # 手动发布当前工作区
./deploy/rollback.sh -l   # 查看线上历史版本
./deploy/rollback.sh      # 回滚到上一版本
```

部署密钥为仅限该服务器使用的独立 SSH 密钥（GitHub Secrets 存储），服务器 `/root/.ssh/authorized_keys` 中以 `restrict` 选项限制只可执行命令；数据库每日快照随发布自动生成于服务器 `/var/backups/devlog-db/`，恢复方式与保留策略见部署手册。

## 后续规划

- 前端关键路径测试（Vitest + Testing Library）；后端接口测试已落地，继续补并发与边界用例。
- HTTPS 与域名：域名备案完成后启用 Let's Encrypt 证书与 HSTS。
- SEO：meta description、Open Graph、sitemap 与文章页预渲染。
- RSS 订阅与文章图床（对象存储直传，不经过应用服务器）。
