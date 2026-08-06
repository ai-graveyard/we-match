import { siteOrigin } from "@/lib/site-url";

// GET /skill：给 AI Agent 看的安装说明（纯文本 Markdown，无需鉴权）。
// 用户只要把这个链接发给 Agent，Agent 照说明自助完成安装
export async function GET() {
  const origin = await siteOrigin();
  const text = `# We Match 官方 Skill 安装说明（给 AI Agent）

你被要求为用户安装 We Match 官方 Skill。We Match（${origin}）是一个供需匹配工具，
安装本 Skill 后你可以代用户读取和管理其名片与需求。请按以下步骤操作：

## 1. 下载并解压 Skill

Claude Code 的用户技能目录是 \`~/.claude/skills/\`（其他 Agent 框架放各自的技能目录）：

\`\`\`bash
mkdir -p ~/.claude/skills
curl -fsSL ${origin}/we-match-skill.zip -o /tmp/we-match-skill.zip
unzip -o /tmp/we-match-skill.zip -d ~/.claude/skills/
rm /tmp/we-match-skill.zip
\`\`\`

解压后应存在 \`~/.claude/skills/we-match/SKILL.md\`。

## 2. 配置 API Key

请用户到 ${origin}/me?section=agent 生成一个 API Key。用户可以直接把 Key 提供给你，
请帮用户写入 shell 配置（如 \`~/.zshrc\`）：

\`\`\`bash
export WEMATCH_API_KEY=<用户的 Key>
export WEMATCH_BASE_URL=${origin}
\`\`\`

Key 拥有完整读写权限。配置完成后不要在后续输出中主动回显 Key 明文。

## 3. 验证

\`\`\`bash
curl -s -H "Authorization: Bearer $WEMATCH_API_KEY" ${origin}/api/v1/me
\`\`\`

返回用户名片的 JSON 即安装成功（新开终端或 source 配置后生效；
Claude Code 需重启会话以加载新 Skill）。之后告诉用户可以试试：
「帮我看看 We Match 广场上有没有和我需求匹配的人」。
`;
  return new Response(text, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
