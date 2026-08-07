import { redirect } from "next/navigation";
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
import { version } from "@/package.json";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { logoutAction } from "@/app/actions/auth";
import { getUserOrgs } from "@/lib/queries";
import { listApiKeys } from "@/lib/api-keys-service";
import { siteOrigin } from "@/lib/site-url";
import { NeedCard } from "@/components/need-card";
import { AgentAccessContent } from "@/components/agent-access-content";
import { ThemeToggleRow } from "@/components/theme-toggle";
import { MeCategorySwitcher } from "@/components/me-category-switcher";
import { MeCardOverview } from "@/components/me-card-overview";
import { LogoutConfirmation } from "@/components/logout-confirmation";
import { DeleteAccountRow } from "@/components/delete-account";
import { OrgOverviewCard } from "@/components/org-overview-card";
import { BrandFooter } from "@/components/brand-footer";
import { EmptyState, ListEnd } from "@/components/list-states";
import { LanguageToggleRow } from "@/components/language-toggle";
import { getDict, getLocale } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import { LocaleLink } from "@/lib/i18n/link";
import { localePath } from "@/lib/i18n/routing";
import { fmt } from "@/lib/i18n/fmt";
import { ORG_LIMITS } from "@/lib/orgs";

export const generateMetadata = pageTitle((t) => t.me.metaTitle);

export default async function MePage({
  searchParams,
}: PageProps<"/[lang]/me">) {
  const t = await getDict();
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) redirect(localePath(locale, "/login?next=/me"));

  const params = await searchParams;
  const section = Array.isArray(params.section)
    ? params.section[0]
    : params.section;
  const activeCategory =
    section === "organization" ||
    section === "need" ||
    section === "agent" ||
    section === "settings"
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
      <h1 className="sr-only">{t.me.metaTitle}</h1>
      <MeCategorySwitcher
        activeCategory={activeCategory}
        user={
          <>
            <LocaleLink
              href="/notifications"
              className="mb-4 flex h-12 items-center gap-2 rounded-md border border-line bg-panel px-4 text-sm font-semibold transition-colors hover:bg-bg-3"
            >
              <Bell size={15} className="text-gray" aria-hidden />
              {t.me.notifications}
              {(unreadRow?.n ?? 0) > 0 && (
                <span className="ml-auto rounded-full bg-accent px-2 py-0.5 font-mono text-3xs text-panel">
                  {unreadRow.n}
                </span>
              )}
            </LocaleLink>
            <MeCardOverview
              user={user}
              shareUrl={`${origin}/u/${user.id}`}
            />

            <form action={logoutAction} className="mt-6">
              <LogoutConfirmation />
            </form>

            <BrandFooter />
          </>
        }
        organization={
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xs font-semibold tracking-[0.08em] text-gray">
                {t.me.myOrgs}
              </h2>
              <span className="font-mono text-2xs text-gray">
                {myOrgs.length} / {ORG_LIMITS.maxJoined}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <LocaleLink
                href="/orgs/new"
                className="flex h-11 items-center justify-center gap-1.5 rounded-sm bg-accent text-sm font-semibold tracking-[0.06em] text-panel active:translate-y-px"
              >
                <Plus size={14} strokeWidth={2.5} aria-hidden />
                {t.me.createOrg}
              </LocaleLink>
              <LocaleLink
                href="/orgs"
                className="flex h-11 items-center justify-center gap-1.5 rounded-sm border border-ink bg-panel text-sm font-semibold tracking-[0.06em] transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px"
              >
                <Search size={13} aria-hidden />
                {t.nav.discoverOrgs}
              </LocaleLink>
            </div>

            {myOrgCards.length === 0 ? (
              <EmptyState>{t.me.orgsEmpty}</EmptyState>
            ) : (
              <div className="mt-4 space-y-2">
                {myOrgCards.map((item) => (
                  <OrgOverviewCard key={item.org.id} {...item} origin={origin} />
                ))}
              </div>
            )}

            {myPending.length > 0 && (
              <section className="mt-4">
                <h3 className="text-2xs font-semibold tracking-[0.08em] text-gray">
                  {t.me.orgsPending}
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
                      <span className="ml-auto shrink-0 rounded-sm bg-bg-3 px-1.5 py-px font-mono text-3xs text-gray">
                        {t.me.orgsPendingBadge}
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
              <h2 className="text-2xs font-semibold tracking-[0.08em] text-gray">
                {t.me.myNeeds}
              </h2>
              <span className="font-mono text-2xs text-gray">
                {fmt(t.me.needsCount, { n: myNeeds.length })}
              </span>
            </div>
            {myNeeds.length === 0 ? (
              <EmptyState>
                {t.me.needsEmptyPrefix}
                <LocaleLink href="/needs/new" className="text-ink underline">
                  {t.me.needsEmptyLink}
                </LocaleLink>
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
        settings={
          <section>
            <div className="overflow-hidden rounded-md border border-line bg-panel">
              <ThemeToggleRow />
              <div className="border-t border-line">
                <LanguageToggleRow />
              </div>
              {isAdmin(user) && (
                <LocaleLink
                  href="/admin"
                  className="group flex min-h-16 w-full items-center gap-4 border-t border-line px-4 py-3 transition-colors duration-100 hover:bg-bg-3 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-ink"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {t.me.adminEntry}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray">
                      {t.me.adminEntryHint}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-2xs text-gray transition-colors duration-100 group-hover:text-ink">
                    {t.common.enter}
                  </span>
                </LocaleLink>
              )}
            </div>

            <section className="mt-6">
              <h2 className="text-2xs font-semibold tracking-[0.08em] text-gray">
                {t.me.sectionAbout}
              </h2>
              <div className="mt-2 overflow-hidden rounded-md border border-line bg-panel">
                <LocaleLink
                  href="/terms"
                  className="group flex h-12 items-center gap-4 px-4 text-sm font-semibold transition-colors duration-100 hover:bg-bg-3 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-ink"
                >
                  <span className="min-w-0 flex-1">{t.me.terms}</span>
                  <span className="shrink-0 font-mono text-2xs text-gray transition-colors duration-100 group-hover:text-ink">
                    {t.common.view}
                  </span>
                </LocaleLink>
                <LocaleLink
                  href="/privacy"
                  className="group flex h-12 items-center gap-4 border-t border-line px-4 text-sm font-semibold transition-colors duration-100 hover:bg-bg-3 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-ink"
                >
                  <span className="min-w-0 flex-1">{t.me.privacy}</span>
                  <span className="shrink-0 font-mono text-2xs text-gray transition-colors duration-100 group-hover:text-ink">
                    {t.common.view}
                  </span>
                </LocaleLink>
                <div className="flex h-12 items-center gap-4 border-t border-line px-4">
                  <span className="min-w-0 flex-1 text-sm font-semibold">
                    {t.me.version}
                  </span>
                  <span className="shrink-0 font-mono text-2xs text-gray">
                    v{version}
                  </span>
                </div>
              </div>
            </section>

            <section className="mt-6">
              <h2 className="text-2xs font-semibold tracking-[0.08em] text-gray">
                {t.me.sectionAccount}
              </h2>
              <div className="mt-2 overflow-hidden rounded-md border border-line bg-panel">
                <DeleteAccountRow
                  ownedOrgNames={myOrgs
                    .filter(({ role }) => role === "owner")
                    .map(({ org }) => org.name)}
                />
              </div>
            </section>
          </section>
        }
      />
    </div>
  );
}
