---
name: we-match
description: 调用 We Match 开放 API，代用户读取和管理其供需匹配数据。当用户提到 We Match、要查看/发布/续期自己的需求、找广场或组织里的匹配对象、查别人的名片、修改自己的名片或联系方式可见性时使用。
---

# We Match 开放 API

We Match 是一个极简供需匹配工具：每人一张名片，可发布「我需要 / 我提供」的需求到公开广场或自己加入的组织，靠名片上的联系方式线下对接。本 Skill 通过 HTTP API 以**用户本人的身份**读写数据。

## 配置

- `WEMATCH_API_KEY`（必需）：用户的 API Key，`wm_` 开头。缺失时引导用户到「我的 → Agent 接入」（`/me?section=agent`）生成；用户提供 Key 后，可以代为写入环境变量，不要替用户猜测或编造。
- `WEMATCH_BASE_URL`（可选）：站点地址，默认官方站点 `https://wematch.v2ai.cn`；自部署用户设为自己的地址。

**安全规则（必须遵守）**：

- Key 拥有完整读写权限；用户可以直接提供给 Agent，配置后不要在后续输出或日志中主动回显明文。
- 写操作（发布/修改/删除需求、改名片）前，先向用户复述将要做的变更并获确认；删除需求必须经用户明确同意。

## 调用方式

用 curl，鉴权头 `Authorization: Bearer $WEMATCH_API_KEY`，读写均为 JSON：

```bash
curl -s -H "Authorization: Bearer $WEMATCH_API_KEY" \
  "${WEMATCH_BASE_URL:-https://wematch.v2ai.cn}/api/v1/me"
```

出错时响应形如 `{"error":{"code":"...","message":"中文说明"}}`，直接把 message 转述给用户即可。401 = Key 无效或已删除；404 = 不存在或无权访问；422 = 参数问题；429 = 限流（每分钟 120 次）。

## 端点速查

完整字段与示例见 [references/api.md](references/api.md)。

| 端点 | 说明 |
|------|------|
| `GET /api/v1/me` | 我的名片全量字段 + 每个字段的可见性设置 |
| `PATCH /api/v1/me/card` | 改名片：只传要改的字段；`fieldVisibility` 是整体替换 |
| `GET /api/v1/me/needs` | 我的全部需求（含组织内的，带 expired 标记） |
| `GET /api/v1/me/orgs` | 我加入的组织 + 申请中的组织 |
| `GET /api/v1/needs` | 需求流：`?org=<id>` 看组织（缺省广场）、`type=need\|offer`、`tag=`、`q=`、`status=`、`all=1`、`limit=` |
| `GET /api/v1/needs/<id>` | 需求详情（含发布者） |
| `POST /api/v1/needs` | 发布：除内容与 orgId 外须传 `expiresAt`；可用 `preferredContact` 指定优先联系渠道 |
| `PATCH /api/v1/needs/<id>` | 编辑自己的需求和截止时间；空 body `{}` = 快速续期一个月 |
| `DELETE /api/v1/needs/<id>` | 删除自己的需求 |
| `GET /api/v1/users/<id>` | 他人名片（按可见性过滤）+ TA 的广场开放需求 |
| `GET /api/v1/orgs/<id>/members` | 组织成员列表：`?tag=` 按技能筛、`?q=` 按昵称搜 |

## 常用工作流

**帮用户找匹配**（「看看广场上有没有能对上我需求的人」）：

1. `GET /me/needs` 拿用户开放中的需求，提取每条的 type 与 tags；
2. 对每条需求，反向搜索：用户的 `need` 找别人的 `offer`，反之亦然。按标签逐个 `GET /needs?type=offer&tag=<标签>`，标签无命中再用 `q=<关键词>` 搜标题描述；用户加入了组织的话，再用 `org=<id>` 在组织内搜一轮；
3. 汇总候选需求，`GET /users/<authorId>` 取发布者名片与联系方式，整理成「需求 ↔ 候选人 + 怎么联系」清单给用户。名片上拿不到联系方式时，提示用户该字段可能仅共同组织可见或已隐藏。

**续期临期需求**（「把我快过期的需求续一下」）：

1. `GET /me/needs`，按 `expiresAt` 筛出即将截止或 `expired=true` 的（`expiresAt=null` 为永久）；
2. 列给用户确认后，逐条 `PATCH /needs/<id>`（空 body）；
3. 回报每条的新 `expiresAt`。

**调整名片可见性**（「把邮箱改成共同组织可见」）：

1. `GET /me` 取当前 `fieldVisibility`（注意它是整体替换，必须先读后写）；
2. 在现值上改目标键（如 `{"email": "orgs"}`，可选值：基本信息字段 `public|hidden`，联系方式/社媒 `authenticated|orgs|hidden`），`PATCH /me/card` 提交完整对象；
3. 若响应带 `warning`（如改完后开放需求的受众看不到任何联系方式），务必转告用户。

**发布需求**：

1. 先 `GET /me` 检查：发广场需要至少一项联系方式可见性为 `authenticated`；发组织需要 `authenticated` 或 `orgs`。不满足时先和用户商量开启哪项（走上面的可见性流程），否则 POST 会被 422 拒绝；
2. 与用户确认标题、类型（need=我需要 / offer=我提供）、描述、标签、范围、截止时间和优先联系方式后 `POST /needs`；`preferredContact` 可选 `wechat|email|contactPhone`，且须在当前范围对受众可见；截止时间传 ISO 8601，永久传 `null`；
3. 标签尽量复用站内已有写法（可先搜一下同类需求看大家用什么标签），避免同义词分裂。
