# 文档索引

这个目录放"解释性文档"：为什么这么设计、怎么跑、接口长什么样、安全上防了什么。
**部署手册**在 [`../deploy/deploy.md`](../deploy/deploy.md)，不在这个目录。

---

## 先读哪篇

| 你想干什么 | 读这篇 |
|---|---|
| 第一次接触这个项目，想知道它是什么 | [../README.md](../README.md) |
| 想理解代码结构、一次请求怎么走完 | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 想在自己机器上跑起来、改代码 | [DEVELOPMENT.md](DEVELOPMENT.md) |
| 要调接口、写脚本、对接前端 | [API.md](API.md) |
| 关心安全、要上线、要评审 | [SECURITY.md](SECURITY.md) |
| 要部署到服务器 | [../deploy/deploy.md](../deploy/deploy.md) |

---

## 文档清单

| 文件 | 内容 | 读者 |
|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 运行时拓扑、后端模块与请求生命周期、鉴权流程、数据表设计、前端结构与渲染链路、构建与发布拓扑、关键约束表 | 开发者 |
| [DEVELOPMENT.md](DEVELOPMENT.md) | 环境要求、数据库初始化、`.env` 全量说明、启动、常用脚本、调试技巧、手工验收清单、常见问题 | 开发者 |
| [API.md](API.md) | 响应格式与状态码、鉴权约定、8 个接口的参数 / 校验 / 响应 / 错误、完整 curl 示例 | 前端 / 调用方 |
| [SECURITY.md](SECURITY.md) | 威胁模型、XSS 两层过滤、CSP、令牌设计、限流、校验、已知缺口、上线检查表 | 评审 / 运维 |
| [001-idempotency-payment-callback.md](001-idempotency-payment-callback.md) | 文章草稿：支付回调的幂等设计（设计分析，**不是**生产事故复盘） | 读者 |

---

## 写文档的约定

- **解释为什么，不解释代码在做什么**。"这里用了 JSON 列"没有价值，
  "为什么没拆标签表"有价值
- **缺口照实写**。已知限制不藏在心里，写进文档比藏在 TODO 里有用
- **命令要能直接复制跑**。写 `npm ci` 就不写"安装依赖"
- **改代码时同步改文档**。文档过期比没有文档更误导人

---

## 待补的文档

- [ ] `TESTING.md`：自动化测试接入后的测试策略与用例清单
- [ ] `DEPLOYMENT-TROUBLESHOOTING.md`：线上故障排查手册（当前散落在 `deploy/deploy.md` 末尾）
