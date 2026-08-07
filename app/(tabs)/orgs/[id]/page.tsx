import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight, Search, Users, X } from "lucide-react";
import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { joinRequests, orgMembers, orgs, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { ORG_LIMITS, VISIBILITY_LABELS, isOrgAdminRole } from "@/lib/orgs";
import { countOrgAdmins } from "@/lib/queries";
import {
  ApplyPlazaButton,
  OrgSettingsForm,
} from "@/components/org-forms";
import {
  DissolveOrgButton,
  InviteCodePanel,
  LeaveOrgButton,
  PromoteAdminButton,
  RemoveMemberButton,
  RequestList,
  type PendingRequest,
} from "@/components/org-admin";
import { PageHeader } from "@/components/page-header";
import { DefaultUserAvatar } from "@/components/default-user-avatar";

const sectionTitleCls =
  "text-2xs font-semibold tracking-[0.08em] text-gray";

export async function generateMetadata({
  params,
}: PageProps<"/orgs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const oid = Number(id);
  if (!Number.isInteger(oid) || oid <= 0) return { title: "组织详情" };

  const [org] = await db.select().from(orgs).where(eq(orgs.id, oid)).limit(1);
  if (!org) return { title: "组织详情" };

  if (org.visibility === "private") {
    const viewer = await getSessionUser();
    if (!viewer) return { title: "组织详情" };
    const [membership] = await db
      .select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, oid), eq(orgMembers.userId, viewer.id)))
      .limit(1);
    if (!membership) return { title: "组织详情" };
  }

  const title = org.name;
  const description = org.description || `查看 ${org.name} 的公开组织资料`;
  return {
    title,
    description,
    openGraph: {
      title: `${title} · We Match`,
      description,
      type: "website",
    },
  };
}

