
import { Badge } from "@/components/ui/badge";

import { Card } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import type { Org } from "@/lib/db/schema";
import { ShareCard } from "@/components/share-card";
import { getDict } from "@/lib/i18n/server";
import { LocaleLink } from "@/lib/i18n/link";
import { fmt } from "@/lib/i18n/fmt";
import { orgRoleEntryLabel, orgVisibilityLabel } from "@/lib/i18n/labels";
import type { OrgRole } from "@/lib/orgs";
import { badge, panel } from "@/lib/ui";

export async function OrgOverviewCard({
  org,
  role,
  memberCount,
  openNeedCount,
  pendingRequestCount,
  origin,
}: {
  org: Org;
  role: OrgRole;
  memberCount: number;
  openNeedCount: number;
  pendingRequestCount: number;
  origin: string;
}) {
  const t = await getDict();
  const isAdmin = role === "owner" || role === "admin";
  const canShare = role === "owner" || org.visibility === "public";
  const shareUrl =
    role === "owner"
      ? `${origin}/orgs?code=${encodeURIComponent(org.inviteCode)}`
      : `${origin}/orgs/${org.id}`;
  const actions = [
    { label: t.org.overviewNeeds, href: `/?org=${org.id}` },
    { label: t.org.overviewMembers, href: `/orgs/${org.id}#members` },
    ...(isAdmin
      ? [
          {
            label:
              pendingRequestCount > 0
                ? fmt(t.org.overviewReviewCount, { n: pendingRequestCount })
                : t.org.overviewReview,
            href: `/orgs/${org.id}#requests`,
          },
        ]
      : [{ label: t.org.overviewDetail, href: `/orgs/${org.id}` }]),
    ...(role === "owner"
      ? [{ label: t.org.overviewInvite, href: `/orgs/${org.id}#invite` }]
      : []),
  ];

  return (
    <Card as="article" className={`overflow-hidden ${panel}`}>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <LocaleLink
            href={`/orgs/${org.id}`}
            className="min-w-0 truncate text-base font-semibold hover:underline"
          >
            {org.name}
          </LocaleLink>
          <Badge className={badge}>
            {orgVisibilityLabel(t, org.visibility)}
          </Badge>
          <LocaleLink
            href={
              role === "owner"
                ? `/orgs/${org.id}#settings`
                : `/orgs/${org.id}`
            }
            className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-2xs text-gray transition-colors duration-100 hover:text-ink"
          >
            {orgRoleEntryLabel(t, role)}
            <ChevronRight size={12} aria-hidden />
          </LocaleLink>
        </div>

        {org.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-gray">
            {org.description}
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray">{t.org.overviewNoDescription}</p>
        )}

        <p className="mt-3 flex flex-wrap items-center gap-x-2 font-mono text-2xs text-gray">
          <span>{fmt(t.org.overviewMemberCount, { n: memberCount })}</span>
          <span aria-hidden>·</span>
          <span>{fmt(t.org.overviewOpenNeedCount, { n: openNeedCount })}</span>
          {isAdmin && (
            <>
              <span aria-hidden>·</span>
              <span className={pendingRequestCount > 0 ? "font-semibold text-ink" : ""}>
                {fmt(t.org.overviewPendingCount, { n: pendingRequestCount })}
              </span>
            </>
          )}
        </p>
      </div>

      <nav
        aria-label={fmt(t.org.overviewQuickActions, { name: org.name })}
        className="flex flex-wrap gap-2 border-t border-line p-3"
      >
        {actions.map((action) => (
          <LocaleLink
            key={action.label}
            href={action.href}
            className="flex min-h-11 grow items-center justify-center whitespace-nowrap rounded-sm border border-line px-3 text-xs font-semibold transition-colors duration-100 hover:bg-bg-3"
          >
            {action.label}
          </LocaleLink>
        ))}
        {canShare && (
          <div className="grow [&>button]:w-full [&>button]:justify-center [&>button]:text-xs">
            <ShareCard
              data={{
                kind: "org",
                name: org.name,
                description: org.description,
                visibility: org.visibility,
                memberCount,
                openNeedCount,
                url: shareUrl,
              }}
            />
          </div>
        )}
      </nav>
    </Card>
  );
}
