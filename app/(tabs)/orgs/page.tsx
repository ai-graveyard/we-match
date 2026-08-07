import Link from "next/link";
import { Search, Users } from "lucide-react";
import { count, desc, eq, sql, type SQL } from "drizzle-orm";
import { and } from "drizzle-orm";
import { db } from "@/lib/db";
import { orgMembers, orgs } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { ApplyByCodeForm } from "@/components/org-forms";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ListEnd } from "@/components/list-states";

export const metadata = { title: "组织广场" };
export const dynamic = "force-dynamic";

export default async function OrgPlazaPage({
  searchParams,
}: PageProps<"/orgs">) {
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
      <PageHeader title="组织广场" />

      {user ? (
        <div className="mt-4">
          <ApplyByCodeForm initialCode={prefillCode} />
        </div>
      ) : (
        <p className="mt-4 text-xs text-gray">
          <Link
            href={`/login?next=${encodeURIComponent(loginNext)}`}
            className="text-ink underline"
          >
            登录
          </Link>{" "}
          后可申请加入组织或创建组织
        </p>
      )}

      <div className="mt-4">
        <form action="/orgs" className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="搜索公开组织"
            className="h-10 w-full rounded-sm border border-line bg-panel pl-8 pr-3 text-sm outline-none transition-colors duration-100 placeholder:text-gray focus:border-ink"
          />
        </form>
      </div>

      {list.length === 0 ? (
        <EmptyState>{q ? "没有匹配的组织" : "还没有公开组织"}</EmptyState>
      ) : (
        <>
        <div className="mt-3 rounded-md border border-line bg-panel">
          {list.map(({ org, memberCount }, i) => (
            <Link
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
            </Link>
          ))}
        </div>
        <ListEnd />
        </>
      )}
    </div>
  );
}
