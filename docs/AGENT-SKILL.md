# We Match 开放 API 与官方 Agent Skill 方案

- 版本：v0.2
- 日期：2026-08-07
- 状态：已实现（A1–A4 全部落地，端点参数以 `skills/we-match/references/api.md` 为准）
- 前置：PRD v0.8（`docs/PRD.md`）已实现的主站功能

## 1. 目标与形态

让用户把自己的 AI Agent（Claude Code 等）接入 We Match：读取自己视角下的数据（名片、需求、组织），并代为管理自己的内容与设置（发需求、续期、改名片可见性等）。

整体分三层，缺一不可：

| 层 | 是什么 | 解决什么 |
|----|--------|----------|
| API Key（PAT） | 用户在「我的」页自助生成的个人访问令牌 | Agent 的身份凭证，等价于「这个用户本人」 |
| 开放 API v1 | 站内新增的一组 HTTP JSON 接口（`/api/v1/*`） | Agent 实际读写数据的通道 |
| 官方 Skill | 随仓库维护的 Claude Skill 包，教 Agent 怎么用上面的 API | 用户装完 Skill、填一个 Key 就能用，不用自己读文档 |

**为什么是 Skill + HTTP，而不是先做 MCP Server**：Skill 是纯文档包，零额外服务、零运维，网站本身就是 API 服务端；MCP 需要单独跑一个进程或适配远程协议。两者底层都吃同一套 `/api/v1`，先把 API 和 Skill 做扎实，MCP 作为二期在 API 之上薄封装即可，不会返工。

**设计原则**：延续主站的极简——API 视角严格等于「Key 主人本人在网页上的视角」，不新增任何权限概念；能复用 `lib/` 现有校验的绝不重写。

## 2. API Key（个人访问令牌）

### 2.1 形态与生命周期

- 格式：`wm_` + 32 字节随机数的 base64url（共 46 字符左右），一眼可识别、方便扫描泄露。
- **每用户最多 3 个 Key**。删除即释放名额，可再生成新的；不设有效期，Key 永久有效直到被删除。
- **明文可随时查看**：列表默认打码显示（前缀 + 末 4 位），点「查看」展示完整明文，配一键复制（复用 `components/copy-button.tsx`）。
- 因此数据库**直接存明文**（唯一索引），校验时按 Key 精确查表。取舍说明：本项目是自部署单文件 SQLite，DB 文件本身就是最高机密，DB 泄露时 session 表同样全部失守——为「随时可查看」多存一份哈希没有实际增益，不做。
- 每个 Key 有：名称（用户自己起，如「我的 Claude」）和最近使用时间。
- **删除即刻生效**（硬删除，无「吊销」中间态），删除需二次确认。

### 2.2 权限

所有 Key 均拥有完整读写权限，可以读取数据，也可以发、改、删自己的需求，修改自己的名片与可见性。生成时不再选择权限；历史只读 Key 也按完整读写权限处理。

**边界（重要）**：

- API Key **不能管理 API Key**（不能创建、查看、删除任何 Key）——防止一把泄露的 Key 自我复制提权。Key 管理只能在网页登录态下操作。
- 登录手机号 `phone` 在任何 API 响应中都不出现（与主站一致；名片上的 `contactPhone` 是用户主动填写的展示字段，按可见性正常返回）。
- v1 不开放组织管理操作（任命管理员、审批、移除成员、重置邀请码、解散）和申请加入操作——这些动作影响他人或不可逆，留给网页人工操作；二期再评估。
- 验证码 / 登录 / 会话相关能力一概不进 API。

### 2.3 表结构

```
api_keys   id, user_id, name, key(明文, 唯一),
           scopes(JSON: 保留兼容字段，新 Key 固定 ["read","write"]),
           last_used_at, created_at
```

无 `expires_at` / `revoked_at`——生命周期只有「存在」和「已删除」两态。

`last_used_at` 更新做节流（如 5 分钟内不重复写），避免每个请求都写库。

### 2.4 管理页面

- 「我的 → Agent」标签页直接展示完整接入流程，不再要求进入子页面。
- 页面内容：Key 列表（名称/打码 Key + 查看与复制/最近使用/创建时间/删除按钮）、创建表单（只填名称，满 3 个时禁用并提示先删旧的），以及**官方 Skill 的安装指引**（见第 4 节）——用户在同一页拿 Key、装 Skill，一站配完。

## 3. 开放 API v1

### 3.1 通用约定

