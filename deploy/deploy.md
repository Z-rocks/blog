# DEV.LOG 部署笔记

> 这是待执行的部署流程，不代表已经完成服务器、备案或 HTTPS 配置。目标：Linux + Node 22 LTS + MySQL 8.0+ + Nginx。域名、证书路径与目录均须替换。

## 1. 部署前检查

- 替换 `frontend/src/data/projects.ts` 中的姓名、定位、占位项目和联系方式；只填写可验证的经历。
- 完成本地登录、发布 / 草稿、分页 / 标签与 Markdown 安全验收。
- 解析域名到服务器 IP；中国大陆服务器按适用要求完成备案后再提供服务。
- 服务器只向公网开放 80、443 与必要的管理端口；**3000、3306 不对公网开放**。
- 使用独立的非 root 系统账号运行 Node，数据库也使用独立的最小权限账号。
- 设置服务器和数据库时区为 UTC，驱动使用 `timezone: 'Z'`；浏览器负责本地时间显示。

## 2. 安装、构建

将代码放在 `/var/www/devlog`，从该目录运行：

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm run typecheck --prefix backend
npm run build --prefix backend
npm run typecheck --prefix frontend
npm run build --prefix frontend
```

仓库包含 `package-lock.json`，安装统一使用 `npm ci` 以保证依赖可复现。构建验证完成后可以 `npm prune --omit=dev --prefix backend`，下次构建前需重新安装开发依赖。不要把 node_modules 与 dist 提交到 Git。

## 3. 初始化生产数据库

**不要用 `DB_SYNC=true` 在生产数据库自动改表。** 用 DBA / 部署账号执行建库建表，运行账号只授权 CRUD。

```sql
CREATE DATABASE blog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE blog;

