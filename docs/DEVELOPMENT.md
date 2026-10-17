# 本地开发指南

> 从零把项目跑起来、改起来、验起来。部署上线见 [../deploy/deploy.md](../deploy/deploy.md)。

- 最后更新：2026-10

---

## 1. 环境要求

| 依赖 | 版本 | 说明 |
|---|---|---|
| Node.js | **22.12+**（建议 22 LTS） | 两端都用 Node 22 开发与构建 |
| npm | 10+ | 仓库内有两份 `package-lock.json` |
| MySQL | **8.0+**（建议 8.4 LTS） | 需要 JSON 类型与 `JSON_CONTAINS` |

依赖版本由 `backend/package-lock.json` 与 `frontend/package-lock.json` 锁定：

```bash
npm ci        # 首次安装、CI、切换分支后：严格按 lock 安装
npm install   # 日常加依赖时才用
```

> 用 `npm ci` 而不是 `npm install`：前者会删掉 `node_modules` 重装并校验 lock，
> 能避免"我本地能跑"这类因依赖漂移导致的问题。

---

## 2. 初始化数据库

以数据库管理员身份执行（密码换成自己的）：

```sql
CREATE DATABASE blog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'blog_app'@'127.0.0.1' IDENTIFIED BY 'REPLACE_WITH_DB_PASSWORD';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
  ON blog.* TO 'blog_app'@'127.0.0.1';
```

- 本地需要 `CREATE / ALTER / DROP` 是因为 `DB_SYNC=true` 会自动建表与同步结构
- **生产环境只授予 CRUD**，表结构由部署手册里的 SQL 显式创建
- 如果 MySQL 把本地连接解析成 `localhost` 而不是 `127.0.0.1`，请建对应主机的账号，
  **不要为了省事开放 `%`**

---

## 3. 配置后端

### 3.1 生成管理员密码哈希

```bash
cd backend
npm ci
npm run hash-password
```

提示输入密码，要求 **至少 12 个字符、最多 72 个 UTF-8 字节**（bcrypt 的上限）。

> ⚠️ 该命令会**回显输入**，只在可信的本地终端执行；密码不会写入 shell 历史。
> 拿到 `$2b$12$...` 开头的 60 字符哈希后复制到 `.env`。

### 3.2 生成 JWT 密钥

```bash
openssl rand -hex 32      # 输出 64 字符的随机十六进制串
```

### 3.3 创建 `backend/.env`

该文件已被 `.gitignore` 忽略，**不会进仓库**。

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

| 变量 | 必填 | 说明 |
|---|---|---|
| `NODE_ENV` | 是 | `production` 时会禁止 `DB_SYNC=true` |
| `PORT` | 否 | 默认 3000，必须是 1–65535 的整数 |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | 是 | 缺任意一项启动即失败 |
| `DB_SYNC` | 否 | `true` 时自动建表 / 同步结构；**生产环境必须为 false** |
| `ADMIN_USERNAME` | 是 | 1–64 字符 |
| `ADMIN_PASSWORD_HASH` | 是 | 必须是 bcrypt 哈希（格式不合法启动即失败） |
| `JWT_SECRET` | 是 | 建议 32 字节随机值 |
| `CORS_ORIGINS` | 否 | 逗号分隔；默认 `http://localhost:5173` |

**几个容易踩的点**

- 值里含 `#`、`$`、空格等特殊字符时**必须加引号**，否则会被 dotenv 截断
- `$2b$12$...` 里的 `$` 在双引号里也可能被 shell 展开，**用单引号**
- `.env` 相对**后端工作目录**加载，所以后端命令一定要在 `backend/` 下执行
- 配置缺失或格式错误时后端**直接启动失败**，不会悄悄连到别的库或伪造登录成功

---

## 4. 启动

两个终端，都从仓库根目录开始：

```bash
# 终端 1：后端
cd backend
npm run dev          # nest start --watch，监听 0.0.0.0:3000，前缀 /api

# 终端 2：前端
cd frontend
npm run dev          # vite，默认 http://localhost:5173
```

前端只访问相对地址 `/api`，由 Vite 代理到 `http://localhost:3000`，
**代码里没有任何硬编码的后端地址**。

需要代理到别的地址时：

```bash
API_PROXY_TARGET=http://192.168.1.10:3000 npm run dev
```

> `vite preview` 只用于预览构建产物，**不代理 API**，所以预览时接口会 404，这是正常的。

---

## 5. 发布第一篇文章

1. 打开 `http://localhost:5173/login`，用 `.env` 里的管理员账号 + 原始密码登录
   （登录入口只在首页；登录后导航栏出现「文章工作台」）
2. 进入 `/admin/edit`，填标题、摘要、标签、Markdown 正文
3. 「存草稿」仅后台可见；「发布文章」后进入首页与博客列表
4. 左侧分页切换文章，可继续编辑、转回草稿、删除（删除有二次确认，未保存离开有提醒）

内容约束（前端会提示，后端强制校验）：

| 字段 | 约束 |
|---|---|
| 标题 | 必填，≤160 字符 |
| 摘要 | ≤500 字符 |
| 标签 | ≤8 个，逗号（中英文均可）分隔，每个 ≤30 字符 |
| 正文 | 必填，≤100,000 字符 |

---

## 6. 常用脚本

