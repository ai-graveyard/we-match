# We Match 开发约定

最近核对：2026-10-03。本文约束仓库内开发；当前行为以代码和测试为准，部署状态需另行验收。

## 项目与入口

- Node.js 22、pnpm（版本见 `package.json`）；Next.js App Router + React + SQLite/better-sqlite3 + Drizzle + Tailwind 4 + shadcn/Radix。单实例自部署，数据库需要持久化，不适配 Vercel serverless。
- 页面位于 `app/[lang]/`，支持 `zh` / `en`；`proxy.ts` 处理语言前缀。站内链接复用 `LocaleLink` / `localePath`，新增文案同步 `lib/i18n/dict/` 中的中英字典。
- 主导航只有广场和我的；组织需求通过广场范围切换。个人中心以 `?section=` 切换栏目，连接管理另有 `/me/connections`。
- 开始相关改动前读 `docs/PRD.md`（功能）、`docs/DESIGN.md`（UI）、`docs/QUOTA.md`（实际额度与未落地项）、`docs/REFACTOR.md`（分层）。近期发布/匹配行为见 `docs/PRODUCT-VALIDATION.md`。

## 业务边界与分层

- 主要业务写入复用 `lib/*-service.ts`；Action 和 API Route 负责鉴权、参数适配和刷新/跳转。新增共享规则放 service；现有偏好、通知等直接写库例外见 REFACTOR，不把分层目标描述为全仓库已完成。
- 复杂读模型优先复用 `lib/queries.ts`，候选召回在 `lib/matches.ts`，指标在 `lib/product-metrics.ts`。名片过滤统一走 `lib/card.ts`；列表公开作者投影复用 `lib/public-profile.ts`，隐藏字段不得进入客户端数据。
- 联系方式默认 `connected`；用户主动选择的 `authenticated`、`orgs`、`hidden` 仍有效。组织成员身份不绕过 `connected`。接受举手与双向 `contact_reveals` 写入共用 `IMMEDIATE` 事务，事务回调保持同步。
- 删除需求、解散组织保留需求/连接/揭示审计行；需求用 `deletedAt` 撤下。不要改成级联硬删除来清理台账。改 schema 时生成并核对 Drizzle SQL 和 journal，数据库模块加载时自动迁移。
- 网页与 Agent 共用用户额度；数值在 `lib/quota.ts`。超时未处理举手会阻止延长需求期限/改永久/重开；不要通过其他入口绕过。`QUOTA_P4_MODE` 默认 `shadow`，具体覆盖范围见 QUOTA。
- API 在 `app/api/v1/`：除 `/auth/code`、`/auth/token` 外需 Bearer Key；未知 JSON 字段显式报错。Key 只在创建时返回明文，存储 SHA-256 与末四位；不得写入日志、文档或提交。
- v1 不提供举手/接受/拒绝写接口，也没有独立连接列表读取接口。Agent 用候选和只读通知辅助判断，社交操作由用户在网页执行。API 变更同步 `skills/we-match/references/api.md`，再运行 `pnpm build:skill`。
- 匹配：反向类型、同范围、开放未过期、权限与拉黑是硬条件，标签重合用于排序。网页最多展示三位不同作者（前 100 条候选内去重）；API 按需求返回。私有画像留在端侧。
- 发布页可补空联系方式，名片与需求原子保存；不得覆盖已有或隐藏联系方式。sessionStorage 草稿按用户/需求隔离，主动恢复、按提交 token 清理，不存联系方式原值。
- 连接邮件由 `lib/activity.ts` 的 `after()` 调度，固定 `SITE_ORIGIN` + 登录邮箱，受偏好控制；不含联系方式/举手留言，没有持久队列或自动重试。

## UI 约定

- 复用 `components/ui/` 的 shadcn 组件及 `lib/ui.ts` 布局常量。保留 DESIGN 的黑白灰、焦橙主动作、8/12px 圆角、无阴影和 640px 内容宽度。
- 可见选择器用 Select / ToggleGroup；日期用 Calendar + Popover + Select；验证码用 InputOTP；弹层用 Dialog / AlertDialog。保留表单 `name`、标签、disabled/required 与实际提交值。
- React Action 的全受控表单按现有实现拦截 reset，防止 Radix Select 回退旧值；验证连续两次保存。Portal 中按钮和表单一起放入弹层。
- 窄屏允许长文案换行；动作按钮最小 44px，不通过挤压英文标签适配。共用控件改动检查 320px、390px、1280px，以及中英、明暗主题、焦点循环、Escape 和焦点返回。

## 开发与验证

- 安装/启动：`pnpm install`、`pnpm dev`；指定地址示例：`pnpm dev -H 127.0.0.1 -p 3027`。
- `pnpm lint`、`pnpm test`、`pnpm build` 是 CI 检查；build 先打包 Skill，再运行 Next 生产构建和类型检查。针对代码改动运行相关检查；纯文档修改核对来源、链接及 `git diff --check`，不必重复构建。
- Vitest 使用 `tests/setup.ts` 创建临时数据库，mock `after()`；邮件测试不证明 Resend 实际送达。浏览器写操作验证使用显式 `DATABASE_PATH` 的隔离测试库。
- SQLite 模块在导入时打开数据库并跑迁移，包括构建 worker；需要隔离时必须在启动命令前设置 `DATABASE_PATH`。不要用生产库做种子或边界测试。
- 开发环境固定码为 `888888`；生产仅显式 `BETA_MODE=1` 开启。生产需 `SESSION_SECRET`、邮件配置和 HTTPS，Docker 还需指定 `APP_PORT`。环境变量见 `.env.example`。
- `make deploy` 会拉代码、备份、构建、重启并清理镜像，是部署操作。仅做文档/代码修改不代表需要运行它。真实投递和上线验收分别记录，不用历史 UI/E2E 报告代替本次验证。

## 文档维护

功能变更同步 README/PRD；控件变更同步 DESIGN；接口参数同步 Skill API 参考；额度变更同步 QUOTA。明确区分当前实现、设计目标、历史验收和未实现项。`docs/UI-REVIEW.md` 与 `docs/AGENT-E2E-TEST-RUNBOOK.md` 的历史结果保留时间和环境。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
