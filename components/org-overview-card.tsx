import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Org } from "@/lib/db/schema";
import { VISIBILITY_LABELS } from "@/lib/orgs";
import { ShareCard } from "@/components/share-card";

type OrgRole = "owner" | "admin" | "member";

export function OrgOverviewCard({
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
  const isAdmin = role === "owner" || role === "admin";
  const canShare = role === "owner" || org.visibility === "public";
  const shareUrl =
    role === "owner"
      ? `${origin}/orgs?code=${encodeURIComponent(org.inviteCode)}`
      : `${origin}/orgs/${org.id}`;
  const actions = [
    { label: "需求", href: `/?org=${org.id}` },
    { label: "成员", href: `/orgs/${org.id}#members` },
    ...(isAdmin
      ? [
          {
            label:
              pendingRequestCount > 0
                ? `审批 ${pendingRequestCount}`
                : "审批",
            href: `/orgs/${org.id}#requests`,
          },
        ]
      : [{ label: "详情", href: `/orgs/${org.id}` }]),
    ...(role === "owner"
      ? [{ label: "邀请", href: `/orgs/${org.id}#invite` }]
      : []),
  ];

  return (
    <article className="overflow-hidden rounded-md border border-line bg-panel">
      <div className="p-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/orgs/${org.id}`}
            className="min-w-0 truncate text-base font-semibold hover:underline"
          >
            {org.name}
          </Link>
          <span className="shrink-0 rounded-sm bg-bg-3 px-1.5 py-px font-mono text-[10px] text-gray">
            {VISIBILITY_LABELS[org.visibility]}
          </span>
          <Link
            href={
              role === "owner"
                ? `/orgs/${org.id}#settings`
                : `/orgs/${org.id}`
            }
            className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[11px] text-gray transition-colors duration-100 hover:text-ink"
          >
            {role === "owner" ? "设置" : role === "admin" ? "管理" : "主页"}
            <ChevronRight size={12} aria-hidden />
          </Link>
        </div>

        {org.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-gray">
            {org.description}
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray">暂无组织简介</p>
        )}

        <p className="mt-3 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-gray">
          <span>{memberCount} 名成员</span>
          <span aria-hidden>·</span>
          <span>{openNeedCount} 条开放需求</span>
          {isAdmin && (
            <>
              <span aria-hidden>·</span>
              <span className={pendingRequestCount > 0 ? "font-semibold text-ink" : ""}>
                {pendingRequestCount} 条待审批
              </span>
            </>
          )}
        </p>
      </div>

      <nav
        aria-label={`${org.name}快捷操作`}
        className="grid border-t border-line"
        style={{
          gridTemplateColumns: `repeat(${actions.length + (canShare ? 1 : 0)}, minmax(0, 1fr))`,
        }}
      >
        {actions.map((action, index) => (
          <Link
            key={action.label}
            href={action.href}
            className={`flex h-10 items-center justify-center text-[11px] font-semibold tracking-[0.08em] transition-colors duration-100 hover:bg-bg-3 ${
              index > 0 ? "border-l border-line" : ""
            }`}
          >
            {action.label}
          </Link>
        ))}
        {canShare && (
          <div className="border-l border-line [&>button]:h-10 [&>button]:min-h-10 [&>button]:w-full [&>button]:justify-center [&>button]:rounded-none [&>button]:border-0 [&>button]:px-2 [&>button]:text-[11px]">
            <ShareCard
              data={{
                kind: "org",
                name: org.name,
                description: org.description,
                visibilityLabel: VISIBILITY_LABELS[org.visibility],
                memberCount,
                openNeedCount,
                url: shareUrl,
              }}
            />
          </div>
        )}
      </nav>
    </article>
  );
}
