# 安全设计

> 这里写清楚：这个站点防什么、不防什么、为什么这么选。
> 一个人维护的项目，最怕的是"以为防了其实没防"，所以缺口也照实写。

- 最后更新：2026-10

---

## 1. 威胁模型

先明确谁可能攻击、图什么：

| 攻击者 | 能力 | 图什么 |
|---|---|---|
| **路人 / 爬虫** | 只能发 HTTP 请求 | 找未授权接口、试默认口令、扫已知框架漏洞 |
| **拿到阅读权限的人** | 能看文章 | 通过文章内容注入脚本，窃取管理员 token |
| **撞库脚本** | 能发大量登录请求 | 猜管理员密码 |
| **拿到服务器的人** | 有 shell | 数据库、`.env`、部署密钥 |

对应到本项目的三条防线：**入口收敛**（只有 80/443）、**身份唯一**（单管理员 + JWT）、
**渲染可控**（Markdown 两层过滤 + CSP）。

**不在威胁模型内**：DDoS、供应链攻击（npm 依赖被投毒）、物理接触服务器、
有 0day 的浏览器漏洞。这些靠单机单人可以缓解但不能解决，不做承诺。

---

## 2. 已实施的控制

### 2.1 XSS —— 这是最需要防的一条

因为 token 存在 localStorage，**一次 XSS 就等于账号被完全接管**（攻击者能读 token 并带走）。
所以正文渲染做了两层：

```
第一层：markdown-it({ html: false })
        → 正文里写的 <script>、<img onerror>、<iframe> 全部被丢弃，不会被解析成标签

第二层：DOMPurify.sanitize(html, {
          USE_PROFILES: { html: true },
          FORBID_TAGS: ['script','style','iframe','form','input','button'],
          FORBID_ATTR: ['style'],
        })
        → 清掉 markdown-it 生成结果里的危险属性（javascript: 链接、事件属性）
```

为什么两层都要：

- 只有第一层：`[点我](javascript:alert(1))` 是合法的 Markdown 链接语法，
  markdown-it 会照常渲染成 `<a href="javascript:...">`
- 只有第二层：作者误贴 `<style>body{display:none}</style>` 不会被 `html:false` 之外的东西拦，
  而 DOMPurify 默认也不一定清（本项目显式 `FORBID_TAGS` 掉 `style`）

代码高亮也走白名单：只注册 8 种语言，**未知语言返回空串让 markdown-it 默认转义**，
而不是把原文拼进 `<span class="hljs-...">` 里。拼字符串是 highlight.js 集成里最常见的 XSS 来源。

### 2.2 CSP —— 兜底而非主力

生产环境 `deploy/nginx.conf` 下发：

```
default-src 'self';
script-src  'self';
style-src   'self';
font-src    'self';
img-src     'self' https: data:;
connect-src 'self';
object-src  'none';
base-uri    'self';
form-action 'self';
frame-ancestors 'none';
```

- **没有任何远程源**：不引 Google Fonts、不引 CDN、不引统计脚本。这既是隐私考虑，也让 CSP 能收到最紧
- `object-src 'none'` 挡 `<object>`/`<embed>` 类老式载荷
- `frame-ancestors 'none'` 挡点击劫持
- `base-uri 'self'` 挡 `<base href>` 改写相对路径

> CSP 是**第二道**。它能挡住"漏过 DOMPurify 的脚本"，但如果哪天为了某个功能放宽
> `script-src`，这道防线就没了。改 CSP 前先想清楚为什么必须放宽。

### 2.3 认证与令牌

| 措施 | 实现 |
|---|---|
| 密码存储 | bcrypt，cost 12（单次校验约 200–300 ms，暴力尝试成本高） |
| 密码长度 | 强制 12+ 字符（生成哈希时），**超过 72 字节直接拒绝** |
| 错误信息 | 用户名错和密码错都返回「用户名或密码错误」，不泄露是哪一项 |
| 令牌算法 | 只接受 **HS256**（`algorithms: ['HS256']`，防算法混淆攻击） |
| 令牌约束 | 校验 `issuer=devlog-api`、`audience=devlog-admin`、`sub=admin` |
| 有效期 | 7 天，不做刷新令牌 |
| 传输 | `Authorization: Bearer`，**不用 Cookie**，所以不存在 CSRF |

**为什么不用 Cookie**：Cookie 会自动随请求发送，需要额外做 CSRF 防护（SameSite + token）。
用 Bearer 头则必须由 JS 显式添加，跨站请求天然带不上。代价是 token 得存 localStorage，怕 XSS——
而 XSS 已经在 2.1 里重点处理了。

### 2.4 登录限流

Nginx 层按 IP 限流，不依赖应用：

```nginx
limit_req_zone $binary_remote_addr zone=devlog_login:10m rate=5r/m;
location = /api/auth/login {
    limit_req zone=devlog_login burst=5 nodelay;
    limit_req_status 429;
    error_page 429 = @login_limited;
}
```

5 次/分钟，突发 5 次，超出返回统一格式的 429 JSON。

**为什么放在 Nginx 而不是 Nest**：应用层限流要在每个 worker 里维护计数器，
多进程/多实例时不共享；Nginx 用共享内存 zone，且请求根本不会打到 Node 上。