```bash
# 类型检查（不产出文件）
npm run typecheck --prefix backend
npm run typecheck --prefix frontend

# 构建
npm run build --prefix backend     # → backend/dist/
npm run build --prefix frontend    # → frontend/dist/（含类型检查，失败则不产出）

# 启动构建产物
cd backend && node dist/main.js
```

前端 `build` = `vue-tsc --noEmit && vite build`，**类型不通过就不产出**。
两端产物都不入 Git。

---

## 7. 调试

| 想做什么 | 做法 |
|---|---|
| 看后端收到的请求体 | 临时在 `main.ts` 里加 `app.use((req,_,next)=>{console.log(req.method,req.url);next()})` |
| 看 SQL | `db.config.ts` 里把 `logging` 改成 `true`（**别提交**） |
| 验证 Markdown 安全性 | 正文贴 `<script>alert(1)</script>` 与 `[x](javascript:alert(1))`，都不应执行 |
| 验证 401 处理 | 手动改 localStorage 里 `devlog-token` 的值，然后进 `/admin/edit` |
| 看 CSP 拦截了什么 | 浏览器 DevTools Console，CSP 违规会打印 `Refused to ...` |
| 查线上发布记录 | GitHub 仓库 → Actions → Deploy |

**token 存在哪**：`localStorage['devlog-token']`。清掉它等同于退出登录。

---

## 8. 手工验收清单

自动化测试还没接入，改动后至少过一遍：

**鉴权**

- [ ] 无 token 访问 `/api/admin/posts` → 401
- [ ] 无 token 访问 `/admin/edit` → 跳登录页
- [ ] 错误账号 / 密码 → 401
- [ ] 正确账号 → 返回 7 天有效的 JWT
- [ ] token 过期 → 清 localStorage 并回登录页，不跳外站

**校验**

- [ ] 空标题、纯空白正文、非法 `status`、超长 / 重复标签、多余字段 → 全部 400
- [ ] `pageSize=51` → 400

**文章流转**

- [ ] 建草稿 → 后台列表可见；前台列表不含；前台详情 404
- [ ] 发布 → 首页可读；标签筛选、分页、刷新 URL 结果都正确
- [ ] 列表 JSON 不含 `content`，详情含正文
- [ ] 转回草稿 → 前台再次不可见
- [ ] 删除 → 详情 404

**渲染安全**

- [ ] `<script>alert(1)</script>` 不执行
- [ ] `[link](javascript:alert(1))` 不执行
- [ ] 未知语言代码块被正确转义（不高亮、不报错）

**界面**

- [ ] 空数据、接口错误、文章不存在都有可理解的提示
- [ ] 移动端（375px）布局正常，导航可折叠
- [ ] 键盘 Tab 能走完导航与表单，`skip-link` 生效

---

## 9. 常见问题

**`Error: connect ECONNREFUSED 127.0.0.1:3306`**
MySQL 没启动，或 `DB_HOST/DB_PORT` 写错。先 `mysql -h 127.0.0.1 -u blog_app -p` 手工连一次。

**`ER_ACCESS_DENIED_ERROR`**
账号只授权给了 `localhost` 但你连的是 `127.0.0.1`（或反过来）。MySQL 把两者当成不同主机。

**后端启动就退出，只打印一行错误**
这是设计如此：缺配置 / 哈希格式不对 / 生产环境开了 `DB_SYNC` 都会拒绝启动。
错误信息里会指出是哪一项。

**登录返回 401，但账号密码肯定是对的**
1. 确认 `.env` 里的 `ADMIN_USERNAME` 与输入完全一致（含大小写）
2. 哈希是不是被引号或 `$` 展开破坏了——重新生成一次，用单引号包住
3. 改了 `.env` 要重启后端（`--watch` 不会重载环境变量）

**前端 5173 打开后接口 404**
检查后端是否在 3000 端口、Vite 代理是否生效（`vite.config.ts` 里的 `/api`）。
`vite preview` 不代理 API，预览构建产物时接口 404 是预期的。

**改了样式不生效**
Vite 有 HMR，通常保存即可。若无效，检查是不是改到了 `dist/` 里的产物（产物不该手改）。

**`npm ci` 报 lock 文件与 package.json 不一致**
说明有人改了 `package.json` 没更新 lock。`npm install` 重新生成 lock 并提交。

**`vue-tsc` 报类型错但编辑器里没红线**
VSCode 可能用的是内置 TS 版本。命令面板 → `TypeScript: Select TypeScript Version` → 选工作区版本。

**中文在数据库里变问号**
建库时字符集不是 `utf8mb4`，或连接没带 `charset`。本项目连接串已固定 `utf8mb4`，
请检查建库语句与表字符集。

---

## 10. 代码约定

| 项 | 约定 |
|---|---|
| 类型 | 两端都是 TypeScript **严格模式**，不用 `any` 绕过 |
| 提交信息 | `<type>(<scope>): <中文简述>`，如 `fix(auth): 拒绝超过 72 字节的密码` |
| 命名 | 后端文件名 kebab-case（`post.service.ts`），组件 PascalCase（`BlogList.vue`） |
| 注释 | 解释**为什么**，不解释代码在做什么 |
| 样式 | 只用 `frontend/src/styles/main.css` 的 CSS 变量，不硬编码颜色 |
| 内容数据 | 作品集改 `frontend/src/data/projects.ts`，不要改组件 |
| 密钥 | 任何密钥、密码、IP 白名单都不进仓库（`.env` 已忽略） |
