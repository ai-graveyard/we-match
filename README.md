# We Match

**让合适的人碰面。**

极简供需匹配工具：每人一张名片，可发布「我需要 / 我提供」到公开广场或组织；靠浏览、筛选、搜索找到人，再用对方开放的渠道线下联系。

- 产品文档：[docs/PRD.md](docs/PRD.md)
- 设计规范：[docs/DESIGN.md](docs/DESIGN.md)
- Agent / 开放 API：[docs/AGENT-SKILL.md](docs/AGENT-SKILL.md)

官方站点：https://wematch.v2ai.org

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

完整清单见 [.env.example](.env.example)。

| 变量 | 说明 |
|------|------|
| `APP_PORT` | Docker 部署时宿主机对外映射端口。服务器和别的项目共用，生产环境**必填**，不能用默认的 `3000` |
| `SESSION_SECRET` | Session 签名密钥。生产环境**必填**，至少 32 字符 |
| `DATABASE_PATH` | SQLite 文件路径，默认 `./data/we-match.db` |
| `ADMIN_PHONES` | 管理后台手机号白名单，逗号分隔。生产必配；未配时仅开发环境放行 |
| `SMS_PROVIDER` | 短信通道：`log`（默认，验证码打日志）或 `aliyun`。**生产必须配 `aliyun`**，否则用户收不到验证码 |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` / `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | 阿里云 AccessKey（`SMS_PROVIDER=aliyun` 时必填） |
| `ALIYUN_SMS_SIGN_NAME` / `ALIYUN_SMS_TEMPLATE_CODE` | 阿里云短信签名与模板（模板变量为 `${code}`） |

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
cp .env.example .env   # 填好 APP_PORT（服务器和别的项目共用，别用默认 3000）、SESSION_SECRET、ADMIN_PHONES、SMS_PROVIDER=aliyun 及短信密钥
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
SESSION_SECRET=… ADMIN_PHONES=… SMS_PROVIDER=aliyun … pnpm start
```

将 `data/`（或 `DATABASE_PATH` 指向的目录）放在持久化卷上，并用 systemd / pm2 守护进程。站点 origin 会根据请求的 `Host` / `X-Forwarded-*` 自动推断，一般无需额外配置。

### 备份

单文件 SQLite 是全部数据，务必每日备份并同步异地：

```bash
0 4 * * * cd /path/to/we-match && node scripts/backup-db.mjs
```

### 上线前检查

- [ ] 短信：阿里云签名 / 模板已过审，`SMS_PROVIDER=aliyun` 已配置并真机收到验证码
- [ ] 法务：填写 [lib/brand.ts](lib/brand.ts) 中的运营者名称与联系邮箱（`/terms`、`/privacy` 会展示），文案经过人工确认
- [ ] `SESSION_SECRET` 已用 `openssl rand -hex 32` 生成，`ADMIN_PHONES` 已配置
- [ ] `APP_PORT` 已配置为分配给 we-match 的实际端口，不是默认的 `3000`
- [ ] 反向代理 HTTPS 就绪，备份 cron 已配置
