import type { ApiKeyListItem } from "@/lib/api-keys";
import { API_KEY_LIMITS, maskApiKey } from "@/lib/api-keys";
import { relativeTime, shortDateTime } from "@/lib/format";
import { ApiKeyRow, CreateApiKeyForm } from "@/components/api-keys";
import { CopyButton } from "@/components/copy-button";

export function AgentAccessContent({
  apiKeys,
  origin,
}: {
  apiKeys: ApiKeyListItem[];
  origin: string;
}) {
  const installMessage = `帮我安装 We Match 的官方 Skill，安装说明见 ${origin}/skill`;

  return (
    <section>
      <p className="text-sm text-gray">
        让 Agent 帮你找匹配、发需求、管名片。
      </p>

      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-2xs font-semibold tracking-[0.08em] text-gray">
          API Key
        </h2>
        <span className="font-mono text-2xs text-gray">
          {apiKeys.length} / {API_KEY_LIMITS.perUser}
        </span>
      </div>
      <div className="mt-2 rounded-md border border-line bg-panel">
        {apiKeys.map((key, index) => (
          <ApiKeyRow
            key={key.id}
            id={key.id}
            name={key.name}
            masked={maskApiKey(key.lastFour)}
            meta={`创建于 ${shortDateTime(key.createdAt)} · ${
              key.lastUsedAt
                ? `最近使用 ${relativeTime(key.lastUsedAt)}`
                : "从未使用"
            }`}
            first={index === 0}
          />
        ))}
        <div className={apiKeys.length > 0 ? "border-t border-line" : ""}>
          <CreateApiKeyForm
            atLimit={apiKeys.length >= API_KEY_LIMITS.perUser}
          />
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-2xs font-semibold tracking-[0.08em] text-gray">
          安装 Skill
        </h2>
        <div className="mt-2 rounded-md border border-line bg-panel p-4 text-sm">
          <p>把安装指令和新建的 API Key 发给 Agent。</p>
          <div className="mt-2 flex items-center gap-1 rounded-sm bg-bg-3 px-2 py-1.5">
            <code className="min-w-0 flex-1 break-all font-mono text-2xs">
              {installMessage}
            </code>
            <CopyButton text={installMessage} />
          </div>
        </div>
        <p className="mt-2 text-2xs text-gray">
          <a href="/we-match-skill.zip" download className="underline">
            手动下载 Skill 包
          </a>
          。API Key 拥有完整读写权限，请妥善保管。
        </p>
      </section>
    </section>
  );
}
