import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { needs, orgMembers, orgs } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getAllTags } from "@/lib/queries";
import { NeedForm, type NeedFormInitial } from "@/components/need-form";
import { PageHeader } from "@/components/page-header";
import { expiryFromPreset } from "@/lib/needs";
import { CONTACT_FIELDS, fieldVisibility } from "@/lib/card";

export const metadata = { title: "发布需求" };

export default async function NeedNewPage({
  searchParams,
}: PageProps<"/needs/new">) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/needs/new");
  const params = await searchParams;
  const editId = params.id ? Number(params.id) : null;

  let initial: NeedFormInitial = {
    type: "need",
    title: "",
    description: "",
    tags: [],
    scope: "plaza",
    preferredContact: null,
    expiresAt: expiryFromPreset("month").toISOString(),
    expiryPreset: "month",
  };
  if (editId != null) {
    if (!Number.isInteger(editId)) notFound();
    const [need] = await db
      .select()
      .from(needs)
      .where(eq(needs.id, editId))
      .limit(1);
    if (!need || need.userId !== user.id) notFound();
    initial = {
      id: need.id,
      type: need.type,
      title: need.title,
      description: need.description ?? "",
      tags: need.tags,
      scope: need.orgId == null ? "plaza" : String(need.orgId),
      preferredContact: need.preferredContact,
      expiresAt: need.expiresAt?.toISOString() ?? null,
    };
  }

  const myOrgs = await db
    .select({ id: orgs.id, name: orgs.name })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgMembers.orgId, orgs.id))
    .where(eq(orgMembers.userId, user.id));
  const suggestions = await getAllTags();
  const contactOptions = CONTACT_FIELDS.flatMap((field) => {
    if (!user[field.key]) return [];
    const visibility = fieldVisibility(user.fieldVisibility, field.key);
    if (visibility === "hidden") return [];
    return [
      {
        key: field.key,
        label: field.label,
        visibility: visibility === "orgs" ? "orgs" : "authenticated",
      } as const,
    ];
  });

  // 从组织需求流进来时，默认发到当前组织
  const scopeParam = Array.isArray(params.scope) ? params.scope[0] : params.scope;
  if (
    editId == null &&
    scopeParam &&
    myOrgs.some((o) => String(o.id) === scopeParam)
  ) {
    initial.scope = scopeParam;
  }

  return (
    <div>
      <PageHeader
        title={editId != null ? "编辑需求" : "发布需求"}
        className="mb-4"
      />
      <NeedForm
        initial={initial}
        orgs={myOrgs}
        suggestions={suggestions}
        contactOptions={contactOptions}
      />
    </div>
  );
}