export default async function OrgDetailPage({
  params,
  searchParams,
}: PageProps<"/orgs/[id]">) {
  const { id } = await params;
  const oid = Number(id);
  if (!Number.isInteger(oid) || oid <= 0) notFound();
  const [org] = await db.select().from(orgs).where(eq(orgs.id, oid)).limit(1);
  if (!org) notFound();

  const viewer = await getSessionUser();
  const membership = viewer
    ? await db
        .select()
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, oid), eq(orgMembers.userId, viewer.id)))
        .limit(1)
        .then((r) => r[0] ?? null)
    : null;
  const isOwner = membership?.role === "owner";
  const isOrgAdmin = membership ? isOrgAdminRole(membership.role) : false;

  // 私有组织对非成员完全不可见
  if (!membership && org.visibility !== "public") notFound();

  const [memberCount] = await db
    .select({ n: count() })
    .from(orgMembers)
    .where(eq(orgMembers.orgId, oid));

  // ---- 非成员视角：简介 + 申请加入 ----
  if (!membership) {
    let pendingMine = false;
    if (viewer) {
      const [p] = await db
        .select({ id: joinRequests.id })
        .from(joinRequests)
        .where(
          and(
            eq(joinRequests.orgId, oid),
            eq(joinRequests.userId, viewer.id),
            eq(joinRequests.status, "pending"),
          ),
        )
        .limit(1);
      pendingMine = !!p;
    }
    return (
      <div>
        <PageHeader title="组织详情" mobileOnly className="mb-4" />
        <section className="rounded-md border border-line bg-panel p-4">
          <div className="flex items-center gap-2">
            <h1 className="min-w-0 truncate text-xl font-semibold">
              {org.name}
            </h1>
            <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-2xs text-gray">
              <Users size={11} aria-hidden />
              {memberCount?.n ?? 0} 名成员
            </span>
          </div>
          {org.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm">{org.description}</p>
          )}
          <p className="mt-2 text-2xs text-gray">
            加入后可查看组织内的需求和成员
          </p>
        </section>
        <div className="mt-4">
          {!viewer ? (
            <Link
              href={`/login?next=/orgs/${oid}`}
              className="flex h-11 items-center justify-center rounded-sm bg-accent text-sm font-semibold tracking-[0.06em] text-panel active:translate-y-px"
            >
              登录后申请加入
            </Link>
          ) : pendingMine ? (
            <p className="text-center text-xs text-gray">
              已提交申请，等待管理员审批
            </p>
          ) : (
            <ApplyPlazaButton orgId={oid} />
          )}
        </div>
      </div>
    );
  }

  // ---- 成员视角 ----
  const sp = await searchParams;
  const pick = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const mq = pick(sp.mq)?.trim();
  const mtag = pick(sp.mtag)?.trim();

  const memberConds: SQL[] = [eq(orgMembers.orgId, oid)];
  if (mq) memberConds.push(sql`${users.nickname} LIKE ${`%${mq}%`}`);
  if (mtag) memberConds.push(sql`${users.tags} LIKE ${`%"${mtag}"%`}`);
  const members = await db
    .select({ user: users, role: orgMembers.role })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(and(...memberConds))
    .orderBy(orgMembers.joinedAt);
  const adminCount = await countOrgAdmins(oid);

  let requests: PendingRequest[] = [];
  if (isOrgAdmin) {
    const rows = await db
      .select({ req: joinRequests, applicant: users })
      .from(joinRequests)
      .innerJoin(users, eq(joinRequests.userId, users.id))
      .where(and(eq(joinRequests.orgId, oid), eq(joinRequests.status, "pending")))
      .orderBy(desc(joinRequests.createdAt));
    requests = rows.map(({ req, applicant }) => ({
      id: req.id,
      via: req.via,
      createdAt: req.createdAt.getTime(),
      applicant: { id: applicant.id, nickname: applicant.nickname },
    }));
  }

  const memberBase = `/orgs/${oid}`;
  const memberQuery = (next: { mq?: string; mtag?: string }) => {
    const qs = new URLSearchParams();
    if (next.mq) qs.set("mq", next.mq);
    if (next.mtag) qs.set("mtag", next.mtag);
    const s = qs.toString();
    return s ? `${memberBase}?${s}` : memberBase;
  };

  return (
    <div>
      <PageHeader title="组织详情" mobileOnly className="mb-4" />
      <section className="rounded-md border border-line bg-panel p-4">
        <div className="flex items-center gap-2">
          <h1 className="min-w-0 truncate text-xl font-semibold">{org.name}</h1>
          <span className="shrink-0 rounded-sm bg-bg-3 px-1.5 py-px font-mono text-3xs text-gray">
            {VISIBILITY_LABELS[org.visibility]}
          </span>
          <Link
            href={`/?org=${oid}`}
            className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-2xs text-gray hover:text-ink"
          >
            看组织内需求
            <ChevronRight size={12} aria-hidden />
          </Link>
        </div>
        {org.description && (
          <p className="mt-2 whitespace-pre-wrap text-sm">{org.description}</p>
        )}
      </section>

      <nav
        aria-label="组织功能"
        className="mt-3 flex gap-1.5 overflow-x-auto"
      >
        <Link
          href={`/?org=${oid}`}
          className="shrink-0 rounded-sm border border-line px-2.5 py-1 text-xs text-gray transition-colors duration-100 hover:border-ink hover:text-ink"
        >
          组织需求
        </Link>
        <Link
          href="#members"
          className="shrink-0 rounded-sm border border-line px-2.5 py-1 text-xs text-gray transition-colors duration-100 hover:border-ink hover:text-ink"
        >
          成员 {memberCount?.n ?? 0}
        </Link>
        {isOrgAdmin && (
          <Link
            href="#requests"
            className="shrink-0 rounded-sm border border-line px-2.5 py-1 text-xs text-gray transition-colors duration-100 hover:border-ink hover:text-ink"
          >
            待审批 {requests.length}
          </Link>
        )}
        {isOwner && (
          <>
            <Link
              href="#invite"
              className="shrink-0 rounded-sm border border-line px-2.5 py-1 text-xs text-gray transition-colors duration-100 hover:border-ink hover:text-ink"
            >
              邀请成员
            </Link>
            <Link
              href="#settings"
              className="shrink-0 rounded-sm border border-line px-2.5 py-1 text-xs text-gray transition-colors duration-100 hover:border-ink hover:text-ink"
            >
              资料设置
            </Link>
          </>
        )}
      </nav>

      <section id="members" className="mt-4 scroll-mt-4">
        <div className="flex items-baseline justify-between">
          <h2 className={sectionTitleCls}>成员（{members.length}）</h2>
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xs text-gray">
              已任命管理员 {adminCount} / {ORG_LIMITS.maxAdmins}
            </span>
            {membership.role !== "owner" && <LeaveOrgButton orgId={oid} />}
          </div>
        </div>
        <form action={memberBase} className="relative mt-2">
          {mtag && <input type="hidden" name="mtag" value={mtag} />}
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray"
            aria-hidden
          />
          <input
            type="search"
            name="mq"
            defaultValue={mq ?? ""}
            placeholder="按昵称搜索成员"
            className="h-10 w-full rounded-sm border border-line bg-panel pl-8 pr-3 text-sm outline-none transition-colors duration-100 placeholder:text-gray focus:border-ink"
          />
        </form>
        {mtag && (
          <div className="mt-2">
            <Link
              href={memberQuery({ mq })}
              className="inline-flex items-center gap-1 rounded-sm border border-ink px-1.5 py-0.5 font-mono text-2xs"
            >
              {mtag}
              <X size={11} aria-hidden />
            </Link>
          </div>
        )}
        <div className="mt-2 rounded-md border border-line bg-panel">
          {members.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-gray">
              没有匹配的成员
            </p>
          ) : (
            members.map(({ user: member, role }, i) => (
              <div
                key={member.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i > 0 ? "border-t border-line" : ""
                }`}
              >
                <Link
                  href={`/u/${member.id}`}
                  aria-label={`查看 ${member.nickname} 的名片`}
                >
                  <DefaultUserAvatar className="size-9" iconSize={17} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/u/${member.id}`}
                      className="truncate text-sm font-semibold hover:underline"
                    >
                      {member.nickname}
                    </Link>
                    {role === "owner" && (
                      <span className="shrink-0 rounded-sm bg-bg-3 px-1.5 py-px font-mono text-3xs text-gray">
                        拥有者 · 管理员
                      </span>
                    )}
                    {role === "admin" && (
                      <span className="shrink-0 rounded-sm bg-bg-3 px-1.5 py-px font-mono text-3xs text-gray">
                        管理员
                      </span>
                    )}
                  </div>
                  {member.tags.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {member.tags.slice(0, 5).map((tag) => (
                        <Link
                          key={tag}
                          href={memberQuery({ mq, mtag: tag })}
                          className="rounded-sm border border-line px-1 py-px font-mono text-3xs text-gray transition-colors duration-100 hover:border-ink hover:text-ink"
                        >
                          {tag}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                {member.id !== org.ownerId && (
                  <div className="flex shrink-0 items-center gap-3">
                    {isOrgAdmin && role === "member" && (
                      <PromoteAdminButton
                        orgId={oid}
                        userId={member.id}
                        nickname={member.nickname}
                        limitReached={adminCount >= ORG_LIMITS.maxAdmins}
                      />
                    )}
                    {isOwner && (
                      <RemoveMemberButton
                        orgId={oid}
                        userId={member.id}
                        nickname={member.nickname}
                      />
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {isOrgAdmin && (
        <section
          id="requests"
          className="mt-4 scroll-mt-4 rounded-md border border-line bg-panel p-4"
        >
          <h2 className={`${sectionTitleCls} mb-2`}>
            待审批申请（{requests.length}）
          </h2>
          <RequestList requests={requests} />
        </section>
      )}

      {isOwner && (
        <>
          <section
            id="invite"
            className="mt-4 scroll-mt-4 rounded-md border border-line bg-panel p-4"
          >
            <h2 className={`${sectionTitleCls} mb-2`}>邀请码</h2>
            <InviteCodePanel orgId={oid} code={org.inviteCode} />
          </section>
          <section
            id="settings"
            className="mt-4 scroll-mt-4 rounded-md border border-line bg-panel p-4"
          >
            <h2 className={`${sectionTitleCls} mb-3`}>组织资料</h2>
            <OrgSettingsForm
              org={{
                id: org.id,
                name: org.name,
                description: org.description ?? "",
                visibility: org.visibility,
              }}
            />
          </section>
          <div className="mt-4 flex justify-end">
            <DissolveOrgButton orgId={oid} />
          </div>
        </>
      )}
    </div>
  );
}
