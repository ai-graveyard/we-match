// 服务端文案（中文）：Server Action / Route Handler 的报错与提示、短信正文、
// 以及通知的渲染模板。这些永远不会随 RSC payload 进浏览器。

export const zhServer = {
  auth: {
    loginRequired: "请先登录",
    sessionExpired: "登录已失效，请重新登录",
    badPhone: "请输入大陆 11 位手机号",
    accountDeleted: "该手机号的账号已注销，无法再次登录",
    accountSuspended: "账号已暂停使用，如有疑问请联系管理员",
    resendTooSoon: "发送太频繁，请一分钟后再试",
    tooManyRequests: "请求过于频繁，请稍后再试",
    smsFailed: "短信发送失败，请稍后再试",
    badCode: "请输入 6 位数字验证码",
    codeExpired: "验证码无效或已过期，请重新获取",
    codeWrong: "验证码错误",
    defaultNickname: "用户{suffix}",
    deletedNickname: "已注销用户",
    smsUnavailableTitle: "短信通道还没开通，你收不到短信",
    smsUnavailableBody: "请联系{contact}获取本次登录的 6 位验证码",
    deleteOwnedOrgs: "你还是「{orgs}」的所有者，请先解散组织再注销",
  },

  sms: {
    // 真实短信由服务商模板渲染，这条只用于 log 通道与后台展示
    verificationCode: "验证码 {code}，5 分钟内有效。",
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
    bodyNotObject: "请求体需为 JSON 对象",
    orgParamNotId: "org 参数需为组织 id",
    orgNotFoundOrNotMember: "组织不存在或你不是成员",
    badStatusFilter: "status 只能是 open / done / closed",
    statusOnCreate: "发布时不能指定 status，新需求即为 open",
    userNotFound: "用户不存在",
    needNotFound: "需求不存在",
    needNotYours: "需求不存在或不属于你",
    scopeImmutable: "可见范围发布后不可修改，请关闭后重新发布",
  },

  apiKey: {
    emptyName: "请给 Key 起个名字（如「我的 Claude」）",
    nameTooLong: "名称最多 {max} 字",
    perUserLimit: "最多同时持有 {max} 个 Key，请先删除不用的",
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

## 2. 配置 API Key

请用户到 {origin}/me?section=agent 生成一个 API Key。用户可以直接把 Key 提供给你，
请帮用户写入 shell 配置（如 \`~/.zshrc\`）：

\`\`\`bash
export WEMATCH_API_KEY=<用户的 Key>
export WEMATCH_BASE_URL={origin}
\`\`\`

Key 拥有完整读写权限。配置完成后不要在后续输出中主动回显 Key 明文。

## 3. 验证

\`\`\`bash
curl -s -H "Authorization: Bearer $WEMATCH_API_KEY" {origin}/api/v1/me
\`\`\`

返回用户名片的 JSON 即安装成功（新开终端或 source 配置后生效；
Claude Code 需重启会话以加载新 Skill）。之后告诉用户可以试试：
「帮我看看 We Match 广场上有没有和我需求匹配的人」。
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
