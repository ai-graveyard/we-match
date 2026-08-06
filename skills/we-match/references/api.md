# We Match API v1 参考

- Base URL：`$WEMATCH_BASE_URL`（默认官方站点 `https://wematch.v2ai.cn`），所有路径前缀 `/api/v1`
- 鉴权：每个请求带 `Authorization: Bearer <API Key>`，Key 以 `wm_` 开头
- 请求/响应均为 JSON；时间为 ISO 8601 字符串
- 权限模型：API 视角 = Key 主人本人在网页上的视角。组织内容对非成员返回 404（不暴露存在性）；他人名片按字段可见性过滤；用户的登录手机号永不返回

## 错误

```json
{ "error": { "code": "invalid_input", "message": "标题最多 50 字" } }
```

| 状态码 | code | 含义 |
|--------|------|------|
| 401 | unauthorized | Key 缺失、无效或已被删除 |
| 404 | not_found | 资源不存在，或无权访问（组织内容对非成员） |
| 422 | invalid_body / invalid_input | body 不是 JSON 对象 / 字段校验失败（含业务规则，如每日发布限额、可联系性校验） |
| 429 | rate_limited | 每 Key 每分钟 120 次限流 |

## 数据约束

- 需求：title ≤ 50 字（必填）；description ≤ 2000 字；tags ≤ 10 个、单个 ≤ 20 字；每天最多发布 10 条；`preferredContact` 可为 `wechat|email|contactPhone`；`expiresAt` 为未来的 ISO 8601 时间或 `null`（永久）；超过截止时间即 `expired: true` 并从默认列表隐藏
- 名片：nickname ≤ 20 字（不能为空）；bio ≤ 100；city ≤ 20；tags 同上；联系方式/社媒单值 ≤ 100 字；contactPhone 须为 11 位中国大陆手机号（或留空）
- 可见性 `fieldVisibility`：键为字段名，值为档位。基本信息（bio/tags/city）为 `public|hidden`，未记录默认 `public`；联系方式（wechat/email/contactPhone）与社媒（weixinMp/weixinChannels/xiaohongshu/weibo）为 `authenticated|orgs|hidden`，未记录默认 `authenticated`。`authenticated` = 任意已登录用户可见，`orgs` = 仅与本人同组织的成员可见。昵称始终公开；联系方式与社媒不存在匿名公开档

## 端点

### GET /me

本人名片全量（含不可见字段与可见性设置）。

```json
{
  "id": 3, "nickname": "老白", "bio": "十年后端", "city": "深圳",
  "tags": ["后端", "Go"], "wechat": null, "email": "laobai@example.com",
  "contactPhone": null, "weixinMp": null, "weixinChannels": null,
  "xiaohongshu": null, "weibo": null,
  "fieldVisibility": { "email": "orgs" },
  "createdAt": "2026-07-17T08:00:00.000Z"
}
```

### PATCH /me/card（需 write）

部分更新：只传要改的键。文本字段传 `null` 或空串即清空。`fieldVisibility` 为**整体替换**——先 GET /me 取现值，改好后完整提交。

```bash
curl -s -X PATCH -H "Authorization: Bearer $WEMATCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fieldVisibility": {"email": "orgs", "wechat": "hidden"}}' \
  "$BASE/api/v1/me/card"
```

响应：`{ "card": {同 GET /me}, "warning": "..."|null }`。`warning` 非空时必须转告用户（如：改完后开放需求的受众已看不到任何联系方式）。

### GET /me/needs

我的全部需求（广场 + 各组织），按更新时间倒序。每条含 `orgId`/`orgName`（null = 广场）、`status`、`preferredContact`、`expiresAt`（null = 永久）、`expired`。

### GET /me/orgs

```json
{
  "orgs": [ { "id": 1, "name": "产品社群", "description": "...", "visibility": "public", "role": "member", "createdAt": "..." } ],
  "pendingRequests": [ { "orgId": 2, "orgName": "创业互助会" } ]
}
```

### GET /needs

需求流。查询参数（全部可选）：

| 参数 | 说明 |
|------|------|
| `org` | 组织 id，看该组织内的需求（须是成员，否则 404）；缺省看广场 |
| `type` | `need`（我需要）或 `offer`（我提供） |
| `tag` | 按标签精确筛选 |
| `q` | 关键词，匹配标题与描述 |
| `status` | `open` / `done` / `closed`，指定后不再按过期过滤 |
| `all` | `1` = 不过滤状态与过期 |
| `limit` | 默认 50，上限 100 |

缺省（无 status/all）只返回开放且未过期的需求。响应：`{ "needs": [ {..., "author": {"id": 5, "nickname": "大鱼"}} ] }`

### GET /needs/:id

需求详情，含 `author` 与 `orgName`。组织内需求对非成员 404。

### POST /needs（需 write）

```json
{ "type": "need", "title": "找一位合同法律师", "description": "...", "tags": ["法律"], "orgId": null, "preferredContact": "wechat", "expiresAt": "2026-08-14T12:00:00.000Z" }
```

- `orgId` 缺省或 null 发广场；指定组织须是成员。**发布后范围不可改**
- `expiresAt` 必填：未来的 ISO 8601 时间；永久有效传 `null`
- `preferredContact` 可选；须是本人名片在该范围下对受众可见且已填写的联系方式。省略时自动选择第一项可用渠道
- 前置校验：发广场要求名片至少一项联系方式为 `authenticated`；发组织要求 `authenticated` 或 `orgs`。不满足返回 422，先引导用户改名片可见性
- 成功返回 201：`{ "need": {...} }`

### PATCH /needs/:id（需 write）

编辑自己的需求，body 可含 `type` / `title` / `description` / `tags` / `status`（`open|done|closed`）/ `preferredContact` / `expiresAt`（ISO 时间或 `null`）。范围（orgId）不可改。空 body `{}` 会把截止时间快速延长到一个月后。

### DELETE /needs/:id（需 write）

删除自己的需求。返回 `{ "deleted": true }`。

### GET /users/:id

他人名片（按可见性过滤后）+ 其广场上开放且未过期的需求：

```json
{
  "card": {
    "id": 5, "nickname": "大鱼", "bio": "执业律师", "city": "上海",
    "tags": ["法律", "合同"],
    "contacts": [ { "key": "email", "label": "邮箱", "value": "dayu@example.com", "visibility": "authenticated" } ],
    "socials": []
  },
  "plazaNeeds": [ ... ]
}
```

`contacts`/`socials` 只含对 Key 主人可见且非空的字段；拿不到说明对方设了 `orgs`（需同组织）或 `hidden`。

### GET /orgs/:id/members

组织成员列表（须是成员，否则 404）。参数：`tag` 按技能标签筛，`q` 按昵称搜。每个成员为 `card` 结构 + `role`（owner/admin/member）+ `joinedAt`；名片按「同组织成员」视角过滤，`orgs` 档字段可见。

## v1 不提供

创建/管理 API Key、登录与验证码、组织管理（创建、审批、邀请码、移除成员、解散）、申请加入组织。这些操作请引导用户在网页上完成。