- 路径前缀 `/api/v1`，用 App Router 的 Route Handler 实现（`app/api/v1/**/route.ts`）。
- 鉴权：`Authorization: Bearer wm_xxx`。**所有端点都要求 Key**——广场数据虽然网页上公开，但统一要求鉴权可以把每次调用绑定到具体用户，权限判断（组织需求、`共同组织可见`字段）和限流才有主体；不额外泄露任何东西。
- 新增 `lib/api-auth.ts`：`authenticate(request)` 解析 Bearer → 按 Key 查表（查不到即已删除或不存在）→ 返回 `{ user }`。所有 route.ts 第一行调它。
- 响应：JSON。错误统一 `{ "error": { "code": "...", "message": "中文可读信息" } }`，状态码 401（无效 Key）/ 404（不存在或无权，与主站「组织内容对非成员 404」口径一致）/ 422（校验失败）/ 429（限流）。
- 限流：每 Key 每分钟 120 次（部署形态是单进程 `next start`，内存 Map 滑动窗口即可，不落库）；写操作同时受主站既有限额约束（如每天 10 条需求）。
- 不做 CORS 放开：调用方是服务端/CLI 里的 Agent，不是浏览器。

### 3.2 端点清单

| 方法 + 路径 | 操作 | 说明 |
|-------------|-------|------|
| `GET /api/v1/me` | read | 本人名片全量字段 + `fieldVisibility` 设置 |
| `PATCH /api/v1/me/card` | write | 改名片字段与逐项可见性；完整复用网页版校验（长度限额、可联系性非阻断提醒改为响应里的 `warning` 字段） |
| `GET /api/v1/me/needs` | read | 我的全部需求（含组织内的），带状态与是否过期 |
| `GET /api/v1/me/orgs` | read | 我加入的组织（含角色、申请中状态） |
| `GET /api/v1/needs?org=&type=&tag=&q=&status=&all=&limit=` | read | 需求流；`org=<id>` 时校验成员身份，非成员 404；缺省广场、只看开放未过期 |
| `GET /api/v1/needs/:id` | read | 需求详情 + 发布者摘要；组织需求对非成员 404 |
| `POST /api/v1/needs` | write | 发布需求（body 含 `orgId`、`expiresAt` 与可选 `preferredContact`）；复用可联系性阻断校验与每日 10 条限额 |
| `PATCH /api/v1/needs/:id` | write | 编辑内容 / 状态 / `expiresAt` / `preferredContact`；`expiresAt=null` 为永久，空 body `{}` 快速续期一个月 |
| `DELETE /api/v1/needs/:id` | write | 删除自己的需求 |
| `GET /api/v1/users/:id` | read | 他人名片，以已登录的 Key 主人视角过滤可见性（可见`authenticated`，同组织时额外可见`orgs`）；附其广场开放需求 |
| `GET /api/v1/orgs/:id/members?tag=&q=` | read | 组织成员列表（需成员身份），支持技能标签筛选 |

序列化层新增 `lib/api/serialize.ts` 统一「对外形状」（时间戳转 ISO 字符串、剔除 `phone` 等），各 route 不各写各的。

### 3.3 目录结构

```
app/api/v1/
  me/route.ts                # GET
  me/card/route.ts           # PATCH
  me/needs/route.ts          # GET
  me/orgs/route.ts           # GET
  needs/route.ts             # GET, POST
  needs/[id]/route.ts        # GET, PATCH, DELETE
  users/[id]/route.ts        # GET
  orgs/[id]/members/route.ts # GET
lib/api-auth.ts              # Bearer 鉴权 + 限流
lib/api/serialize.ts         # 对外序列化
lib/api-keys.ts              # Key 生成/校验/吊销
app/(tabs)/me/page.tsx       # 「我的 → Agent」内嵌管理区
app/actions/api-keys.ts      # 管理页的 server actions（走网页 session，不走 API）
```

业务逻辑不在 route.ts 里重写：现有 server actions 里的校验逻辑（`app/actions/needs.ts`、`app/actions/card.ts`）先抽到 `lib/` 成纯函数，网页 action 和 API route 共同调用——这一步是本方案唯一的存量重构，也顺手提升了主站代码质量。

## 4. 官方 Skill 包

### 4.1 内容与结构

仓库内维护，随主站版本一起演进：

```
skills/we-match/
  SKILL.md            # 触发条件、鉴权方式、端点速查表、常用工作流
  references/api.md   # 完整 API 参考（字段、错误码、限额），SKILL.md 按需引用
```

