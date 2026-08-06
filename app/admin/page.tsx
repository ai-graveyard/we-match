import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { count, desc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  analyticsEvents,
  auditLogs,
  connections,
  joinRequests,
  needs,
  orgMembers,
  orgs,
  reports,
  sessions,
  users,
} from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { isExpired, STATUS_LABELS, TYPE_LABELS } from "@/lib/needs";
import { VISIBILITY_LABELS, REQUEST_VIA_LABELS } from "@/lib/orgs";
import { shortDateTime } from "@/lib/format";
import {
  handleReportAction,
  moderateContentAction,
} from "@/app/actions/safety";

export const dynamic = "force-dynamic";

const ADMIN_VIEWS = [
  "overview",
  "reports",
  "users",
  "needs",
  "orgs",
  "requests",
  "audit",
] as const;

type AdminView = (typeof ADMIN_VIEWS)[number];

const VIEW_LABELS: Record<AdminView, string> = {
  overview: "总览",
  reports: "举报",
  users: "用户",
  needs: "需求",
  orgs: "组织",
  requests: "申请",
  audit: "日志",
};

const REQUEST_STATUS_LABELS = {
  pending: "待审批",
  approved: "已通过",
  rejected: "已拒绝",
} as const;

const REPORT_REASON_LABELS = {
  spam: "垃圾信息",
  fraud: "欺诈",
  harassment: "骚扰",
  illegal: "违法内容",
  other: "其他",
} as const;

const REPORT_STATUS_LABELS = {
  pending: "待处理",
  resolved: "已处理",
  dismissed: "已驳回",
} as const;

const actionButtonCls =
  "flex h-10 w-full items-center justify-center rounded-sm border border-ink bg-panel text-[11px] font-semibold tracking-[0.08em] transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px";
const tableActionButtonCls =
  "inline-flex h-5 items-center justify-center whitespace-nowrap rounded-sm border border-line bg-panel px-1.5 text-[10px] font-semibold transition-colors duration-100 hover:border-ink hover:bg-bg-3 active:translate-y-px";
const thCls =
  "whitespace-nowrap px-3 py-1.5 text-left text-[10px] font-semibold tracking-[0.08em] text-gray";
const tdCls = "px-3 py-1 align-middle text-xs";
const PAGE_SIZE = 10;

function adminHref(view: AdminView, page = 1) {
  const params = new URLSearchParams();
  if (view !== "overview") params.set("view", view);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="mb-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-1 text-xs text-gray">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ItemGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2 md:hidden">{children}</div>;
}

function DesktopTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="hidden overflow-x-auto rounded-md border border-line bg-panel md:block">
      <table className="w-full border-collapse">
        <thead className="border-b border-line bg-bg-2">
          <tr>
            {headers.map((header) => (
              <th key={header} className={thCls}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Pagination({
  view,
  page,
  pageCount,
}: {
  view: AdminView;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;

  const linkCls =
    "flex h-9 min-w-20 items-center justify-center rounded-sm border border-line bg-panel px-3 text-xs transition-colors duration-100 hover:border-ink hover:bg-bg-3";
  const disabledCls =
    "flex h-9 min-w-20 items-center justify-center rounded-sm border border-line px-3 text-xs text-gray opacity-50";

  return (
    <nav
      aria-label={`${VIEW_LABELS[view]}分页`}
      className="mt-4 flex items-center justify-between gap-3"
    >
      {page > 1 ? (
        <Link href={adminHref(view, page - 1)} className={linkCls}>
          上一页
        </Link>
      ) : (
        <span className={disabledCls}>上一页</span>
      )}
      <span className="font-mono text-[11px] text-gray">
        {page} / {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={adminHref(view, page + 1)} className={linkCls}>
          下一页
        </Link>
      ) : (
        <span className={disabledCls}>下一页</span>
      )}
    </nav>
  );
}

function EmptyList({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-panel px-4 py-8 text-center text-sm text-gray">
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  mono = false,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <dt className="text-[10px] font-semibold tracking-[0.08em] text-gray">
        {label}
      </dt>
      <dd
        className={`mt-0.5 break-words text-xs ${mono ? "font-mono" : ""}`}
      >
        {children}
      </dd>
    </div>
  );
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-sm bg-bg-3 px-2 py-1 font-mono text-[10px] text-gray">
      {children}
    </span>
  );
}

export default async function AdminPage({
  searchParams,
}: PageProps<"/admin">) {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/login?next=/admin");
  if (!isAdmin(viewer)) notFound();

  const rawParams = await searchParams;
  const rawView = Array.isArray(rawParams.view)
    ? rawParams.view[0]
    : rawParams.view;
  const activeView: AdminView = ADMIN_VIEWS.includes(rawView as AdminView)
    ? (rawView as AdminView)
    : "overview";

  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  const allNeeds = await db
    .select({ need: needs, author: users, org: orgs })
    .from(needs)
    .innerJoin(users, eq(needs.userId, users.id))
    .leftJoin(orgs, eq(needs.orgId, orgs.id))
    .orderBy(desc(needs.updatedAt));
  const allOrgs = await db
    .select({ org: orgs, owner: users })
    .from(orgs)
    .innerJoin(users, eq(orgs.ownerId, users.id))
    .orderBy(desc(orgs.createdAt));
  const memberships = await db.select().from(orgMembers);
  const allRequests = await db
    .select({ req: joinRequests, applicant: users, org: orgs })
    .from(joinRequests)
    .innerJoin(users, eq(joinRequests.userId, users.id))
    .innerJoin(orgs, eq(joinRequests.orgId, orgs.id))
    .orderBy(desc(joinRequests.createdAt));
  const [activeSessions] = await db
    .select({ n: count() })
    .from(sessions)
    .where(gt(sessions.expiresAt, new Date()));
  const [allConnections, allReports, recentAudit, funnelEvents] =
    await Promise.all([
      db.select().from(connections).orderBy(desc(connections.updatedAt)),
      db.select().from(reports).orderBy(desc(reports.createdAt)),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50),
      db.select({ name: analyticsEvents.name }).from(analyticsEvents),
    ]);

  const userById = new Map(allUsers.map((user) => [user.id, user]));
  const needCountByUser = new Map<number, number>();
  for (const { need } of allNeeds) {
    needCountByUser.set(
      need.userId,
      (needCountByUser.get(need.userId) ?? 0) + 1,
    );
  }
  const orgCountByUser = new Map<number, number>();
  const memberCountByOrg = new Map<number, number>();
  for (const membership of memberships) {
    orgCountByUser.set(
      membership.userId,
      (orgCountByUser.get(membership.userId) ?? 0) + 1,
    );
    memberCountByOrg.set(
      membership.orgId,
      (memberCountByOrg.get(membership.orgId) ?? 0) + 1,
    );
  }

  const pendingRequestCount = allRequests.filter(
    ({ req }) => req.status === "pending",
  ).length;
  const pendingReportCount = allReports.filter(
    (report) => report.status === "pending",
  ).length;
  const completedConnectionCount = allConnections.filter(
    (connection) => connection.status === "completed",
  ).length;
  const stats = [
    { label: "用户", value: allUsers.length },
    { label: "需求", value: allNeeds.length },
    { label: "组织", value: allOrgs.length },
    { label: "待审批", value: pendingRequestCount },
    { label: "活跃会话", value: activeSessions?.n ?? 0 },
    { label: "成功连接", value: completedConnectionCount },
    { label: "待处理举报", value: pendingReportCount },
  ];
  const funnel = [
    ["发布需求", "need_created"],
    ["收到举手", "connection_requested"],
    ["接受连接", "connection_accepted"],
    ["双方完成", "connection_completed"],
  ].map(([label, name]) => ({
    label,
    value: funnelEvents.filter((event) => event.name === name).length,
  }));
  const viewCounts: Partial<Record<AdminView, number>> = {
    reports: pendingReportCount,
    users: allUsers.length,
    needs: allNeeds.length,
    orgs: allOrgs.length,
    requests: pendingRequestCount,
    audit: recentAudit.length,
  };
  const itemCountByView: Record<AdminView, number> = {
    overview: 0,
    reports: allReports.length,
    users: allUsers.length,
    needs: allNeeds.length,
    orgs: allOrgs.length,
    requests: allRequests.length,
    audit: recentAudit.length,
  };
  const rawPage = Array.isArray(rawParams.page)
    ? rawParams.page[0]
    : rawParams.page;
  const parsedPage = Number.parseInt(rawPage ?? "1", 10);
  const pageCount = Math.max(
    1,
    Math.ceil(itemCountByView[activeView] / PAGE_SIZE),
  );
  const currentPage = Number.isFinite(parsedPage)
    ? Math.min(Math.max(parsedPage, 1), pageCount)
    : 1;
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleReports = allReports.slice(pageStart, pageStart + PAGE_SIZE);
  const visibleUsers = allUsers.slice(pageStart, pageStart + PAGE_SIZE);
  const visibleNeeds = allNeeds.slice(pageStart, pageStart + PAGE_SIZE);
  const visibleOrgs = allOrgs.slice(pageStart, pageStart + PAGE_SIZE);
  const visibleRequests = allRequests.slice(pageStart, pageStart + PAGE_SIZE);
  const visibleAudit = recentAudit.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div>
      <h1 className="sr-only">管理后台</h1>

      <nav
        aria-label="后台模块"
        className="sticky top-0 z-10 -mx-4 border-b border-line bg-bg px-4 py-2 md:-mx-8 md:px-8"
      >
        <div className="grid grid-cols-4 gap-2 md:flex md:w-max">
          {ADMIN_VIEWS.map((view) => {
            const active = view === activeView;
            return (
              <Link
                key={view}
                href={adminHref(view)}
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={`flex h-9 min-w-0 items-center justify-center gap-1 rounded-sm border px-2 text-xs transition-colors duration-100 md:px-3 ${
                  active
                    ? "border-ink bg-ink font-semibold text-panel"
                    : "border-line bg-panel text-gray hover:border-ink hover:text-ink"
                }`}
              >
                {VIEW_LABELS[view]}
                {viewCounts[view] !== undefined && (
                  <span className="font-mono text-[10px]">
                    {viewCounts[view]}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {activeView === "overview" && (
        <>
          <Section title="关键数据" description="当前平台的实时状态">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-md border border-line bg-panel px-4 py-3"
                >
                  <div className="text-[11px] text-gray">{stat.label}</div>
                  <div className="mt-1 font-mono text-xl font-semibold">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="撮合漏斗" description="从发布需求到双方确认完成">
            <div className="grid grid-cols-2 overflow-hidden rounded-md border border-line bg-line gap-px sm:grid-cols-4">
              {funnel.map((item) => (
                <div key={item.label} className="bg-panel p-4">
                  <div className="text-[11px] text-gray">{item.label}</div>
                  <div className="mt-1 font-mono text-xl font-semibold">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="管理模块" description="选择一项进入详细管理">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ADMIN_VIEWS.filter((view) => view !== "overview").map((view) => (
                <Link
                  key={view}
                  href={adminHref(view)}
                  className="rounded-md border border-line bg-panel p-4 transition-colors duration-100 hover:border-ink hover:bg-bg-3"
                >
                  <div className="text-sm font-semibold">
                    {VIEW_LABELS[view]}
                  </div>
                  <div className="mt-2 font-mono text-lg">
                    {viewCounts[view] ?? 0}
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        </>
      )}

      {activeView === "reports" && (
        <Section
          title={`举报 · ${allReports.length}`}
          description={`其中 ${pendingReportCount} 条等待处理`}
        >
          {allReports.length === 0 ? (
            <EmptyList>暂无举报</EmptyList>
          ) : (
            <>
              <DesktopTable
                headers={[
                  "ID",
                  "对象",
                  "原因",
                  "举报人",
                  "补充说明",
                  "状态",
                  "提交时间",
                  "操作",
                ]}
              >
                {visibleReports.map((report) => {
                  const reporter = report.reporterId
                    ? userById.get(report.reporterId)
                    : null;
                  const targetHref =
                    report.targetType === "need"
                      ? `/needs/${report.targetId}`
                      : `/u/${report.targetId}`;
                  return (
                    <tr
                      key={report.id}
                      className="border-b border-line last:border-b-0"
                    >
                      <td className={`${tdCls} font-mono`}>{report.id}</td>
                      <td className={tdCls}>
                        <Link
                          href={targetHref}
                          className="whitespace-nowrap font-semibold hover:underline"
                        >
                          {report.targetType === "need" ? "需求" : "用户"} #
                          {report.targetId}
                        </Link>
                      </td>
                      <td className={`${tdCls} whitespace-nowrap`}>
                        {REPORT_REASON_LABELS[report.reason]}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap`}>
                        {reporter?.nickname ?? "匿名"}
                      </td>
                      <td className={`${tdCls} max-w-48`}>
                        <span className="line-clamp-2">
                          {report.details ?? "—"}
                        </span>
                      </td>
                      <td className={`${tdCls} whitespace-nowrap font-mono text-[10px] text-gray`}>
                        {REPORT_STATUS_LABELS[report.status]}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap font-mono text-[10px] text-gray`}>
                        {shortDateTime(report.createdAt)}
                      </td>
                      <td className={tdCls}>
                        {report.status === "pending" ? (
                          <form
                            action={handleReportAction}
                            className="flex gap-1"
                          >
                            <input
                              type="hidden"
                              name="reportId"
                              value={report.id}
                            />
                            <button
                              type="submit"
                              name="decision"
                              value="dismissed"
                              className={tableActionButtonCls}
                            >
                              驳回
                            </button>
                            <button
                              type="submit"
                              name="decision"
                              value="resolved"
                              className={tableActionButtonCls}
                            >
                              已处理
                            </button>
                          </form>
                        ) : (
                          <span className="text-gray">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </DesktopTable>

              <ItemGrid>
                {visibleReports.map((report) => {
                  const reporter = report.reporterId
                    ? userById.get(report.reporterId)
                    : null;
                  const targetHref =
                    report.targetType === "need"
                      ? `/needs/${report.targetId}`
                      : `/u/${report.targetId}`;
                  return (
                    <article
                      key={report.id}
                      className="overflow-hidden rounded-md border border-line bg-panel"
                    >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-mono text-gray">
                            REPORT #{report.id}
                          </div>
                          <Link
                            href={targetHref}
                            className="mt-1 block text-sm font-semibold hover:underline"
                          >
                            {report.targetType === "need" ? "需求" : "用户"} #
                            {report.targetId}
                          </Link>
                        </div>
                        <Status>{REPORT_STATUS_LABELS[report.status]}</Status>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                        <Field label="原因">
                          {REPORT_REASON_LABELS[report.reason]}
                        </Field>
                        <Field label="举报人">{reporter?.nickname ?? "匿名"}</Field>
                        <Field label="提交时间" mono full>
                          {shortDateTime(report.createdAt)}
                        </Field>
                        {report.details && (
                          <Field label="补充说明" full>
                            {report.details}
                          </Field>
                        )}
                      </dl>
                    </div>
                    {report.status === "pending" && (
                      <form
                        action={handleReportAction}
                        className="grid grid-cols-2 gap-2 border-t border-line p-3"
                      >
                        <input type="hidden" name="reportId" value={report.id} />
                        <button
                          type="submit"
                          name="decision"
                          value="dismissed"
                          className={actionButtonCls}
                        >
                          驳回
                        </button>
                        <button
                          type="submit"
                          name="decision"
                          value="resolved"
                          className={actionButtonCls}
                        >
                          标记已处理
                        </button>
                      </form>
                    )}
                    </article>
                  );
                })}
              </ItemGrid>
              <Pagination
                view="reports"
                page={currentPage}
                pageCount={pageCount}
              />
            </>
          )}
        </Section>
      )}

      {activeView === "users" && (
        <Section title={`用户 · ${allUsers.length}`} description="查看账号状态与使用情况">
          {allUsers.length === 0 ? (
            <EmptyList>暂无用户</EmptyList>
          ) : (
            <>
              <DesktopTable
                headers={[
                  "ID",
                  "昵称",
                  "手机号",
                  "城市",
                  "标签",
                  "需求",
                  "组织",
                  "状态",
                  "注册时间",
                  "操作",
                ]}
              >
                {visibleUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className={`${tdCls} font-mono`}>{user.id}</td>
                    <td className={tdCls}>
                      <Link
                        href={`/u/${user.id}`}
                        className="whitespace-nowrap font-semibold hover:underline"
                      >
                        {user.nickname}
                      </Link>
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono`}>
                      {user.phone}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>
                      {user.city ?? "—"}
                    </td>
                    <td className={`${tdCls} max-w-48 font-mono text-[10px] text-gray`}>
                      <span className="line-clamp-2">
                        {user.tags.join(" · ") || "—"}
                      </span>
                    </td>
                    <td className={`${tdCls} font-mono`}>
                      {needCountByUser.get(user.id) ?? 0}
                    </td>
                    <td className={`${tdCls} font-mono`}>
                      {orgCountByUser.get(user.id) ?? 0}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-[10px] text-gray`}>
                      {user.id === viewer.id
                        ? "当前管理员"
                        : user.status === "active"
                          ? "正常"
                          : "已暂停"}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-[10px] text-gray`}>
                      {shortDateTime(user.createdAt)}
                    </td>
                    <td className={tdCls}>
                      {user.id !== viewer.id ? (
                        <form action={moderateContentAction}>
                          <input
                            type="hidden"
                            name="targetType"
                            value="user"
                          />
                          <input
                            type="hidden"
                            name="targetId"
                            value={user.id}
                          />
                          <button
                            type="submit"
                            name="moderationAction"
                            value={
                              user.status === "active" ? "suspend" : "restore"
                            }
                            className={tableActionButtonCls}
                          >
                            {user.status === "active" ? "暂停" : "恢复"}
                          </button>
                        </form>
                      ) : (
                        <span className="text-gray">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </DesktopTable>

              <ItemGrid>
                {visibleUsers.map((user) => (
                  <article
                    key={user.id}
                    className="overflow-hidden rounded-md border border-line bg-panel"
                  >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono text-gray">
                          USER #{user.id}
                        </div>
                        <Link
                          href={`/u/${user.id}`}
                          className="mt-1 block truncate text-sm font-semibold hover:underline"
                        >
                          {user.nickname}
                        </Link>
                      </div>
                      <Status>
                        {user.id === viewer.id
                          ? "当前管理员"
                          : user.status === "active"
                            ? "正常"
                            : "已暂停"}
                      </Status>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                      <Field label="手机号" mono>
                        {user.phone}
                      </Field>
                      <Field label="城市">{user.city ?? "—"}</Field>
                      <Field label="需求 / 组织" mono>
                        {needCountByUser.get(user.id) ?? 0} /{" "}
                        {orgCountByUser.get(user.id) ?? 0}
                      </Field>
                      <Field label="注册时间" mono>
                        {shortDateTime(user.createdAt)}
                      </Field>
                      <Field label="标签" mono full>
                        {user.tags.join(" · ") || "—"}
                      </Field>
                    </dl>
                  </div>
                  {user.id !== viewer.id && (
                    <form
                      action={moderateContentAction}
                      className="border-t border-line p-3"
                    >
                      <input type="hidden" name="targetType" value="user" />
                      <input type="hidden" name="targetId" value={user.id} />
                      <button
                        type="submit"
                        name="moderationAction"
                        value={user.status === "active" ? "suspend" : "restore"}
                        className={actionButtonCls}
                      >
                        {user.status === "active" ? "暂停账号" : "恢复账号"}
                      </button>
                    </form>
                  )}
                  </article>
                ))}
              </ItemGrid>
              <Pagination
                view="users"
                page={currentPage}
                pageCount={pageCount}
              />
            </>
          )}
        </Section>
      )}

      {activeView === "needs" && (
        <Section title={`需求 · ${allNeeds.length}`} description="查看需求状态并控制公开展示">
          {allNeeds.length === 0 ? (
            <EmptyList>暂无需求</EmptyList>
          ) : (
            <>
              <DesktopTable
                headers={[
                  "ID",
                  "类型",
                  "标题",
                  "发布者",
                  "范围",
                  "状态",
                  "标签",
                  "更新时间",
                  "操作",
                ]}
              >
                {visibleNeeds.map(({ need, author, org }) => (
                  <tr
                    key={need.id}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className={`${tdCls} font-mono`}>{need.id}</td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-[10px]`}>
                      {TYPE_LABELS[need.type]}
                    </td>
                    <td className={`${tdCls} max-w-64`}>
                      <Link
                        href={`/needs/${need.id}`}
                        className="line-clamp-2 font-semibold hover:underline"
                      >
                        {need.title}
                      </Link>
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>
                      {author.nickname}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>
                      {org?.name ?? "广场"}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-[10px] text-gray`}>
                      {need.moderationStatus === "hidden"
                        ? "已隐藏"
                        : isExpired(need)
                          ? "已过期"
                          : STATUS_LABELS[need.status]}
                    </td>
                    <td className={`${tdCls} max-w-48 font-mono text-[10px] text-gray`}>
                      <span className="line-clamp-2">
                        {need.tags.join(" · ") || "—"}
                      </span>
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-[10px] text-gray`}>
                      {shortDateTime(need.updatedAt)}
                    </td>
                    <td className={tdCls}>
                      <form action={moderateContentAction}>
                        <input type="hidden" name="targetType" value="need" />
                        <input
                          type="hidden"
                          name="targetId"
                          value={need.id}
                        />
                        <button
                          type="submit"
                          name="moderationAction"
                          value={
                            need.moderationStatus === "visible"
                              ? "hide"
                              : "restore"
                          }
                          className={tableActionButtonCls}
                        >
                          {need.moderationStatus === "visible"
                            ? "隐藏"
                            : "恢复"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </DesktopTable>

              <ItemGrid>
                {visibleNeeds.map(({ need, author, org }) => (
                  <article
                    key={need.id}
                    className="overflow-hidden rounded-md border border-line bg-panel"
                  >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono text-gray">
                          {TYPE_LABELS[need.type]} #{need.id}
                        </div>
                        <Link
                          href={`/needs/${need.id}`}
                          className="mt-1 block text-sm font-semibold hover:underline"
                        >
                          {need.title}
                        </Link>
                      </div>
                      <Status>
                        {need.moderationStatus === "hidden"
                          ? "已隐藏"
                          : isExpired(need)
                            ? "已过期"
                            : STATUS_LABELS[need.status]}
                      </Status>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                      <Field label="发布者">{author.nickname}</Field>
                      <Field label="范围">{org?.name ?? "广场"}</Field>
                      <Field label="截止时间" mono>
                        {need.expiresAt
                          ? shortDateTime(need.expiresAt)
                          : "永久"}
                      </Field>
                      <Field label="更新时间" mono>
                        {shortDateTime(need.updatedAt)}
                      </Field>
                      <Field label="标签" mono full>
                        {need.tags.join(" · ") || "—"}
                      </Field>
                    </dl>
                  </div>
                  <form
                    action={moderateContentAction}
                    className="border-t border-line p-3"
                  >
                    <input type="hidden" name="targetType" value="need" />
                    <input type="hidden" name="targetId" value={need.id} />
                    <button
                      type="submit"
                      name="moderationAction"
                      value={
                        need.moderationStatus === "visible" ? "hide" : "restore"
                      }
                      className={actionButtonCls}
                    >
                      {need.moderationStatus === "visible"
                        ? "隐藏需求"
                        : "恢复展示"}
                    </button>
                  </form>
                  </article>
                ))}
              </ItemGrid>
              <Pagination
                view="needs"
                page={currentPage}
                pageCount={pageCount}
              />
            </>
          )}
        </Section>
      )}

      {activeView === "orgs" && (
        <Section title={`组织 · ${allOrgs.length}`} description="查看组织规模与基本资料">
          {allOrgs.length === 0 ? (
            <EmptyList>暂无组织</EmptyList>
          ) : (
            <>
              <DesktopTable
                headers={[
                  "ID",
                  "名称",
                  "类型",
                  "拥有者",
                  "成员数",
                  "邀请码",
                  "创建时间",
                ]}
              >
                {visibleOrgs.map(({ org, owner }) => (
                  <tr
                    key={org.id}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className={`${tdCls} font-mono`}>{org.id}</td>
                    <td className={tdCls}>
                      <Link
                        href={`/orgs/${org.id}`}
                        className="whitespace-nowrap font-semibold hover:underline"
                      >
                        {org.name}
                      </Link>
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-[10px]`}>
                      {VISIBILITY_LABELS[org.visibility]}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>
                      {owner.nickname}
                    </td>
                    <td className={`${tdCls} font-mono`}>
                      {memberCountByOrg.get(org.id) ?? 0}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono`}>
                      {org.inviteCode}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-[10px] text-gray`}>
                      {shortDateTime(org.createdAt)}
                    </td>
                  </tr>
                ))}
              </DesktopTable>

              <ItemGrid>
                {visibleOrgs.map(({ org, owner }) => (
                  <article
                    key={org.id}
                    className="rounded-md border border-line bg-panel p-4"
                  >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-mono text-gray">
                        ORG #{org.id}
                      </div>
                      <Link
                        href={`/orgs/${org.id}`}
                        className="mt-1 block text-sm font-semibold hover:underline"
                      >
                        {org.name}
                      </Link>
                    </div>
                    <Status>{VISIBILITY_LABELS[org.visibility]}</Status>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    <Field label="拥有者">{owner.nickname}</Field>
                    <Field label="成员数" mono>
                      {memberCountByOrg.get(org.id) ?? 0}
                    </Field>
                    <Field label="邀请码" mono>
                      {org.inviteCode}
                    </Field>
                    <Field label="创建时间" mono>
                      {shortDateTime(org.createdAt)}
                    </Field>
                  </dl>
                  </article>
                ))}
              </ItemGrid>
              <Pagination
                view="orgs"
                page={currentPage}
                pageCount={pageCount}
              />
            </>
          )}
        </Section>
      )}

      {activeView === "requests" && (
        <Section
          title={`加入申请 · ${allRequests.length}`}
          description={`其中 ${pendingRequestCount} 条等待组织管理员审批`}
        >
          {allRequests.length === 0 ? (
            <EmptyList>暂无加入申请</EmptyList>
          ) : (
            <>
              <DesktopTable
                headers={[
                  "ID",
                  "组织",
                  "申请人",
                  "来源",
                  "状态",
                  "申请时间",
                  "处理时间",
                ]}
              >
                {visibleRequests.map(({ req, applicant, org }) => (
                  <tr
                    key={req.id}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className={`${tdCls} font-mono`}>{req.id}</td>
                    <td className={tdCls}>
                      <Link
                        href={`/orgs/${org.id}`}
                        className="whitespace-nowrap font-semibold hover:underline"
                      >
                        {org.name}
                      </Link>
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>
                      {applicant.nickname}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>
                      {REQUEST_VIA_LABELS[req.via]}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-[10px] text-gray`}>
                      {REQUEST_STATUS_LABELS[req.status]}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-[10px] text-gray`}>
                      {shortDateTime(req.createdAt)}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-[10px] text-gray`}>
                      {req.handledAt ? shortDateTime(req.handledAt) : "—"}
                    </td>
                  </tr>
                ))}
              </DesktopTable>

              <ItemGrid>
                {visibleRequests.map(({ req, applicant, org }) => (
                  <article
                    key={req.id}
                    className="rounded-md border border-line bg-panel p-4"
                  >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-mono text-gray">
                        REQUEST #{req.id}
                      </div>
                      <Link
                        href={`/orgs/${org.id}`}
                        className="mt-1 block text-sm font-semibold hover:underline"
                      >
                        {org.name}
                      </Link>
                    </div>
                    <Status>{REQUEST_STATUS_LABELS[req.status]}</Status>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    <Field label="申请人">{applicant.nickname}</Field>
                    <Field label="来源">{REQUEST_VIA_LABELS[req.via]}</Field>
                    <Field label="申请时间" mono>
                      {shortDateTime(req.createdAt)}
                    </Field>
                    <Field label="处理时间" mono>
                      {req.handledAt ? shortDateTime(req.handledAt) : "—"}
                    </Field>
                  </dl>
                  </article>
                ))}
              </ItemGrid>
              <Pagination
                view="requests"
                page={currentPage}
                pageCount={pageCount}
              />
            </>
          )}
        </Section>
      )}

      {activeView === "audit" && (
        <Section title="操作日志 · 最近 50 条" description="平台关键动作的审计记录">
          {recentAudit.length === 0 ? (
            <EmptyList>暂无操作日志</EmptyList>
          ) : (
            <>
              <DesktopTable
                headers={[
                  "ID",
                  "操作者",
                  "动作",
                  "对象",
                  "附加信息",
                  "时间",
                ]}
              >
                {visibleAudit.map((log) => {
                  const actor = log.actorId ? userById.get(log.actorId) : null;
                  return (
                    <tr
                      key={log.id}
                      className="border-b border-line last:border-b-0"
                    >
                      <td className={`${tdCls} font-mono`}>{log.id}</td>
                      <td className={`${tdCls} whitespace-nowrap`}>
                        {actor?.nickname ?? "系统"}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap font-mono text-[10px] font-semibold`}>
                        {log.action}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap`}>
                        {log.targetType}
                        {log.targetId ? ` #${log.targetId}` : ""}
                      </td>
                      <td className={`${tdCls} max-w-64 font-mono text-[10px] text-gray`}>
                        <span className="line-clamp-2 break-all">
                          {log.metadata
                            ? JSON.stringify(log.metadata)
                            : "—"}
                        </span>
                      </td>
                      <td className={`${tdCls} whitespace-nowrap font-mono text-[10px] text-gray`}>
                        {shortDateTime(log.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </DesktopTable>

              <div className="overflow-hidden rounded-md border border-line bg-panel md:hidden">
                {visibleAudit.map((log) => {
                  const actor = log.actorId ? userById.get(log.actorId) : null;
                  return (
                    <article
                      key={log.id}
                      className="border-b border-line p-4 last:border-b-0"
                    >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="break-all font-mono text-xs font-semibold">
                          {log.action}
                        </div>
                        <div className="mt-1 text-xs text-gray">
                          {actor?.nickname ?? "系统"} · {log.targetType}
                          {log.targetId ? ` #${log.targetId}` : ""}
                        </div>
                      </div>
                      <time className="shrink-0 font-mono text-[10px] text-gray">
                        {shortDateTime(log.createdAt)}
                      </time>
                    </div>
                    {log.metadata && (
                      <details className="mt-3 border-t border-line pt-3">
                        <summary className="cursor-pointer text-xs text-gray">
                          查看附加信息
                        </summary>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] text-gray">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                    </article>
                  );
                })}
              </div>
              <Pagination
                view="audit"
                page={currentPage}
                pageCount={pageCount}
              />
            </>
          )}
        </Section>
      )}
    </div>
  );
}
