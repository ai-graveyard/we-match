import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { listApiKeys } from "@/lib/api-keys";
import { siteOrigin } from "@/lib/site-url";
import { AgentAccessContent } from "@/components/agent-access-content";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Agent 接入" };

export default async function ApiKeysPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/me/api");
  const apiKeys = await listApiKeys(user.id);
  const origin = await siteOrigin();

  return (
    <div>
      <PageHeader title="Agent 接入" className="mb-4" />
      <AgentAccessContent apiKeys={apiKeys} origin={origin} />
    </div>
  );
}
