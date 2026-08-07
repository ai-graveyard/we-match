import type { ApiKeyListItem } from "@/lib/api-keys";
import { API_KEY_LIMITS, maskApiKey } from "@/lib/api-keys";
import { shortDateTime } from "@/lib/format";
import { ApiKeyRow, CreateApiKeyForm } from "@/components/api-keys";
import { CopyButton } from "@/components/copy-button";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/fmt";
import { relativeTime } from "@/lib/i18n/labels";

export async function AgentAccessContent({
  apiKeys,
  origin,
}: {
  apiKeys: ApiKeyListItem[];
  origin: string;
}) {
  const t = await getDict();
  const installMessage = fmt(t.agent.installMessage, { origin });

  return (
    <section>
      <p className="text-sm text-gray">{t.agent.intro}</p>

      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-2xs font-semibold tracking-[0.08em] text-gray">
          {t.agent.apiKeyHeading}
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
            masked={maskApiKey(key.lastFour) ?? t.agent.keyMaskedLegacy}
            meta={fmt(t.agent.keyMeta, {
              created: shortDateTime(key.createdAt),
              used: key.lastUsedAt
                ? fmt(t.agent.keyLastUsed, {
                    time: relativeTime(t, key.lastUsedAt),
                  })
                : t.agent.keyNeverUsed,
            })}
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
          {t.agent.installHeading}
        </h2>
        <div className="mt-2 rounded-md border border-line bg-panel p-4 text-sm">
          <p>{t.agent.installBody}</p>
          <div className="mt-2 flex items-center gap-1 rounded-sm bg-bg-3 px-2 py-1.5">
            <code className="min-w-0 flex-1 break-all font-mono text-2xs">
              {installMessage}
            </code>
            <CopyButton text={installMessage} />
          </div>
        </div>
        <p className="mt-2 text-2xs text-gray">
          <a href="/we-match-skill.zip" download className="underline">
            {t.agent.downloadLink}
          </a>
          {t.agent.downloadHint}
        </p>
      </section>
    </section>
  );
}
