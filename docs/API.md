# 接口文档

> 后端所有接口都在 `/api` 前缀下。开发环境 `http://localhost:3000/api`，
> 生产环境同源 `http://<站点>/api`（Nginx 反代）。
> 架构背景见 [ARCHITECTURE.md](ARCHITECTURE.md)。

- 版本：v1（对应 `main` 分支）
- 最后更新：2026-10

---

## 1. 通用约定

### 1.1 响应格式

**成功**（创建返回 HTTP 201，其余返回 HTTP 200）：

```json
{ "code": 0, "message": "ok", "data": {} }
```

**失败**（保留真实 HTTP 状态码）：

```json
{ "code": 401, "message": "用户名或密码错误", "data": null }
```

`code` 与 HTTP 状态码一致，`data` 恒为 `null`。**不会用 HTTP 200 冒充失败**——
这样 `curl -w '%{http_code}'`、浏览器 Network 面板、任何监控工具看到的都是真相。

### 1.2 状态码

| 状态码 | 含义 | 典型场景 |
|---|---|---|
| 200 | 成功 | 查询、更新、删除、登录 |
| 201 | 已创建 | `POST /admin/posts` |
| 400 | 参数错误 | 缺字段、类型错、超长、多余字段、分页越界 |
| 401 | 未认证 | 缺 token、token 过期、用户名或密码错误 |
| 404 | 不存在 | 文章不存在，或文章是草稿（前台视角） |
| 413 | 请求体过大 | 超过 1 MB |
| 429 | 限流 | 登录过于频繁（Nginx 层，5 次/分钟/IP） |
| 500 | 服务端错误 | 未捕获异常（不返回堆栈与 SQL） |

### 1.3 鉴权

除标注 **公开** 的接口外，其余都需要：

```
Authorization: Bearer <token>
```

token 由 `/api/auth/login` 签发，HS256，有效期 **7 天**（604800 秒），
校验签名 + 过期时间 + `issuer=devlog-api` + `audience=devlog-admin` + `sub=admin`。

### 1.4 时间与分页

- 时间一律 **ISO 8601 UTC 字符串**（如 `2026-09-11T04:22:31.000Z`），由前端按浏览器时区显示
- 分页 `data` 结构：

```json
{ "items": [], "total": 3, "page": 1, "pageSize": 10 }
```

| 参数 | 默认 | 范围 | 说明 |
|---|---|---|---|
| `page` | 1 | 1 – 1000000 | 页码 |
| `pageSize` | 10 | 1 – 50 | 每页条数 |
| `tag` | — | 1–30 字符 | 标签筛选，**完整、区分大小写**的匹配 |

---

## 2. 接口一览

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | `/api/auth/login` | 公开 | 登录，返回 JWT |
| GET | `/api/posts` | 公开 | 已发布文章列表（分页、可按标签筛选） |
| GET | `/api/posts/:id` | 公开 | 已发布文章详情（含正文） |
| GET | `/api/admin/posts` | JWT | 全部状态的文章列表（不含正文） |
| GET | `/api/admin/posts/:id` | JWT | 任意状态的文章详情（含正文） |
| POST | `/api/admin/posts` | JWT | 新建文章 |
| PUT | `/api/admin/posts/:id` | JWT | 完整更新文章 |
| DELETE | `/api/admin/posts/:id` | JWT | 删除文章 |

---

## 3. 认证

### POST `/api/auth/login`

**公开** · 受 Nginx 限流（5 次/分钟/IP，超出返回 429）

请求：

```json
{ "username": "admin", "password": "your-password" }
```

| 字段 | 类型 | 约束 |
|---|---|---|
| `username` | string | 1–64 字符 |
| `password` | string | 1–72 字符（超过 72 **字节**会被直接拒绝） |

响应 `200`：

```json
{ "code": 0, "message": "ok", "data": { "token": "eyJhbGciOi...", "expiresIn": 604800 } }
```

错误：

| 状态码 | 场景 |
|---|---|
| 400 | 字段缺失 / 类型错 / 超长 |
| 401 | 用户名或密码错误（**不区分是哪一项**，避免枚举用户名） |
| 429 | 登录过于频繁 |

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"your-password"}'
```

> 密码超过 72 字节会被拒绝，是因为 bcrypt 只使用前 72 字节。不拒绝的话，
> 两个前 72 字节相同的密码会同时有效。

---

## 4. 前台文章接口

### GET `/api/posts`

**公开** · 只返回 `status = published` 的文章

查询参数：`page` / `pageSize` / `tag`（见 [1.4](#14-时间与分页)）

响应 `200`（**列表项不含 `content`**）：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "id": 3,
        "title": "RAG 报价引擎复盘",
        "summary": "一个能跑的链路，和一堆我没做完的验证。",
        "tags": ["RAG", "LLM"],
        "status": "published",
        "createdAt": "2026-09-10T08:12:00.000Z",
        "updatedAt": "2026-09-10T08:12:00.000Z"
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 10
  }
}
```

