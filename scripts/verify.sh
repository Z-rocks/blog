#!/usr/bin/env bash
# 发布流程与 PR 门禁共用的校验入口。
#
# 之所以抽成脚本而不是把命令抄在两个 workflow 里:两条流水线必须跑完全一样的检查,
# 否则"PR 绿了、发布红了"这种分叉只是时间问题。
#
# 接口测试连的是真实 MySQL(不是 mock),连接参数由调用方通过 TEST_DB_* 注入;
# 未注入时 jest 走 backend/test 里的默认值(127.0.0.1 / root / 空密码 / blog_test)。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> 后端:类型检查 → 构建 → 接口测试"
cd "$ROOT/backend"
npm ci --no-audit --no-fund
npm run typecheck
npm run build
npm test

echo "==> 前端:类型检查 → 构建"
cd "$ROOT/frontend"
npm ci --no-audit --no-fund
npm run typecheck
npm run build

echo "==> 全部通过"
