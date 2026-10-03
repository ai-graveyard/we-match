# We Match 架构与重构状态

- 版本：v1.2
- 核对日期：2026-10-03
- 状态：主要领域服务已拆出；本文记录当前分层和剩余差距，不证明线上部署状态。

## 1. 当前实现

| 领域 | 实现与边界 |
| --- | --- |
| 页面与 UI | `app/[lang]/` 中英双语；shadcn/Radix 共用控件；主导航广场/我的，组织流用范围切换 |
| 发布 | `needs-service` 共用网页/API 校验与额度；网页补卡与发布原子保存；sessionStorage 草稿在客户端 |
| 候选 | `lib/matches.ts` 反向同范围召回；网页按作者去重最多三人，API 按需求返回，端侧 Agent 判断语义 |
| 连接 | `connections-service` 状态机、接受与双向揭示事务；`/me/connections` 管理收到/发起；无社交 API 写端点 |
| 额度 | `lib/quota.ts` 发布/举手/接受及安全、组织动作额度；赚回与日额度惩罚，默认 shadow；未落地项见 QUOTA 第 12 节 |
| 删除 | 需求软删除；解散组织软删需求，删除成员/申请/组织，保留需求、连接与揭示台账 |
| 接入 | `api-keys-service` 创建时返回明文一次，数据库保存 SHA-256 和末四位；`lib/api/auth.ts` 兼容并迁移旧明文 Key |
| 通知 | 站内通知落库，API 只读；连接邮件在 `after()` 中发送，固定 origin、偏好与成员校验，无持久队列/重试 |
| 治理与结果 | 举报/拉黑/隐藏/暂停/审计已实现；后台七天结果按成熟需求队列去重，不代表交易成交 |
| 部署 | SQLite 单实例自部署；CI lint/test/build 后才 deploy；`make deploy` 拉代码、备份、构建、重启；公开 health 检查取决于 Secret 配置 |

## 2. 分层约定

- `app/actions/` 与 `app/api/v1/`：鉴权、FormData/JSON 适配、本地化错误、刷新与跳转。
- `lib/*-service.ts`：名片、需求、API Key、连接、组织、安全治理的主要写路径，复用业务校验与额度。
- `lib/card.ts`、`lib/needs.ts`、`lib/orgs.ts`：各自的常量/纯规则；并非所有不带 service 后缀的 lib 文件都是纯函数，例如 quota、auth、matches、activity 都有数据库 IO。
- `lib/queries.ts`：共享业务读模型；`lib/matches.ts` 是候选查询，`lib/product-metrics.ts` 是统计查询。
- `lib/db/schema.ts` + `drizzle/`：schema 与版本迁移；模块加载即自动迁移，构建 worker 也可能触发。
- `lib/card.ts` / `lib/public-profile.ts` / `lib/api/serialize.ts`：名片权限、列表公开投影、API 响应形状。登录邮箱不进入名片/API 序列化。

新增跨入口规则优先放 service，避免网页与 Agent 不一致；读模型有复用或复杂权限时抽入 lib。保持 SQLite，不新增仓储框架或重写 auth/i18n。

## 3. 仍存在的分层例外

| 原有目标 | 当前事实 | 后续处理原则 |
| --- | --- | --- |
| 所有 Action 都只转发 service | `app/actions/preferences.ts` 直接更新邮件偏好；通知已读、认证等也有自己的入口 | 不宣称全仓写入已统一；增加共享入口时再抽取，避免无需求重构 |
| 页面不内联复杂查询 | 广场和管理后台仍包含筛选、排序、分页 Drizzle 查询 | 修改这些读逻辑时核对权限/总数/分页，按复用需求抽取 |
| QUOTA 所有原设计项均完成 | 编辑节流、续期日额度、部分对称检查和审核队列等仍未落地 | 以 QUOTA 第 12 节差距清单为准，不能当成已有防护 |
| 平台与 Agent 全部闭环 | 没有独立连接列表 API、平台调度器、持久邮件重试 | 不用通知流代称完整连接接口；社交动作仍在网页 |

## 4. 已完成的结构调整

1. 组织、连接、安全治理的主要写入移入 service；网页与 API 共用名片、需求规则。
2. 名片逐字段权限与 API 序列化共用；历史缺省/旧 public 联系方式在读规则中收紧为 connected，显式 authenticated 保留。
3. 接受/拒绝使用 pending 条件更新；接受与两条揭示记录原子写入，关键计数在事务内重查。
4. 需求删除、组织解散改为保留需求/连接/揭示审计行，用户读路径过滤 deletedAt。
5. 额度 UI、赚回、日额度惩罚及 shadow 观测已接入；开放需求、pending 等存量查询实时计算。
6. 发布补卡、草稿恢复、网页候选、连接邮件偏好与七天结果统计已接入。
7. 控件统一至 `components/ui/` 的 shadcn 实现；保留原设计令牌和中英窄屏适配。

以上为源码状态。历史验收见 [UI-REVIEW.md](UI-REVIEW.md) 与 [AGENT-E2E-TEST-RUNBOOK.md](AGENT-E2E-TEST-RUNBOOK.md)，不能据此断言本次代码已在生产运行。

## 5. 验证与关键文件

CI 命令为 `pnpm lint`、`pnpm test`、`pnpm build`（先构建 Skill 包，Next 构建含类型检查）。测试使用临时 SQLite 库并 mock `after()`；真实邮件到达、浏览器交互和部署健康需分别验证。

- 业务与剩余规则：[PRD.md](PRD.md)、[QUOTA.md](QUOTA.md)、[PRODUCT-VALIDATION.md](PRODUCT-VALIDATION.md)
- UI 和表单：[DESIGN.md](DESIGN.md)、[`components/ui/`](../components/ui/)、[`lib/ui.ts`](../lib/ui.ts)
- 发布与权限：[`lib/needs-service.ts`](../lib/needs-service.ts)、[`lib/card-service.ts`](../lib/card-service.ts)、[`lib/card.ts`](../lib/card.ts)
- 连接与审计：[`lib/connections-service.ts`](../lib/connections-service.ts)、[`lib/orgs-service.ts`](../lib/orgs-service.ts)、[`lib/safety-service.ts`](../lib/safety-service.ts)
- 候选与结果：[`lib/matches.ts`](../lib/matches.ts)、[`lib/product-metrics.ts`](../lib/product-metrics.ts)
- API 合约：[`skills/we-match/references/api.md`](../skills/we-match/references/api.md)
