# We Match

**让合适的人碰面。**

极简供需匹配工具：每人一张名片，可发布「我需要 / 我提供」到公开广场或组织；靠浏览、筛选、搜索找到人，再用对方开放的渠道线下联系。

- 产品文档：[docs/PRD.md](docs/PRD.md)
- 设计规范：[docs/DESIGN.md](docs/DESIGN.md)
- Agent / 开放 API：[docs/AGENT-SKILL.md](docs/AGENT-SKILL.md)

官方站点：https://wematch.v2ai.cn

## 技术栈

- Next.js 16（App Router）+ React 19
- SQLite（better-sqlite3）+ Drizzle ORM
- Tailwind CSS 4
- 手机号 + 短信验证码登录（开发环境验证码打日志，不真实发送）

单文件数据库、零外部服务依赖，适合自部署；**不适配 Vercel serverless**。

## 本地开发

要求：Node.js 20+，包管理器为 pnpm。

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。首次启动会自动创建 `data/we-match.db` 并跑迁移。

可选：写入演示数据（幂等，已有种子用户则跳过）：

```bash
pnpm db:seed
```

开发环境登录时，验证码会打印在服务端日志（形如 `[SMS] 验证码 …`）。

## 环境变量

| 变量 | 说明 |
|------|------|
| `SESSION_SECRET` | Session 签名密钥。生产环境**必填**，至少 32 字符 |
| `DATABASE_PATH` | SQLite 文件路径，默认 `./data/we-match.db` |
| `ADMIN_PHONES` | 管理后台手机号白名单，逗号分隔。生产必配；未配时仅开发环境放行 |

示例：

```bash
export SESSION_SECRET="$(openssl rand -hex 32)"
export ADMIN_PHONES="13800000001"
```

## 常用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发服务器 |
| `pnpm build` | 构建 Skill 包 + Next.js 生产构建 |
| `pnpm start` | 启动生产服务 |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | 根据 schema 生成 Drizzle 迁移 |
| `pnpm db:seed` | 写入演示种子数据 |
| `pnpm build:skill` | 仅构建官方 Agent Skill |

## Agent 接入

用户可在「我的 → Agent 接入」生成 API Key（`wm_` 前缀），用开放 API `/api/v1/*` 以本人身份读写名片、需求与组织。

官方 Claude Skill 位于 [`skills/we-match/`](skills/we-match/)，接口说明见 [`skills/we-match/references/api.md`](skills/we-match/references/api.md)。

```bash
curl -s -H "Authorization: Bearer $WEMATCH_API_KEY" \
  "${WEMATCH_BASE_URL:-https://wematch.v2ai.cn}/api/v1/me"
```

## 部署

```bash
pnpm build
SESSION_SECRET=… ADMIN_PHONES=… pnpm start
```

将 `data/`（或 `DATABASE_PATH` 指向的目录）放在持久化卷上。站点 origin 会根据请求的 `Host` / `X-Forwarded-*` 自动推断，一般无需额外配置。
