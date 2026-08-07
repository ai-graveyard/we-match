import { Search, Users } from "lucide-react";
import { count, desc, eq, sql, type SQL } from "drizzle-orm";
import { and } from "drizzle-orm";
import { db } from "@/lib/db";
import { orgMembers, orgs } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { ApplyByCodeForm } from "@/components/org-forms";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ListEnd } from "@/components/list-states";
import { getDict, getLocale } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import { LocaleLink } from "@/lib/i18n/link";
import { localePath } from "@/lib/i18n/routing";

export const generateMetadata = pageTitle((t) => t.org.metaPlaza);
export const dynamic = "force-dynamic";

export default async function OrgPlazaPage({
  searchParams,
}: PageProps<"/[lang]/orgs">) {
  const t = await getDict();
  const locale = await getLocale();
  const params = await searchParams;
  const pick = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const q = pick(params.q)?.trim();
  const prefillCode = pick(params.code)?.trim() ?? "";
  const user = await getSessionUser();
  const loginNext = prefillCode
    ? `/orgs?code=${encodeURIComponent(prefillCode)}`
    : "/orgs";

  const conds: SQL[] = [eq(orgs.visibility, "public")];
  if (q) conds.push(sql`${orgs.name} LIKE ${`%${q}%`}`);

  const list = await db
    .select({
      org: orgs,
      memberCount: count(orgMembers.userId),
    })
    .from(orgs)
    .leftJoin(orgMembers, eq(orgMembers.orgId, orgs.id))
    .where(and(...conds))
    .groupBy(orgs.id)
    .orderBy(desc(orgs.createdAt))
    .limit(100);

  return (
    <div>
      <PageHeader title={t.org.metaPlaza} />

      {user ? (
        <div className="mt-4">
          <ApplyByCodeForm initialCode={prefillCode} />
        </div>
      ) : (
        <p className="mt-4 text-xs text-gray">
          <LocaleLink
            href={`/login?next=${encodeURIComponent(loginNext)}`}
            className="text-ink underline"
          >
            {t.org.plazaLoginPrefix}
          </LocaleLink>{" "}
          {t.org.plazaLoginSuffix}
        </p>
      )}

      <div className="mt-4">
        <form action={localePath(locale, "/orgs")} className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder={t.org.plazaSearchPlaceholder}
            className="h-10 w-full rounded-sm border border-line bg-panel pl-8 pr-3 text-sm outline-none transition-colors duration-100 placeholder:text-gray focus:border-ink"
          />
        </form>
      </div>

      {list.length === 0 ? (
        <EmptyState>
          {q ? t.org.plazaEmptyNoMatch : t.org.plazaEmpty}
        </EmptyState>
      ) : (
        <>
        <div className="mt-3 rounded-md border border-line bg-panel">
          {list.map(({ org, memberCount }, i) => (
            <LocaleLink
              key={org.id}
              href={`/orgs/${org.id}`}
              className={`block px-4 py-3 transition-colors duration-100 hover:bg-bg-3 ${
                i > 0 ? "border-t border-line" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 truncate text-sm font-semibold">
                  {org.name}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-2xs text-gray">
                  <Users size={11} aria-hidden />
                  {memberCount}
                </span>
              </div>
              {org.description && (
                <p className="mt-1 truncate text-xs text-gray">
                  {org.description}
                </p>
              )}
            </LocaleLink>
          ))}
        </div>
        <ListEnd />
        </>
      )}
    </div>
  );
}
