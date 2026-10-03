# We Match

**你有所需，我有所供。**

极简供需匹配工具：每人一张名片，可发布「我需要 / 我提供」到公开广场或组织；通过浏览、搜索和结构化候选找到人，由用户在网页举手、接受并交换联系方式。Agent 可代办注册、维护名片和需求、筛选候选。

- 产品文档：[docs/PRD.md](docs/PRD.md)（当前功能与边界，已同步 2026-10-03 代码）
- 设计规范：[docs/DESIGN.md](docs/DESIGN.md)
- 产品优化与下一阶段验证：[docs/PRODUCT-VALIDATION.md](docs/PRODUCT-VALIDATION.md)（首次发布、候选发现、连接邮件、七天结果与小范围运营实验）
- Agent / 开放 API 方案：[docs/AGENT-SKILL.md](docs/AGENT-SKILL.md)，接口清单见 [skills/we-match/references/api.md](skills/we-match/references/api.md)
- 额度与反滥用：[docs/QUOTA.md](docs/QUOTA.md)（发布/举手/接受、赚回及 P4 降额已实现；默认 shadow，未落地规则单列）
- 重构蓝图：[docs/REFACTOR.md](docs/REFACTOR.md)（当前分层、例外与剩余差距）

官方站点：https://wematch.v2ai.org

## 当前功能

- 中英文界面、明暗主题；广场按范围、类型、标签和关键词筛选，支持三种排序及每页 20 条分页。
- 发布页支持写作提纲、补齐空联系方式、当前标签页草稿恢复；自己的开放需求详情展示最多三位不同发布者的候选。
- 名片逐字段控制可见性；组织审批、连接管理、举报拉黑和治理后台已实现。
- 举手、接受、拒绝可发送连接邮件，用户可在设置中关闭；无持久投递队列或自动重试。
- 后台提供观察满七天的需求结果统计；它记录举手、接受、完成确认，不等同于实际成交。

以上描述仓库实现，不代表当前线上部署已验收。开发约定见 [AGENTS.md](AGENTS.md)，历史本地 UI 验收见 [docs/UI-REVIEW.md](docs/UI-REVIEW.md)。

## 技术栈

- Next.js 16（App Router）+ React 19
- SQLite（better-sqlite3）+ Drizzle ORM
- Tailwind CSS 4 + shadcn/ui（Radix）
- 邮箱 + 验证码登录（开发环境验证码固定 888888，打日志不真实发送）

核心数据使用单文件数据库，无需外部数据库或缓存；正式邮件投递依赖 Resend，适合自部署；**不适配 Vercel serverless**。

## 本地开发

要求：Node.js 22，包管理器为 pnpm（版本以 `package.json` 的 `packageManager` 为准）。

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。数据库模块首次加载会自动创建 `data/we-match.db` 并跑迁移（构建时也可能触发）。需要隔离数据时，先设置 `DATABASE_PATH`。

可选：写入演示数据（幂等，已有种子用户则跳过）：

```bash
pnpm db:seed
```

开发环境登录时，验证码固定 `888888`，同时会打印在服务端日志（形如 `[MAIL] … | We Match 验证码 …`）。

### 内测模式

生产环境默认**失败关闭**：没配 Resend 时验证码只会落在日志和管理后台里，外部用户无法登录，
但绝不会自动退回万能验证码。只有显式设置 `BETA_MODE=1` 才会把验证码固定为 `888888`，
登录页同时显示「内测中：验证码固定 888888」，服务端日志也会打一条警告。

想脱离自动判定：

| 场景 | 配置 |
|------|------|
| 明确的小范围内测，允许所有测试账号共用固定码 | `BETA_MODE=1` |
| 邮件还没配好 | 不设置或设置 `BETA_MODE=0`，外部用户无法登录 |
| 正式对外 | 配好 Resend，并保持 `BETA_MODE` 非 `1` |

⚠️ 固定码模式下**任何人都能登录成任何人**，只允许测试账号使用。正式上线时忘配 Resend
会导致用户无法登录，而不是让站点悄悄敞开。

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
| `BETA_MODE` | 内测模式，`1` 时验证码固定 `888888`；不填或其他值均关闭。**开着等于任何人可以登录成任何人**，正式对外绝不能设为 `1` |
| `QUOTA_P4_MODE` | P4 反滥用惩罚阶梯执行模式：`shadow`（默认，只观测写 `quota_penalty_shadow` 事件、不降额）或 `enforce`（真正降额）。先在 shadow 下核对没误伤真实用户，再切 `enforce` |
| `SITE_ORIGIN` | 对外站点 origin。安装指令优先使用它；连接通知邮件必须有有效固定值才发送，不回退到请求头。CI smoke check 另读取同名 GitHub Secret |
| `BACKUP_KEEP` | 备份脚本保留份数，默认 14；Docker 中覆盖此值需另行传入容器环境 |

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
| `pnpm test` | Vitest；每个测试环境使用临时 SQLite 数据库 |
| `pnpm db:generate` | 根据 schema 生成 Drizzle 迁移 |
| `pnpm db:seed` | 写入演示种子数据 |
| `pnpm db:backup` | 非 Docker 部署：在线备份 `DATABASE_PATH`（默认 `./data/we-match.db`）到 `./backups` |
| `pnpm build:skill` | 仅构建官方 Agent Skill |

