import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { CreateOrgForm } from "@/components/create-org-form";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "创建组织" };

export default async function NewOrgPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/orgs/new");

  return (
    <div>
      <PageHeader title="创建组织" className="mb-4" />
      <CreateOrgForm />
    </div>
  );
}
