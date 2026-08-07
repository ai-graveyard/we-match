import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { CreateOrgForm } from "@/components/create-org-form";
import { PageHeader } from "@/components/page-header";
import { getDict, getLocale } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import { localePath } from "@/lib/i18n/routing";

export const generateMetadata = pageTitle((t) => t.org.metaNew);

export default async function NewOrgPage() {
  const t = await getDict();
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) redirect(localePath(locale, "/login?next=/orgs/new"));

  return (
    <div>
      <PageHeader title={t.org.metaNew} className="mb-4" />
      <CreateOrgForm />
    </div>
  );
}
