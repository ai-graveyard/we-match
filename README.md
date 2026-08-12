# We Match

**让合适的人碰面。**

极简供需匹配工具：每人一张名片，可发布「我需要 / 我提供」到公开广场或组织；靠浏览、筛选、搜索找到人，再用对方开放的渠道线下联系。

- 产品文档：[docs/PRD.md](docs/PRD.md)（含里程碑；M6 连接制尚未落地）
- 设计规范：[docs/DESIGN.md](docs/DESIGN.md)
- Agent / 开放 API 方案：[docs/AGENT-SKILL.md](docs/AGENT-SKILL.md)，接口清单见 [skills/we-match/references/api.md](skills/we-match/references/api.md)
- 额度与反滥用设计稿：[docs/QUOTA.md](docs/QUOTA.md)（随 M6 落地，尚无代码）

官方站点：https://wematch.v2ai.org

## 技术栈

- Next.js 16（App Router）+ React 19
- SQLite（better-sqlite3）+ Drizzle ORM
- Tailwind CSS 4
- 邮箱 + 验证码登录（开发环境验证码固定 888888，打日志不真实发送）

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

开发环境登录时，验证码固定 `888888`，同时会打印在服务端日志（形如 `[MAIL] … | We Match 验证码 …`）。

### 内测模式

没配 Resend 时，验证码只会落在日志和管理后台里——那样谁都登不进来，内测没法做。所以生产环境下
**只要没配 `MAIL_PROVIDER=resend`，验证码就自动固定为 `888888`**，登录页会显示「内测中：验证码固定 888888」，
服务端日志也会打一条警告。

想脱离自动判定：

| 场景 | 配置 |
|------|------|
| Resend 已配好，但仍让内测用户用固定码 | `BETA_MODE=1` |
| 邮件还没配好，但宁可谁都登不进去 | `BETA_MODE=0` |
| 正式对外 | 配好 Resend，固定码自动关闭 |

⚠️ 固定码模式下**任何人都能登录成任何人**，只有内测期可以接受。它的判定条件是「邮件通道没配」，
所以正式上线时忘配 Resend 不会让站点悄悄敞开——登录页和日志都会喊出来，但仍请按上线前清单逐条核对。

## 环境变量

完整清单见 [.env.example](.env.example)。

| 变量 | 说明 |
|------|------|
| `APP_PORT` | Docker 部署时宿主机对外映射端口。服务器和别的项目共用，生产环境**必填**，不能用默认的 `3000` |
| `SESSION_SECRET` | Session 签名密钥。生产环境**必填**，至少 32 字符 |
| `DATABASE_PATH` | SQLite 文件路径，默认 `./data/we-match.db` |
| `ADMIN_EMAILS` | 管理后台登录邮箱白名单，逗号分隔。生产必配；未配时仅开发环境放行 |
| `MAIL_PROVIDER` | 邮件通道：`log`（默认，验证码打日志）或 `resend`。**生产必须配 `resend`**，否则用户收不到验证码 |
| `RESEND_API_KEY` | Resend API Key（`MAIL_PROVIDER=resend` 时必填） |
| `MAIL_FROM` | 发信人，域名须已在 Resend 验证过，如 `We Match <noreply@wematch.v2ai.org>` |
| `BETA_MODE` | 内测模式，验证码固定 `888888`。不填时按「没配 Resend = 还在内测」自动判定；`1` 强制开，`0` 强制关。**开着等于任何人可以登录成任何人**，正式对外前必须关掉 |
| `SITE_ORIGIN` | 对外站点 origin。生产环境建议固定配置，防止 Agent 安装指令和告知邮件受 Host 头影响 |

示例：

