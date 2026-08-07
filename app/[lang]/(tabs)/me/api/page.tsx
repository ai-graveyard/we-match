import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { listApiKeys } from "@/lib/api-keys-service";
import { siteOrigin } from "@/lib/site-url";
import { AgentAccessContent } from "@/components/agent-access-content";
import { PageHeader } from "@/components/page-header";
import { getDict, getLocale } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import { localePath } from "@/lib/i18n/routing";

export const generateMetadata = pageTitle((t) => t.agent.metaTitle);

export default async function ApiKeysPage() {
  const t = await getDict();
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) redirect(localePath(locale, "/login?next=/me/api"));
  const apiKeys = await listApiKeys(user.id);
  const origin = await siteOrigin();

  return (
    <div>
      <PageHeader title={t.agent.metaTitle} className="mb-4" />
      <AgentAccessContent apiKeys={apiKeys} origin={origin} />
    </div>
  );
}