CREATE TABLE post (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(160) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  tags JSON NOT NULL,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  INDEX IDX_post_status_created_id (status, createdAt, id),
  INDEX IDX_post_created_id (createdAt, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE USER 'blog_app'@'127.0.0.1' IDENTIFIED BY 'REPLACE_WITH_STRONG_DB_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON blog.* TO 'blog_app'@'127.0.0.1';
```

两条索引对应两种列表查询：`IDX_post_status_created_id` 服务前台（`status` 等值过滤后按 `createdAt, id` 降序），`IDX_post_created_id` 服务后台（不过滤状态但排序方式相同，`status` 前导的索引在这里用不上，会退化成 filesort）。

**已有库的增量变更**（新库可跳过）：

```sql
ALTER TABLE post ADD INDEX IDX_post_created_id (createdAt, id);
```

文章量上来之后，如果标签筛选成为慢查询，可以再加一条多值索引让 `JSON_CONTAINS` 走索引（需 MySQL 8.0.17+）：

```sql
ALTER TABLE post ADD INDEX IDX_post_tags_multi ((CAST(tags AS CHAR(30) ARRAY)));
```

注意这条索引**无法在 `post.entity.ts` 里声明**：TypeORM 不支持多值索引表达式，本地 `DB_SYNC=true` 同步表结构时不会创建它，也不会主动删除它。因此它属于"生产库手工维护"的范畴，代码仓库里只需记住这条 SQL。没有它时标签筛选仍然正确，只是 MySQL 需要沿索引顺序多读一些行再逐行判断 `JSON_CONTAINS`。

SQL 对应当前 `post.entity.ts`。以后变更实体时，先备份、在测试库验证增量 SQL，再手工执行；这里没有自动迁移，也没有导入 / 种子脚本。

MySQL 账号的 host 必须与连接方式匹配，若数据库在其他内网主机上，请限定应用机器的内网地址，不授予 `%`。如果数据库强制 TLS，需要进一步完善驱动证书配置再部署，当前配置面向本机 / 受控内网。

## 4. 环境变量与进程

在 `backend/.env` 中按 README 设置数据库、单管理员哈希和随机 JWT 密钥，生产差异如下：

```dotenv
NODE_ENV=production
PORT=3000
DB_SYNC=false
CORS_ORIGINS=https://example.com
```

```bash
chmod 600 /var/www/devlog/backend/.env
```

确保该文件归应用运行账号所有。不要通过截图、日志或文章暴露凭据。密钥不要放在前端 `VITE_*` 变量中。

先在 `backend/` 运行 `npm start`，验证能启动。常驻运行可在服务器自行创建 systemd unit（运维配置，不新增到仓库）：

```ini
[Unit]
Description=DEV.LOG API
After=network.target

[Service]
Type=simple
User=devlog
Group=devlog
WorkingDirectory=/var/www/devlog/backend
ExecStart=/usr/bin/node /var/www/devlog/backend/dist/main.js
Environment=NODE_ENV=production
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
UMask=0077

[Install]
WantedBy=multi-user.target
```

- Node 路径以服务器 `command -v node` 为准；创建好 `devlog` 系统账号并授予读取代码和 `.env` 的权限。
- 固定 `WorkingDirectory`，Nest ConfigModule 才会读取正确的 `.env`。
- systemd 由服务器管理员配置并执行 `daemon-reload`、`enable --now`，查看 `journalctl -u devlog -f`。
- Nest 绑定 `0.0.0.0` 以支持开发远程预览；生产环境必须通过主机防火墙 / 安全组禁止外网访问 3000。

## 5. 配置 Nginx 与 HTTPS

1. 安装 Nginx 与证书签发工具，创建 `/var/www/certbot`。
2. 将本目录 `nginx.conf` 复制到 `/etc/nginx/conf.d/devlog.conf`。它须由主配置的 `http {}` 引入。
3. 把所有 `example.com`、证书路径和静态目录替换为真实值。
4. **证书还不存在时，不要启用 443 server 块**，先仅保留 HTTP server，运行 `nginx -t` 后加载。
5. 使用 ACME webroot 签发证书，例如：

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d example.com
```

6. 证书签发成功后启用 443 server，验证路径正确，再运行：

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo certbot renew --dry-run
```

生产前端通过同源 `/api` 访问后端，Nginx 的 `proxy_pass` **不带尾部斜杠**，避免丢失 `/api` 前缀。刷新 `/blog/1` 应返回 Vue 的 index.html。不存在的静态资源返回 404，而不是 SPA HTML。

CSP 不允许任何远程脚本、样式或字体（站点使用系统字体回退）；若日后引入远程字体，再按需放开对应域名。确认 HTTPS 稳定后可启用注释中的 HSTS。生产禁止 iframe 嵌入；Vite 开发预览不受这个生产配置影响。

登录入口按 IP 限流，最多每分钟 5 次，允许 5 次突发，超出返回统一 JSON 429。若使用 CDN / 前置代理，应先正确配置只信任代理网段的 `real_ip`，否则会误把所有请求识别为一个代理 IP。Nginx 自身的 413 / 502 等基础设施错误不保证 Nest JSON 格式，前端会显示通用错误提示。

## 6. 上线验收

- [ ] `/`、`/blog`、文章详情与登录页正常，移动端无横向溢出。
- [ ] 直接刷新前端深链接不返回 Nginx 404。
- [ ] `/api/posts` 返回统一分页响应，列表无 content。
- [ ] `/api/posts/tags` 只返回已发布文章的标签，草稿标签不出现。
- [ ] 无 token 请求 `/api/admin/posts` 为 401。
- [ ] 新建草稿不公开，发布可见，修改 / 转草稿 / 删除按预期生效。
- [ ] 非法 DTO 为 400，未知文章为 404，后端错误不泄露 SQL / 堆栈。
- [ ] 登录限流、HTTPS 证书和自动续期验证通过。
- [ ] 外网无法连接 3000 / 3306，MySQL 和系统账号均最小权限。
- [ ] `.env` 不在前端静态目录、Git 或公开备份里。

## 7. 备份、更新与回滚

> **CI/CD**：推送 main 即由 GitHub Actions 自动发布。流水线分两个 job：`test`（后端类型检查 → 构建 → 接口测试，前端类型检查 → 构建）通过后才进入 `deploy`（上传 → 服务器构建 → 原子切换 → 健康检查 → 公网验收）。接口测试跑在 MySQL 8 service container 上，覆盖草稿隔离、列表不带正文、鉴权与校验等契约；**测试不过就不会发布**。本节流程保留为手动通道与紧急恢复手段。

- 数据是 MySQL 中的文章；`docs/` 是独立的手写草稿，不等价于数据库备份。
- 定期用 `mysqldump --single-transaction` 做备份，使用交互密码提示或受限凭据文件，避免命令行明文密码。备份加密保存在服务器外，并定期在测试库验证恢复。
- 更新前保留上一版构建产物并备份数据库。先检查类型和构建，再替换前端 dist、后端 dist 并重启服务；推荐在服务器上使用版本目录与软链接完成原子切换（不改变仓库结构）。
- 数据库结构变更单独记录增量 SQL，避免直接用旧代码覆盖新结构。回滚代码不代表能回滚数据。
- 更改 JWT_SECRET 会使旧 token 失效，需要重新登录；更改管理员密码不会自动吊销已发出的 JWT。

### 凭据轮换

`backend/.env` 里的三份凭据都是明文存放在工作目录。它们不进 Git、也不进部署包（`deploy.sh` 与 CI 都排除 `.env`），但只要这个目录曾经被打包、同步到网盘或分享给他人，就应当视为已泄露并轮换：

| 凭据                | 轮换方式                                                                  | 影响                                                             |
| ------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `JWT_SECRET`        | `openssl rand -hex 32`，替换后重启服务                                     | 已签发的 token 立即失效，需要重新登录；不影响任何数据             |
| `ADMIN_PASSWORD_HASH` | `npm run hash-password --prefix backend` 生成新哈希                      | 下次登录用新密码；**旧 token 仍然有效**（没有服务端会话或撤销名单） |
| `DB_PASSWORD`       | `ALTER USER 'blog_app'@'127.0.0.1' IDENTIFIED BY '<新密码>';` 再更新 `.env` | 数据库与配置要一起改并重启，顺序错会让服务起不来                  |

两个容易踩的点：

- 轮换 `JWT_SECRET` 时别忘了服务器上的 `backend/.env` —— 部署脚本会从上一个版本继承 `.env`，不会用仓库里的值覆盖它，只改本地等于没改。
- 不要在命令行里直接写明文密码（会进 shell history）；`ALTER USER` 用交互式登录后执行。

### 脚本化部署与回滚

仓库已内置脚本（服务器布局：`/var/www/devlog-releases/<版本ID>/` 存每个版本，`/var/www/devlog` 为指向当前版本的软链接，Nginx 与 systemd 只认该路径）：

- **一键部署**：本地 Git Bash 运行 `./deploy/deploy.sh`（加 `-y` 跳过未提交改动确认）。流程：打包工作区 → workbench 上传 → 服务器解包并构建为新版本（版本 ID 形如 `20260908-1830-g09ce12e`，含未提交改动时加 `-dirty` 后缀）→ 自动 `mysqldump` 备份数据库 → 软链接切换 → 健康检查；检查失败自动切回上一版本。远端脚本会常驻 `/usr/local/lib/devlog-remote.sh`。
- **回滚代码**：本地运行 `./deploy/rollback.sh`（回到上一版本）或 `./deploy/rollback.sh <版本ID>`（回到指定版本）；`./deploy/rollback.sh -l` 列出服务器全部版本。等价的服务器端命令：`bash /usr/local/lib/devlog-remote.sh rollback [版本ID]`、`releases`（列版本）、`cleanup`（清旧版本）。
- **保留策略**：代码版本保留最近 10 个，数据库备份保留最近 30 份于 `/var/backups/devlog-db/`。回滚只切代码；恢复数据用 `gzip -d < blog-xxx.sql.gz | mysql blog`（先确认表结构兼容，见上文增量 SQL 原则）。

## 可以沉淀成文章的内容

完成真实部署之后，再记录遇到的问题和证据：history 路由刷新 404、代理前缀、Cookie 与 Bearer token 的取舍、CSP 与 Markdown、数据库账号权限、幂等发布与备份恢复。本文目前是计划与操作清单，不应包装成已经解决的线上经历。