排序固定为 `createdAt DESC, id DESC`（同一秒创建的两篇文章顺序也是确定的，分页不会重复或漏项）。

```bash
# 按标签筛选
curl -s 'http://localhost:3000/api/posts?page=1&pageSize=10&tag=RAG'
```

### GET `/api/posts/:id`

**公开** · 只返回已发布文章，**包含 `content`**

响应 `200`：`data` 为完整文章对象（字段同上 + `content`）

错误：

| 状态码 | 场景 |
|---|---|
| 400 | `:id` 不是整数（`ParseIntPipe`） |
| 404 | 文章不存在，**或文章是草稿**（前台不该知道草稿是否存在） |

```bash
curl -s http://localhost:3000/api/posts/3
```

---

## 5. 后台文章接口

以下接口都需要 `Authorization: Bearer <token>`，缺少或失效返回 **401**。

### GET `/api/admin/posts`

返回**全部状态**（含草稿）的列表，同样分页、同样不含 `content`、同样支持 `tag` 筛选。

### GET `/api/admin/posts/:id`

返回任意状态的文章详情，**包含 `content`**（编辑时需要）。不存在返回 404。

### POST `/api/admin/posts`

创建文章，成功返回 **201** 与完整文章对象。

```json
{
  "title": "为什么我们的 RAG 案例库没有做 chunking",
  "summary": "记录一次取舍：目标是案例匹配，不是文档问答。",
  "content": "## 背景\n\n正文使用 Markdown。",
  "tags": ["RAG", "向量检索"],
  "status": "draft"
}
```

| 字段 | 类型 | 约束 |
|---|---|---|
| `title` | string | 必填，**trim 后** 1–160 字符 |
| `summary` | string | 必填，trim 后 ≤500 字符（可为空串） |
| `content` | string | 必填，≤100000 字符，且**不能只包含空白字符** |
| `tags` | string[] | 必填，≤8 个，自动去重（去重后仍超 8 个报错），每项 trim 后 1–30 字符 |
| `status` | string | 必填，`draft` 或 `published` |

**未声明的字段会被拒绝**（`forbidNonWhitelisted`），例如多传一个 `id` 直接 400。

### PUT `/api/admin/posts/:id`

**完整更新**：必须提供全部五个字段，缺任何一项都是 400。
不提供"部分更新"语义，是为了避免"只想改标题却把标签清空"这类事故。

响应 `200` 与创建相同。文章不存在返回 404。

### DELETE `/api/admin/posts/:id`

响应 `200`：

```json
{ "code": 0, "message": "ok", "data": { "id": 7 } }
```

不存在返回 404。**物理删除，不可恢复**——前端有二次确认。

---

## 6. 完整示例：登录后发一篇文章

```bash
BASE=http://localhost:3000/api

# 1. 登录拿 token
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"your-password"}' \
  | python -c 'import sys,json; print(json.load(sys.stdin)["data"]["token"])')

# 2. 建草稿
curl -s -X POST $BASE/admin/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"测试文章","summary":"摘要","content":"## 正文","tags":["test"],"status":"draft"}'

# 3. 前台看不到（404）
curl -s -o /dev/null -w '%{http_code}\n' $BASE/posts/1

# 4. 改成发布
curl -s -X PUT $BASE/admin/posts/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"测试文章","summary":"摘要","content":"## 正文","tags":["test"],"status":"published"}'

# 5. 前台可见（200）
curl -s -o /dev/null -w '%{http_code}\n' $BASE/posts/1
```

---

## 7. 常见 400 的原因

| 报错关键字 | 原因 |
|---|---|
| `title should not be empty` | 标题全是空格，trim 后为空 |
| `content 不能仅包含空白字符` | 正文只有空格 / 换行 |
| `tags must be an array` | 标签传了字符串而不是数组 |
| `each value in tags must be longer than or equal to 1 characters` | 有标签 trim 后为空 |
| `property xxx should not exist` | 传了 DTO 未声明的字段 |
| `page must not be less than 1` | 分页越界 |
| `status must be one of the following values: draft, published` | 状态值非法 |

多个校验错误会合并成一条，用 `；` 分隔。