```bash
export SESSION_SECRET="$(openssl rand -hex 32)"
export ADMIN_EMAILS="you@example.com"
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
| `pnpm db:backup` | 在线备份 SQLite 到 `./backups`（保留最近 14 份） |
| `pnpm build:skill` | 仅构建官方 Agent Skill |

## Agent 接入

用户可在「我的 → Agent 接入」生成 API Key（`wm_` 前缀），用开放 API `/api/v1/*` 以本人身份读写名片、需求与组织。

官方 Claude Skill 位于 [`skills/we-match/`](skills/we-match/)，接口说明见 [`skills/we-match/references/api.md`](skills/we-match/references/api.md)。

```bash
curl -s -H "Authorization: Bearer $WEMATCH_API_KEY" \
  "${WEMATCH_BASE_URL:-https://wematch.v2ai.org}/api/v1/me"
```

## 部署

### Docker（推荐）

```bash
cp .env.example .env   # 填好 APP_PORT（服务器和别的项目共用，别用默认 3000）、SESSION_SECRET、ADMIN_EMAILS、MAIL_PROVIDER=resend 及 RESEND_API_KEY / MAIL_FROM
docker compose up -d --build
```

数据与备份分别在命名卷 `we-match-data` / `we-match-backups`。前面挂一层反向代理（Caddy / Nginx）做 HTTPS——生产 cookie 带 `secure` 标志，**必须走 HTTPS** 才能登录。

根目录的 `Makefile` 把常用操作包了一层：

| 命令 | 作用 |
| --- | --- |
| `make build` | 构建镜像 |
| `make start` / `make stop` / `make restart` | 起停服务 |
| `make logs` | 跟踪日志 |
| `make deploy` | `git pull` + 重新构建 + 重启，服务器上用这条 |

### CI/CD

- `.github/workflows/ci.yml`：push / PR 时跑 `pnpm lint` + `pnpm build`。
- `.github/workflows/deploy.yml`：push 到 `main` 时 SSH 到服务器，在 `DEPLOY_PATH` 目录跑 `make deploy`（`git pull` + 本地建镜像 + 重启，不经镜像仓库，和 [fastype](../fastype) 同一套模式）。

需要在本仓库的 GitHub Secrets 中配置：

| Secret | 说明 |
| --- | --- |
| `EC2_SSH_KEY` | 部署用私钥 |
| `EC2_KNOWN_HOSTS` | `ssh-keyscan` 得到的 known_hosts 内容 |
| `EC2_HOST` / `EC2_PORT` / `EC2_USER` | 服务器地址 / SSH 端口 / 登录用户 |
| `DEPLOY_PATH` | 服务器上本仓库的 git checkout 目录 |

服务器是和其他项目共用的一台机器，`make deploy` 用 Dockerfile 里的 `com.ai-graveyard.project=we-match` 标签把镜像清理限定在自己的镜像上，不影响别的服务。

### 裸机

```bash
pnpm build
SESSION_SECRET=… ADMIN_EMAILS=… MAIL_PROVIDER=resend … pnpm start
```

将 `data/`（或 `DATABASE_PATH` 指向的目录）放在持久化卷上，并用 systemd / pm2 守护进程。站点 origin 会根据请求的 `Host` / `X-Forwarded-*` 自动推断，一般无需额外配置。

### 备份

单文件 SQLite 是全部数据，务必每日备份并同步异地：

```bash
0 4 * * * cd /path/to/we-match && node scripts/backup-db.mjs
```

### 上线前检查

- [ ] 邮件：Resend 发信域名已验证（SPF / DKIM 已生效），`MAIL_PROVIDER=resend` 已配置并真实收到验证码；顺手确认没进垃圾箱
- [ ] 内测模式已关闭：登录页**不再**显示「内测中：验证码固定 888888」，验证码是随机的（配好 Resend 即自动关闭）
- [ ] 法务：填写 [lib/brand.ts](lib/brand.ts) 中的运营者名称与联系邮箱（`/terms`、`/privacy` 会展示），文案经过人工确认
- [ ] `SESSION_SECRET` 已用 `openssl rand -hex 32` 生成，`ADMIN_EMAILS` 已配置
- [ ] `APP_PORT` 已配置为分配给 we-match 的实际端口，不是默认的 `3000`
- [ ] 反向代理 HTTPS 就绪，备份 cron 已配置