**这个限流的局限**：按 IP 计。攻击者换 IP（代理池）可以绕过。
真要防撞库还得靠强密码 + 后续可能的 TOTP，限流只是抬高成本。

### 2.5 输入校验

`ValidationPipe` 配置为 `whitelist: true` + `forbidNonWhitelisted: true`：
**DTO 没声明的字段直接 400**，而不是静默忽略。这样"多传一个 `id` 想覆盖主键"这类尝试会在入口被拒。

长度限制全部有上限（标题 160、摘要 500、正文 100000、标签 8×30），
配合 `client_max_body_size 1m` 与 `useBodyParser({ limit: '1mb' })`，避免超大请求打满内存。

### 2.6 错误信息不泄露

`HttpExceptionFilter` 的规则：

- **5xx**：客户端只看到「服务器暂时不可用，请稍后重试」，服务端日志只记异常类名，
  不记堆栈里的 SQL、不记请求体（里面有密码）
- **4xx**：返回可读的校验信息（这是给用户看的，必须说清楚哪里错了）
- 任何情况下都不返回环境变量、文件路径、依赖版本

### 2.7 数据与凭据

| 项 | 做法 |
|---|---|
| 数据库账号 | 生产只授予 CRUD，不给 `DROP`/`ALTER`；本地开发才需要 |
| 数据库监听 | 只绑 `127.0.0.1`，安全组不放行 3306 |
| 应用端口 | NestJS 只监听内网，公网只开 80/443 |
| 密钥存放 | `.env` 在服务器本地，权限 600，**不进 Git** |
| 部署密钥 | 独立的 ed25519 密钥，服务器 `authorized_keys` 里用 `restrict` 限制 |
| 备份 | 每次发布前自动快照到 `/var/backups/devlog-db/` |
| 前端源码 | 不含任何密钥；`VITE_*` 变量会打进产物，所以不放敏感值 |

### 2.8 表结构变更

`DB_SYNC=true` 能让 TypeORM 自动改表，这在生产是危险的（可能丢数据）。
所以 `db.config.ts` 里有硬检查：

```ts
if (config.get('NODE_ENV') === 'production' && synchronize) {
  throw new Error('生产环境禁止 DB_SYNC=true，请按部署文档初始化或变更表结构');
}
```

配置错了就**启动失败**，而不是"带着隐患跑起来"。

---

## 3. 已知缺口

照实列出。这些不是"忘了"，是有意识的取舍或还没做：

| 缺口 | 影响 | 现状 / 计划 |
|---|---|---|
| **无 HTTPS** | token 与密码在公网明文传输 | 域名备案完成后上 Let's Encrypt + HSTS（配置已在 `nginx.conf` 注释中就位） |
| **token 无法撤销** | token 泄漏后 7 天内一直有效；改管理员密码不会吊销已签发 token | 应急手段：轮换 `JWT_SECRET` 并重启（所有 token 立即失效） |
| **token 在 localStorage** | 一旦 XSS 即失守 | 已用两层过滤 + CSP 降低概率；彻底方案是 HttpOnly Cookie + CSRF token |
| **限流按 IP** | 代理池可绕过 | 可加"按用户名限流"或 TOTP 二次验证 |
| **无多端冲突检测** | 两个标签页同时编辑，后保存覆盖先保存 | 可加 `updatedAt` 乐观锁 |
| **无审计日志** | 谁在什么时候登录/删文查不到 | 单管理员场景优先级低，但建议至少记录登录成功/失败 |
| **无自动化安全测试** | 回归靠人工 | 计划接入 supertest 覆盖 401/400 边界与 XSS 用例 |
| **依赖不自动扫描** | 第三方漏洞靠人工关注 | 可开 Dependabot / `npm audit` 定时任务 |

---

## 4. 部署时的安全检查

上线前逐条确认（详见 [../deploy/deploy.md](../deploy/deploy.md)）：

- [ ] `NODE_ENV=production`，`DB_SYNC=false`
- [ ] `JWT_SECRET` 是随机生成（不是示例值、不是短字符串）
- [ ] 管理员密码 ≥12 字符，哈希由 `npm run hash-password` 生成
- [ ] `.env` 权限 600，属主是运行 Node 的非 root 账号
- [ ] 安全组只放行 80/443，3000 与 3306 不对公网开放
- [ ] `server_tokens off`（不暴露 Nginx 版本）
- [ ] CSP / `X-Content-Type-Options` / `Referrer-Policy` 三个头都在
- [ ] 登录限流生效（连发 6 次登录应看到 429）
- [ ] 数据库备份可恢复（不只是"有备份"，要真的恢复过一次）
- [ ] 证书自动续期（`certbot renew --dry-run` 通过）

---

## 5. 如果发现漏洞

这是个人项目，没有 SRC 也没有赏金，但会认真处理。

请发邮件到 **zrocks@qq.com**，附上复现步骤。请**不要**直接开公开 Issue 或在站点上做破坏性测试
（比如批量注册、压测、上传 webshell）。收到后会尽快确认并修复，修复后在 README 或提交记录里致谢。