## Agent 接入

用户可在「我的 → Agent」生成 API Key（`wm_` 前缀），也可通过邮箱验证码 API 注册或签发。每人最多 3 把，明文只在创建时显示，服务端保存哈希和末四位。开放 API `/api/v1/*` 支持本人名片与需求读写、候选匹配、组织与成员读取、只读通知；组织管理和社交操作仍在网页完成。

匹配以用户自己的开放需求为起点：`GET /api/v1/matches?need=<id>` 由平台召回反向类型、
同范围、仍开放的候选并给出重合标签；Agent 再结合只留在端侧的私有画像做语义判断，
只向用户解释少数真正值得联系的人。平台不替人做举手或接受决定。

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
| `make backup` | 在运行中的应用容器内备份 `/app/data` 到备份卷 |
| `make deploy` | `git pull` + 备份数据库 + 重新构建 + 重启 + 清理，服务器上用这条 |

### CI/CD

CI 与部署合并在 `.github/workflows/ci.yml`，一条流水线两个 job：

- `check`：push / PR / 手动触发都跑 `pnpm lint` + `pnpm test` + `pnpm build`（`next build` 顺带类型检查）。
- `deploy`：仅在 push 到 `main` 或手动触发、且 `check` 全绿后执行；PR **不部署**。SSH 到服务器在 `DEPLOY_PATH` 跑 `make deploy`（`git pull` + 备份 + 本地建镜像 + 重启，不经镜像仓库），生产部署带 `production-deploy` 并发锁串行执行。部署后对 `SITE_ORIGIN/api/health` 做 HTTPS smoke check（未配 `SITE_ORIGIN` 时自动跳过并提示）。

`/api/health` 是最小探针，只在库能查时返回 `{ "ok": true }`，不暴露版本或迁移等内部信息。

需要在本仓库的 GitHub Secrets 中配置：

| Secret | 说明 |
| --- | --- |
| `EC2_SSH_KEY` | 部署用私钥 |
| `EC2_KNOWN_HOSTS` | `ssh-keyscan` 得到的 known_hosts 内容 |
| `EC2_HOST` / `EC2_PORT` / `EC2_USER` | 服务器地址 / SSH 端口 / 登录用户 |
| `DEPLOY_PATH` | 服务器上本仓库的 git checkout 目录 |
| `SITE_ORIGIN` | 部署后 smoke check 的公开地址（未配则跳过该步） |

分支保护建议：把 `check` 设为 `main` 的必需状态检查，让未过 CI 的改动无法合并。

服务器是和其他项目共用的一台机器，`make deploy` 用 Dockerfile 里的 `com.ai-graveyard.project=we-match` 标签把镜像清理限定在自己的镜像上，不影响别的服务。

### 裸机

```bash
pnpm build
SESSION_SECRET=… ADMIN_EMAILS=… MAIL_PROVIDER=resend … pnpm start
```

将 `data/`（或 `DATABASE_PATH` 指向的目录）放在持久化卷上，并用 systemd / pm2 守护进程。生产设置固定 `SITE_ORIGIN`；普通站点链接未配置时会回退到请求头，但连接通知邮件不会。

### 备份

单文件 SQLite 是全部数据，务必每日备份并同步异地：

```bash
0 4 * * * cd /path/to/we-match && make backup
```

### 上线前检查

- [ ] 邮件：Resend 发信域名已验证（SPF / DKIM 已生效），`MAIL_PROVIDER=resend` 已配置并真实收到验证码；顺手确认没进垃圾箱
- [ ] 内测模式已关闭：登录页**不再**显示「内测中：验证码固定 888888」，验证码是随机的（已配好 Resend，且 `BETA_MODE` 非 `1`）
- [ ] 法务：[lib/brand.ts](lib/brand.ts) 中的运营者名称与联系邮箱核对正确（`/terms`、`/privacy` 会展示，当前已填写，部署者需核对为自己的真实运营信息），协议与政策全文经过人工确认
- [ ] `SESSION_SECRET` 已用 `openssl rand -hex 32` 生成，`ADMIN_EMAILS` 已配置
- [ ] `APP_PORT` 已配置为分配给 we-match 的实际端口，不是默认的 `3000`
- [ ] 反向代理 HTTPS 就绪，备份 cron 已配置
- [ ] CI：`check` 已设为 `main` 的必需状态检查；如需部署后 smoke check，`SITE_ORIGIN` Secret 已配置
- [ ] 额度惩罚：`QUOTA_P4_MODE` 默认 `shadow`；观察 `quota_penalty_shadow` 事件确认无误伤后，再决定是否切 `enforce`
- [ ] 部署后访问 `SITE_ORIGIN/api/health` 返回 `{ "ok": true }`
