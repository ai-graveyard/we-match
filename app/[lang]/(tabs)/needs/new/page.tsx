import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { needs, orgMembers, orgs } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getAllTags } from "@/lib/queries";
import { NeedForm, type NeedFormInitial } from "@/components/need-form";
import { PageHeader } from "@/components/page-header";
import { expiryFromPreset } from "@/lib/needs";
import { CONTACT_FIELDS, fieldVisibility } from "@/lib/card";
import { getPublishHint } from "@/lib/quota";
import { getDict, getLocale } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import { localePath } from "@/lib/i18n/routing";

export async function generateMetadata(props: PageProps<"/[lang]/needs/new">) {
  const { id } = await props.searchParams;
  return pageTitle((t) => id ? t.need.metaEdit : t.need.metaNew)(props);
}

export default async function NeedNewPage({
  searchParams,
}: PageProps<"/[lang]/needs/new">) {
  const t = await getDict();
  const locale = await getLocale();
  const params = await searchParams;
  const user = await getSessionUser();
  if (!user) {
    const scope = Array.isArray(params.scope) ? params.scope[0] : params.scope;
    const next = scope && /^\d+$/.test(scope) ? `/needs/new?scope=${scope}` : "/needs/new";
    redirect(localePath(locale, `/login?next=${encodeURIComponent(next)}`));
  }
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
      .where(and(eq(needs.id, editId), isNull(needs.deletedAt)))
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
  const suggestions = await getAllTags(user.id);
  const contactOptions = CONTACT_FIELDS.flatMap((field) => {
    if (!user[field.key]) return [];
    const visibility = fieldVisibility(user.fieldVisibility, field.key);
    if (visibility === "hidden") return [];
    return [
      {
        key: field.key,
        visibility:
          visibility === "orgs"
            ? "orgs"
            : visibility === "authenticated"
              ? "authenticated"
              : "connected",
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
        title={editId != null ? t.need.metaEdit : t.need.metaNew}
        className="mb-4"
      />
      <NeedForm
        userId={user.id}
        nickname={user.nickname}
        filledContactFields={CONTACT_FIELDS.filter((field) => !!user[field.key]).map((field) => field.key)}
        initial={initial}
        orgs={myOrgs}
        suggestions={suggestions}
        contactOptions={contactOptions}
        publishHint={editId == null ? await getPublishHint(user) : null}
      />
    </div>
  );
}
