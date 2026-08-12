// 服务端文案（中文）：Server Action / Route Handler 的报错与提示、邮件正文、
// 以及通知的渲染模板。这些永远不会随 RSC payload 进浏览器。

export const zhServer = {
  auth: {
    loginRequired: "请先登录",
    sessionExpired: "登录已失效，请重新登录",
    badEmail: "请输入有效的邮箱地址",
    accountDeleted: "该邮箱的账号已注销，无法再次登录",
    accountSuspended: "账号已暂停使用，如有疑问请联系管理员",
    resendTooSoon: "发送太频繁，请一分钟后再试",
    tooManyRequests: "请求过于频繁，请稍后再试",
    mailFailed: "邮件发送失败，请稍后再试",
    badCode: "请输入 6 位数字验证码",
    codeExpired: "验证码无效或已过期，请重新获取",
    codeWrong: "验证码错误",
    defaultNickname: "用户{suffix}",
    deletedNickname: "已注销用户",
    mailUnavailableTitle: "邮件通道还没开通，你收不到邮件",
    mailUnavailableBody: "请联系{contact}获取本次登录的 6 位验证码",
    deleteOwnedOrgs: "你还是「{orgs}」的所有者，请先解散组织再注销",
  },

  mail: {
    verificationSubject: "We Match 验证码 {code}",
    // 末尾这段防钓鱼提示是刻意写的：Agent 注册流程会训练用户「把验证码念给 AI」，
    // 这个习惯一旦养成就会被别的服务借用，成本为零的一句话该写就写。
    verificationText: `验证码 {code}，5 分钟内有效。

这封邮件用于登录或注册 We Match。如果你正在让 AI Agent 代你注册，把验证码给它即可。
如果你没有主动发起过，请直接忽略这封邮件，也不要把验证码转给任何向你索要的人。`,

    keyIssuedSubject: "We Match 签发了一个新的 API Key",
    keyIssuedText: `你的 We Match 账号刚刚通过 Agent 注册接口签发了一个 API Key：「{name}」。

这把 Key 拥有你账号的完整读写权限，可以代你发布需求、修改名片。
如果这不是你本人的操作，请立刻到 {origin}/me?section=agent 删掉它。`,
  },

  common: {
    badParams: "参数不正确",
    badTags: "标签格式不正确",
    saved: "已保存",
  },

  card: {
    emptyNickname: "昵称不能为空",
    nicknameTooLong: "昵称最多 {max} 字",
    badContactPhone: "手机号需为 11 位中国大陆手机号",
    badVisibilityObject: 'fieldVisibility 需为对象，如 {"email":"orgs"}',
    badVisibilityValue: "可见性设置不正确：{key} 不能为 {value}",
    warnNoPlazaContact:
      "你有开放中的广场需求，但名片上已没有登录用户可见的联系方式，别人将联系不到你",
    warnNoOrgContact:
      "你有开放中的组织需求，但名片上已没有组织成员可见的联系方式",
  },

  need: {
    badType: "请选择需求类型（need / offer）",
    emptyTitle: "标题不能为空",
    titleTooLong: "标题最多 {max} 字",
    badPreferredContact: "优先联系方式只能是 wechat / email / contactPhone",
    badStatus: "状态只能是 open / done / closed",
    missingExpiry: "请选择截止时间，或选择永久",
    expiryInPast: "截止时间必须晚于当前时间",
    badScope: "可见范围不正确",
    notOrgMember: "只能发到自己已加入的组织",
    noOrgContact:
      "名片上还没有组织成员可见的联系方式，发布后别人联系不到你。请先到「我的 → 编辑名片」开启",
    noPlazaContact:
      "名片上还没有登录用户可见的联系方式，发布后别人联系不到你。请先到「我的 → 编辑名片」开启",
    preferredContactUnavailable: "选择的优先联系方式在当前可见范围下不可用",
    dailyLimit: "每天最多发布 {max} 条需求",
    notOwner: "只能编辑自己的需求",
    noContactForScope: "当前可见范围下没有可用的联系方式，请先编辑名片",
    staleHandsBlockRenewal:
      "有举手等你回应超过 3 天了，先到「我的 → 举手」处理完，才能续期或重新开放",
    idempotencyConflict: "这个 Idempotency-Key 已用于另一条不同的需求，请为新需求换一个 Key",
  },

  org: {
    emptyName: "组织名称不能为空",
    nameTooLong: "组织名称最多 {max} 字",
    joinLimitWithCreate: "最多同时加入 {max} 个组织（创建也计入）",
    joinLimit: "最多同时加入 {max} 个组织",
    alreadyMember: "你已经是该组织成员",
    alreadyApplied: "已提交过申请，等待管理员审批",
    emptyCode: "请输入邀请码",
    codeTooManyAttempts: "尝试次数过多，请一小时后再试",
    badCode: "邀请码无效",
    appliedTo: "已向「{name}」提交申请，等待管理员审批",
    notFound: "组织不存在",
    applied: "已提交申请，等待管理员审批",
    requestGone: "申请不存在或已处理",
    adminOnly: "只有管理员可以审批",
    targetAlreadyMember: "对方已是成员",
    targetJoinLimit: "对方已加入 {max} 个组织，名额已满，无法通过",
    promoteAdminOnly: "只有管理员可以任命管理员",
    selfAlreadyAdmin: "你已经是管理员",
    targetNotMember: "该用户不是组织成员",
    targetAlreadyAdmin: "对方已经是管理员",
    adminLimit: "每个组织最多任命 {max} 名管理员（拥有者另计）",
    promoteFailed: "任命失败，请刷新后重试",
    promoted: "已设为管理员",
    ownerOnly: "只有组织拥有者可以编辑",
  },

  connection: {
    messageTooLong: "说明最多 200 字",
    notOpen: "这条需求当前不能举手",
    blocked: "当前无法向该用户举手",
    needNotFound: "这条需求不存在",
    already: "你已经举过手了",
    submitted: "已经举手，等待发布者回应",
  },

  report: {
    badReason: "请选择举报原因",
    detailsTooLong: "补充说明最多 500 字",
    selfReport: "不能举报自己",
    duplicate: "这条内容已经提交过举报，正在处理中",
    submitted: "举报已提交，我们会尽快处理",
  },

  api: {
    missingKey: "缺少 API Key，请求头需带 Authorization: Bearer <Key>",
    invalidKey: "API Key 无效或已被删除",
    accountSuspended: "账号已暂停使用",
    accountDeleted: "账号已注销",
    rateLimited: "请求过于频繁（每 Key 每分钟 {max} 次），请稍后再试",
    authRateLimited: "注册登录请求过于频繁（每 IP 每小时 {max} 次），请稍后再试",
    bodyNotObject: "请求体需为 JSON 对象",
    unknownFields: "请求包含不支持的字段：{fields}",
    orgParamNotId: "org 参数需为组织 id",
    orgNotFoundOrNotMember: "组织不存在或你不是成员",
    badStatusFilter: "status 只能是 open / done / closed",
    statusOnCreate: "发布时不能指定 status，新需求即为 open",
    userNotFound: "用户不存在",
    needNotFound: "需求不存在",
    needNotYours: "需求不存在或不属于你",
    scopeImmutable: "可见范围发布后不可修改，请关闭后重新发布",
    badSince: "since 需为 ISO 8601 时间",
    badCursor: "cursor 无效或已过期，请移除后重试",
    badIdempotencyKey: "Idempotency-Key 只能包含字母、数字、点、下划线、冒号或短横线，最长 128 字符",
  },

  apiKey: {
    emptyName: "请给 Key 起个名字（如「我的 Claude」）",
    nameTooLong: "名称最多 {max} 字",
    perUserLimit: "最多同时持有 {max} 个 Key，请先删除不用的",
    // Agent 走 /api/v1/auth/token 注册时没传名字的默认值
    agentDefaultName: "我的 Agent",
  },

  // GET /skill 返回的安装说明，读者是 AI Agent。整篇是 Markdown，{origin} 是站点地址。
  skill: {
    install: `# We Match 官方 Skill 安装说明（给 AI Agent）

你被要求为用户安装 We Match 官方 Skill。We Match（{origin}）是一个供需匹配工具，
安装本 Skill 后你可以代用户读取和管理其名片与需求。请按以下步骤操作：

## 1. 下载并解压 Skill

Claude Code 的用户技能目录是 \`~/.claude/skills/\`（其他 Agent 框架放各自的技能目录）：

\`\`\`bash
mkdir -p ~/.claude/skills
curl -fsSL {origin}/we-match-skill.zip -o /tmp/we-match-skill.zip
unzip -o /tmp/we-match-skill.zip -d ~/.claude/skills/
rm /tmp/we-match-skill.zip
\`\`\`

解压后应存在 \`~/.claude/skills/we-match/SKILL.md\`。

## 2. 拿到 API Key

**用户已经有账号**：请他到 {origin}/me?section=agent 复制一个 Key 给你。

**用户还没有账号**：不用让他打开网站，你可以直接代办——问他要一个邮箱，然后：

\`\`\`bash
# 第一步：给这个邮箱发验证码
curl -s -X POST {origin}/api/v1/auth/code \\
  -H "Content-Type: application/json" -d '{"email":"<用户的邮箱>"}'

# 第二步：让用户把收到的 6 位验证码告诉你，换成 Key
curl -s -X POST {origin}/api/v1/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{"email":"<用户的邮箱>","code":"<验证码>","name":"我的 Claude"}'
\`\`\`

响应里的 \`key\` 就是凭证，\`isNew: true\` 表示这是刚注册的新账号。
只在用户自己发起注册时索要验证码，用完即弃，不要留存。

## 3. 安全保存凭证

优先写入 Agent 平台自己的 Secret / Credential Store。没有安全存储时，再写入仅用户可读的独立文件；不要放进项目目录，也不要直接追加到全局 \`~/.zshrc\`：

\`\`\`bash
install -d -m 700 ~/.config/we-match
umask 077
touch ~/.config/we-match/env
chmod 600 ~/.config/we-match/env
export WEMATCH_API_KEY=<用户的 Key>
export WEMATCH_BASE_URL={origin}
\`\`\`

将上面两个 \`export\` 写入 \`~/.config/we-match/env\`，只在运行 We Match Agent 前加载。Key 拥有完整读写权限；配置完成后不要在后续输出、命令日志或错误报告中主动回显 Key 明文。

## 4. 验证

\`\`\`bash
curl -s -H "Authorization: Bearer $WEMATCH_API_KEY" {origin}/api/v1/me
\`\`\`

返回用户名片的 JSON 即安装成功（新开终端或 source 配置后生效；
Claude Code 需重启会话以加载新 Skill）。

新注册的账号名片是空的，接着帮用户建一张——Skill 里的「首次建卡」剧本有具体做法。
老用户则可以直接试试：「帮我看看 We Match 广场上有没有和我需求匹配的人」。
`,
  },

  // 通知按 type + params 存库，读取时再按查看者的语言渲染，
  // 这样同一条通知在中英文界面下各自成立。见 lib/notifications.ts
  notification: {
    orgJoinRequestedTitle: "{name} 申请加入组织",
    orgJoinRequestedViaCode: "通过邀请码提交，等待审批",
    orgJoinRequestedViaPlaza: "通过组织广场提交，等待审批",
    orgJoinApprovedTitle: "你已加入「{org}」",
    orgJoinRejectedTitle: "「{org}」暂未通过你的申请",

    connectionRequestedTitle: "{name} 对你的需求举手了",
    connectionAcceptedTitle: "{name} 接受了你的举手",
    connectionRejectedTitle: "{name} 暂未接受你的举手",
    connectionCancelledTitle: "{name} 撤回了举手",
    connectionAboutNeed: "关于「{need}」",

    connectionCompletedTitle: "双方已确认这次匹配完成",
    connectionCompletedBody: "「{need}」已形成一次有效连接",
    completionRequestedTitle: "{name} 已确认匹配完成",
    completionRequestedBody: "请确认这次匹配是否已经完成",

    needMatchesTitle: "发现 {n} 条可能匹配的需求",
    needMatchesBody: "与你刚发布的「{need}」标签相关",
  },
};
