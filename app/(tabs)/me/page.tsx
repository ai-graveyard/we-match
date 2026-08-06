import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell, Plus, Search } from "lucide-react";
import { and, count, desc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  joinRequests,
  needs,
  notifications,
  orgMembers,
  orgs,
} from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { logoutAction } from "@/app/actions/auth";
import { getUserOrgs } from "@/lib/queries";
import { listApiKeys } from "@/lib/api-keys";
import { siteOrigin } from "@/lib/site-url";
import { NeedCard } from "@/components/need-card";
import { AgentAccessContent } from "@/components/agent-access-content";
import { ThemeToggleRow } from "@/components/theme-toggle";
import { MeCategorySwitcher } from "@/components/me-category-switcher";
import { MeCardOverview } from "@/components/me-card-overview";
import { LogoutConfirmation } from "@/components/logout-confirmation";
import { OrgOverviewCard } from "@/components/org-overview-card";
import { BrandFooter } from "@/components/brand-footer";
import { EmptyState, ListEnd } from "@/components/list-states";

export const metadata = { title: "我的" };

export default async function MePage({ searchParams }: PageProps<"/me">) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/me");

  const params = await searchParams;
  const section = Array.isArray(params.section)
    ? params.section[0]
    : params.section;
  const activeCategory =
    section === "organization" || section === "need" || section === "agent"
      ? section
      : "user";

  const apiKeys = await listApiKeys(user.id);
  const origin = await siteOrigin();
  const [unreadRow] = await db
    .select({ n: count() })
    .from(notifications)
    .where(
      and(eq(notifications.userId, user.id), isNull(notifications.readAt)),
    );

  const myNeeds = await db
    .select()
    .from(needs)
    .where(eq(needs.userId, user.id))
    .orderBy(desc(needs.updatedAt));

  const myOrgs = await getUserOrgs(user.id);
  const myOrgCards = await Promise.all(
    myOrgs.map(async ({ org, role }) => {
      const [[membersRow], [openNeedsRow], [pendingRow]] = await Promise.all([
        db
          .select({ n: count() })
          .from(orgMembers)
          .where(eq(orgMembers.orgId, org.id)),
        db
          .select({ n: count() })
          .from(needs)
          .where(
            and(
              eq(needs.orgId, org.id),
              eq(needs.status, "open"),
              or(isNull(needs.expiresAt), gt(needs.expiresAt, new Date())),
            ),
          ),
        role === "member"
          ? Promise.resolve([{ n: 0 }])
          : db
              .select({ n: count() })
              .from(joinRequests)
              .where(
                and(
                  eq(joinRequests.orgId, org.id),
                  eq(joinRequests.status, "pending"),
                ),
              ),
      ]);

      return {
        org,
        role,
        memberCount: membersRow?.n ?? 0,
        openNeedCount: openNeedsRow?.n ?? 0,
        pendingRequestCount: pendingRow?.n ?? 0,
      };
    }),
  );
  const myPending = await db
    .select({ orgId: orgs.id, orgName: orgs.name })
    .from(joinRequests)
    .innerJoin(orgs, eq(joinRequests.orgId, orgs.id))
    .where(
      and(eq(joinRequests.userId, user.id), eq(joinRequests.status, "pending")),
    )
    .orderBy(desc(joinRequests.createdAt));

  return (
    <div>
      <h1 className="sr-only">我的</h1>
      <MeCategorySwitcher
        activeCategory={activeCategory}
        user={
          <>
            <Link
              href="/notifications"
              className="mb-4 flex h-12 items-center gap-2 rounded-md border border-line bg-panel px-4 text-sm font-semibold transition-colors hover:bg-bg-3"
            >
              <Bell size={15} className="text-gray" aria-hidden />
              通知
              {(unreadRow?.n ?? 0) > 0 && (
                <span className="ml-auto rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] text-panel">
                  {unreadRow.n}
                </span>
              )}
            </Link>
            <MeCardOverview
              user={user}
              shareUrl={`${origin}/u/${user.id}`}
            />

            <section className="mt-6">
              <h2 className="text-[11px] font-semibold tracking-[0.08em] text-gray">
                设置与管理
              </h2>
              <div className="mt-2 overflow-hidden rounded-md border border-line bg-panel">
                <ThemeToggleRow />
                {isAdmin(user) && (
                  <Link
                    href="/admin"
                    className="group flex min-h-16 w-full items-center gap-4 border-t border-line px-4 py-3 transition-colors duration-100 hover:bg-bg-3 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-ink"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        管理后台
                      </span>
                      <span className="mt-0.5 block text-xs text-gray">
                        平台运营、内容治理与操作日志
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-gray transition-colors duration-100 group-hover:text-ink">
                      进入
                    </span>
                  </Link>
                )}
              </div>
            </section>

            <form action={logoutAction} className="mt-6">
              <LogoutConfirmation />
            </form>

            <BrandFooter />
          </>
        }
        organization={
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[11px] font-semibold tracking-[0.08em] text-gray">
                我的组织
              </h2>
              <span className="font-mono text-[11px] text-gray">
                {myOrgs.length} / 3
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link
                href="/orgs/new"
                className="flex h-10 items-center justify-center gap-1.5 rounded-sm bg-accent text-xs font-semibold tracking-[0.08em] text-panel active:translate-y-px"
              >
                <Plus size={14} strokeWidth={2.5} aria-hidden />
                创建组织
              </Link>
              <Link
                href="/orgs"
                className="flex h-10 items-center justify-center gap-1.5 rounded-sm border border-ink bg-panel text-xs font-semibold tracking-[0.08em] transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px"
              >
                <Search size={13} aria-hidden />
                发现组织
              </Link>
            </div>

            {myOrgCards.length === 0 ? (
              <EmptyState>还没有加入组织，可以创建一个或去组织广场看看</EmptyState>
            ) : (
              <div className="mt-4 space-y-2">
                {myOrgCards.map((item) => (
                  <OrgOverviewCard key={item.org.id} {...item} origin={origin} />
                ))}
              </div>
            )}

            {myPending.length > 0 && (
              <section className="mt-4">
                <h3 className="text-[11px] font-semibold tracking-[0.08em] text-gray">
                  申请中
                </h3>
                <div className="mt-2 rounded-md border border-line bg-panel">
                  {myPending.map((pendingOrg, index) => (
                    <div
                      key={pendingOrg.orgId}
                      className={`flex h-12 items-center gap-2 px-4 text-sm ${
                        index > 0 ? "border-t border-line" : ""
                      }`}
                    >
                      <span className="min-w-0 truncate">
                        {pendingOrg.orgName}
                      </span>
                      <span className="ml-auto shrink-0 rounded-sm bg-bg-3 px-1.5 py-px font-mono text-[10px] text-gray">
                        等待审批
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </section>
        }
        need={
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[11px] font-semibold tracking-[0.08em] text-gray">
                我的需求
              </h2>
              <span className="font-mono text-[11px] text-gray">
                {myNeeds.length} 条
              </span>
            </div>
            {myNeeds.length === 0 ? (
              <EmptyState>
                还没有发布过需求 ·{" "}
                <Link href="/needs/new" className="text-ink underline">
                  去发布
                </Link>
              </EmptyState>
            ) : (
              <>
                <div className="mt-2 rounded-md border border-line bg-panel">
                  {myNeeds.map((needItem, i) => (
                    <NeedCard
                      key={needItem.id}
                      need={needItem}
                      first={i === 0}
                    />
                  ))}
                </div>
                <ListEnd />
              </>
            )}
          </section>
        }
        agent={
          <AgentAccessContent apiKeys={apiKeys} origin={origin} />
        }
      />
    </div>
  );
}