`SKILL.md` 要点：

- **配置**：读环境变量 `WEMATCH_API_KEY`（必填）和 `WEMATCH_BASE_URL`（默认官方站点，自部署用户改这里）。Key 缺失时引导用户去 `/me?section=agent` 生成；用户可直接提供给 Agent 代为配置，配置后不主动回显到后续输出或日志。
- **调用方式**：通过 Bash 调 `curl`，给出每个端点的示例。
- **常用工作流**（Skill 的核心价值，把多步 API 编排写成剧本）：
  - 「帮我看看广场上有没有能对上我需求的人」→ 拉自己的需求和标签 → 按标签/关键词搜广场对向需求 → 汇总候选名片；
  - 「把我快过期的需求续一下」→ `GET /me/needs` 按 `expiresAt` 筛临期 → 逐条空 PATCH；
  - 「把我的邮箱改成共同组织可见」→ `PATCH /me/card` 只动 `fieldVisibility`；
  - 「发一条需求」→ 先检查可联系性前提，与用户确认优先联系方式，不满足先提示用户去开联系方式，再 POST。
- **安全提示**：写操作前向用户复述将要做的变更；删除需求必须经用户确认。

### 4.2 分发（链接自助安装）

- 正式部署域名：`wematch.v2ai.org`。
- **主路径——发链接给 Agent 自装**：站点提供公开端点 `GET /skill`，返回给 Agent 看的 Markdown 安装说明（下载 zip、解压到 `~/.claude/skills/`、配置环境变量、curl 验证，域名从请求动态取得，自部署站点自动正确）。Agent 标签页给用户一句可复制的话：「帮我安装 We Match 的官方 Skill，安装说明见 `<站点>/skill`」，用户发给 Agent 即完成安装，无需手动下载。
- 兜底路径：Agent 标签页保留 zip 手动下载链接。Skill 源码在本仓库 `skills/we-match/`，构建时打包 zip 放进 `public/`。
- 安装说明允许用户把 Key 直接提供给 Agent 代为配置；配置后 Agent 不主动回显明文。
- 不做在线 marketplace、不做自动更新；Skill 内容变更随站点发版。

## 5. 安全清单

- Key 明文仅本人在网页登录态下可见；列表默认打码，查看需主动点击。
- 删除即刻失效（硬删除），无残留状态；每用户至多 3 个 Key。
- API Key 不能管理 API Key（不能创建、查看、删除任何 Key）；Key 管理仅限网页登录态。
- `phone` 永不出站；可见性过滤复用主站同一份代码，不存在「API 看得更多」的旁路。
- 组织内容对非成员一律 404（不暴露存在性），与主站口径一致。
- 所有 Key 均为完整读写权限；组织管理类与不可逆社交动作（申请、任命、审批、解散）v1 不开放。
- 限流三层：每 Key 每分钟请求数、主站既有业务限额、每用户 3 个 Key 上限。

## 6. 二期候选

- MCP Server：在 `/api/v1` 之上薄封装（远程 MCP 或本地 stdio 均可），届时可顺手输出 OpenAPI spec。
- 组织管理 API（管理员任命、审批、成员管理）与 webhook（新申请、新需求通知 Agent）。
- 如后续确有需要，再评估 Key 级细粒度权限。
- 官方 Skill 的自动匹配剧本升级为站内真实「自动撮合」功能（与 PRD 二期第 8 节合流）。

## 7. 里程碑

| 阶段 | 内容 | 验收标准 |
|------|------|----------|
| A1 | `api_keys` 表与迁移、`lib/api-keys.ts`、Agent 标签页管理区 | 能生成/查看明文/复制/删除 Key；满 3 个时不能再生成，删除后名额释放；列表显示最近使用 |
| A2 | 鉴权中间件 + 读取端点（me/needs/orgs/users/members） | 用 curl + Key 能拉到与网页视角完全一致的数据；无 Key/已删除 Key 返回 401 |
| A3 | 写端点（需求 CRUD、状态、续期、名片 PATCH），存量校验逻辑抽到 `lib/` | 网页与 API 两条路径共用同一份校验；所有有效 Key 均可调用写接口 |
| A4 | 官方 Skill 包 + Agent 标签页安装指引 + zip 分发 | 新用户照页面指引 10 分钟内完成接入，跑通「查广场 → 发需求 → 续期」全流程 |
