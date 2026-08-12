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
  verificationCodes,
} from "@/lib/db/schema";
import { CODE_MAX_FAILS, getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { isExpired } from "@/lib/needs";
import { shortDateTime } from "@/lib/format";
import { CodeAutoRefresh } from "@/components/admin-code-refresh";
import {
  handleReportAction,
  moderateContentAction,
} from "@/app/actions/safety";
import { getAdminDict, getDict, getLocale } from "@/lib/i18n/server";
import { LocaleLink } from "@/lib/i18n/link";
import { localePath } from "@/lib/i18n/routing";
import { fmt } from "@/lib/i18n/fmt";
import {
  orgVisibilityLabel,
  relativeTime,
  requestViaLabel,
  statusLabel,
  typeLabel,
} from "@/lib/i18n/labels";
import type { AdminDict } from "@/lib/i18n/dict/types";

export const dynamic = "force-dynamic";

const ADMIN_VIEWS = [
  "overview",
  "reports",
  "users",
  "needs",
  "orgs",
  "requests",
  "codes",
  "audit",
] as const;

type AdminView = (typeof ADMIN_VIEWS)[number];
type SortDirection = "asc" | "desc";
type SortOption = { value: string; label: string };
type SortValue = Date | number | string | null | undefined;

function viewLabel(t: AdminDict, view: AdminView) {
  const map: Record<AdminView, string> = {
    overview: t.viewOverview,
    reports: t.viewReports,
    users: t.viewUsers,
    needs: t.viewNeeds,
    orgs: t.viewOrgs,
    requests: t.viewRequests,
    codes: t.viewCodes,
    audit: t.viewAudit,
  };
  return map[view];
}

// 未配置真实邮件通道时验证码只落在 verification_codes 表和服务端日志里，
// 这里把表内的最近记录直接摆出来，免去登服务器翻日志
const CODE_LIST_LIMIT = 100;

type CodeState = "active" | "expired" | "locked";

function codeStateLabel(t: AdminDict, state: CodeState) {
  const map: Record<CodeState, string> = {
    active: t.codeStateActive,
    expired: t.codeStateExpired,
    locked: t.codeStateLocked,
  };
  return map[state];
}

function codeState(record: {
  expiresAt: Date;
  failCount: number;
}): CodeState {
  if (record.failCount >= CODE_MAX_FAILS) return "locked";
  return record.expiresAt.getTime() > Date.now() ? "active" : "expired";
}

function requestStatusLabel(
  t: AdminDict,
  status: "pending" | "approved" | "rejected",
) {
  const map = {
    pending: t.requestStatusPending,
    approved: t.requestStatusApproved,
    rejected: t.requestStatusRejected,
  };
  return map[status];
}

function reportReasonLabel(
  t: AdminDict,
  reason: "spam" | "fraud" | "harassment" | "illegal" | "other",
) {
  const map = {
    spam: t.reportReasonSpam,
    fraud: t.reportReasonFraud,
    harassment: t.reportReasonHarassment,
    illegal: t.reportReasonIllegal,
    other: t.reportReasonOther,
  };
  return map[reason];
}

function reportStatusLabel(
  t: AdminDict,
  status: "pending" | "resolved" | "dismissed",
) {
  const map = {
    pending: t.reportStatusPending,
    resolved: t.reportStatusResolved,
    dismissed: t.reportStatusDismissed,
  };
  return map[status];
}

const actionButtonCls =
  "flex h-11 w-full items-center justify-center rounded-sm border border-ink bg-panel text-sm font-semibold tracking-[0.06em] transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px";
const tableActionButtonCls =
  "inline-flex h-5 items-center justify-center whitespace-nowrap rounded-sm border border-line bg-panel px-1.5 text-3xs font-semibold transition-colors duration-100 hover:border-ink hover:bg-bg-3 active:translate-y-px";
const thCls =
  "whitespace-nowrap px-3 py-1.5 text-left text-3xs font-semibold tracking-[0.08em] text-gray";
const tdCls = "px-3 py-1 align-middle text-xs";
const PAGE_SIZE = 20;

function matchesQuery(query: string, values: unknown[]) {
  if (!query) return true;
  const haystack = values
    .filter((value) => value !== null && value !== undefined)
    .map((value) =>
      typeof value === "object" ? JSON.stringify(value) : String(value),
    )
    .join(" ")
    .toLocaleLowerCase();
  return haystack.includes(query.toLocaleLowerCase());
}

function sortRows<T>(
  rows: T[],
  valueOf: (row: T) => SortValue,
  direction: SortDirection,
  locale: string,
) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftValue = valueOf(left);
    const rightValue = valueOf(right);
    const leftMissing = leftValue === null || leftValue === undefined;
    const rightMissing = rightValue === null || rightValue === undefined;
    if (leftMissing && rightMissing) return 0;
    if (leftMissing) return 1;
    if (rightMissing) return -1;
    const normalizedLeft =
      leftValue instanceof Date ? leftValue.getTime() : leftValue;
    const normalizedRight =
      rightValue instanceof Date ? rightValue.getTime() : rightValue;
    if (
      typeof normalizedLeft === "number" &&
      typeof normalizedRight === "number"
    ) {
      return (normalizedLeft - normalizedRight) * multiplier;
    }
    return (
      String(normalizedLeft).localeCompare(String(normalizedRight), locale, {
        numeric: true,
        sensitivity: "base",
      }) * multiplier
    );
  });
}

function adminHref(
  view: AdminView,
  {
    page = 1,
    query = "",
    sort = "",
    direction = "desc",
  }: {
    page?: number;
    query?: string;
    sort?: string;
    direction?: SortDirection;
  } = {},
) {
  const params = new URLSearchParams();
  if (view !== "overview") params.set("view", view);
  if (page > 1) params.set("page", String(page));
  if (query) params.set("q", query);
  if (sort) params.set("sort", sort);
  if (direction === "asc") params.set("dir", direction);
  const search = params.toString();
  return search ? `/admin?${search}` : "/admin";
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

function TableControls({
  t,
  action,
  view,
  query,
  sort,
  defaultSort,
  direction,
  options,
}: {
  t: AdminDict;
  action: string;
  view: AdminView;
  query: string;
  sort: string;
  defaultSort: string;
  direction: SortDirection;
  options: SortOption[];
}) {
  const controlCls =
    "h-8 rounded-sm border border-line bg-panel px-2 text-xs focus:border-ink focus:outline-none";
  const buttonCls =
    "inline-flex h-8 shrink-0 items-center rounded-sm border border-ink bg-ink px-3 text-xs font-semibold text-panel transition-opacity duration-100 hover:opacity-80 active:translate-y-px";
  const hasCustomSort = sort !== defaultSort || direction !== "desc";

  return (
    <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <form action={action} className="flex min-w-0 items-center gap-2 md:flex-1">
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={direction} />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchLabel}
          className={`${controlCls} min-w-0 flex-1 md:max-w-80`}
        />
        <button type="submit" className={buttonCls}>
          {t.searchTable}
        </button>
        {query && (
          <LocaleLink
            href={adminHref(view, { sort, direction })}
            className="shrink-0 text-xs text-gray hover:text-ink"
          >
            {t.clearSearch}
          </LocaleLink>
        )}
      </form>

      <form
        action={action}
        className="flex flex-wrap items-center gap-2 md:justify-end"
      >
        <input type="hidden" name="view" value={view} />
        {query && <input type="hidden" name="q" value={query} />}
        <select
          name="sort"
          defaultValue={sort}
          aria-label={t.sortFieldLabel}
          className={controlCls}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          name="dir"
          defaultValue={direction}
          aria-label={t.sortDirectionLabel}
          className={controlCls}
        >
          <option value="desc">{t.sortDescending}</option>
          <option value="asc">{t.sortAscending}</option>
        </select>
        <button type="submit" className={buttonCls}>
          {t.sortTable}
        </button>
        {hasCustomSort && (
          <LocaleLink
            href={adminHref(view, { query })}
            className="shrink-0 text-xs text-gray hover:text-ink"
          >
            {t.resetSort}
          </LocaleLink>
        )}
      </form>
    </div>
  );
}

function Pagination({
  t,
  view,
  page,
  pageCount,
  query,
  sort,
  direction,
}: {
  t: AdminDict;
  view: AdminView;
  page: number;
  pageCount: number;
  query: string;
  sort: string;
  direction: SortDirection;
}) {
  if (pageCount <= 1) return null;

  const linkCls =
    "flex h-9 min-w-20 items-center justify-center rounded-sm border border-line bg-panel px-3 text-xs transition-colors duration-100 hover:border-ink hover:bg-bg-3";
  const disabledCls =
    "flex h-9 min-w-20 items-center justify-center rounded-sm border border-line px-3 text-xs text-gray opacity-50";

  return (
    <nav
      aria-label={fmt(t.paginationLabel, { view: viewLabel(t, view) })}
      className="mt-4 flex items-center justify-between gap-3"
    >
      {page > 1 ? (
        <LocaleLink
          href={adminHref(view, {
            page: page - 1,
            query,
            sort,
            direction,
          })}
          className={linkCls}
        >
          {t.prevPage}
        </LocaleLink>
      ) : (
        <span className={disabledCls}>{t.prevPage}</span>
      )}
      <span className="font-mono text-2xs text-gray">
        {page} / {pageCount}
      </span>
      {page < pageCount ? (
        <LocaleLink
          href={adminHref(view, {
            page: page + 1,
            query,
            sort,
            direction,
          })}
          className={linkCls}
        >
          {t.nextPage}
        </LocaleLink>
      ) : (
        <span className={disabledCls}>{t.nextPage}</span>
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
      <dt className="text-3xs font-semibold tracking-[0.08em] text-gray">
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
    <span className="shrink-0 rounded-sm bg-bg-3 px-2 py-1 font-mono text-3xs text-gray">
      {children}
    </span>
  );
}

export default async function AdminPage({
  searchParams,
}: PageProps<"/[lang]/admin">) {
  const t = await getAdminDict();
  // 类型、状态这些跨前后台共用的词从前台字典取，两边口径保持一致
  const ui = await getDict();
  const locale = await getLocale();
  const viewer = await getSessionUser();
  if (!viewer) redirect(localePath(locale, "/login?next=/admin"));
  if (!isAdmin(viewer)) notFound();

  const rawParams = await searchParams;
  const rawView = Array.isArray(rawParams.view)
    ? rawParams.view[0]
    : rawParams.view;
  const activeView: AdminView = ADMIN_VIEWS.includes(rawView as AdminView)
    ? (rawView as AdminView)
    : "overview";
  const sortOptionsByView: Record<AdminView, SortOption[]> = {
    overview: [],
    reports: [
      { value: "submittedAt", label: t.colSubmittedAt },
      { value: "status", label: t.colStatus },
      { value: "reason", label: t.colReason },
      { value: "reporter", label: t.colReporter },
      { value: "target", label: t.colTarget },
    ],
    users: [
      { value: "registeredAt", label: t.colRegisteredAt },
      { value: "nickname", label: t.colNickname },
      { value: "email", label: t.colEmail },
      { value: "needs", label: t.colNeeds },
      { value: "orgs", label: t.colOrgs },
      { value: "status", label: t.colStatus },
    ],
    needs: [
      { value: "updatedAt", label: t.colUpdatedAt },
      { value: "title", label: t.colTitle },
      { value: "author", label: t.colAuthor },
      { value: "type", label: t.colType },
      { value: "scope", label: t.colScope },
      { value: "status", label: t.colStatus },
    ],
    orgs: [
      { value: "createdAt", label: t.colCreatedAt },
      { value: "name", label: t.colName },
      { value: "owner", label: t.colOwner },
      { value: "members", label: t.colMemberCount },
      { value: "type", label: t.colType },
    ],
    requests: [
      { value: "appliedAt", label: t.colAppliedAt },
      { value: "org", label: t.colOrgs },
      { value: "applicant", label: t.colApplicant },
      { value: "status", label: t.colStatus },
      { value: "via", label: t.colVia },
    ],
    codes: [
      { value: "requestedAt", label: t.colRequestedAt },
      { value: "email", label: t.colEmail },
      { value: "user", label: t.colUser },
      { value: "status", label: t.colStatus },
      { value: "expiresAt", label: t.colExpiresAt },
      { value: "fails", label: t.colFailCount },
    ],
    audit: [
      { value: "time", label: t.colTime },
      { value: "actor", label: t.colActor },
      { value: "action", label: t.colAction },
      { value: "target", label: t.colTarget },
    ],
  };
  const defaultSortByView: Record<AdminView, string> = {
    overview: "",
    reports: "submittedAt",
    users: "registeredAt",
    needs: "updatedAt",
    orgs: "createdAt",
    requests: "appliedAt",
    codes: "requestedAt",
    audit: "time",
  };
  const rawQuery = Array.isArray(rawParams.q)
    ? rawParams.q[0]
    : rawParams.q;
  const rawEmail = Array.isArray(rawParams.email)
    ? rawParams.email[0]
    : rawParams.email;
  const query = (rawQuery ?? (activeView === "codes" ? rawEmail : "") ?? "")
    .trim()
    .slice(0, 100);
  const rawSort = Array.isArray(rawParams.sort)
    ? rawParams.sort[0]
    : rawParams.sort;
  const sortOptions = sortOptionsByView[activeView];
  const defaultSort = defaultSortByView[activeView];
  const sort = sortOptions.some((option) => option.value === rawSort)
    ? rawSort!
    : defaultSort;
  const rawDirection = Array.isArray(rawParams.dir)
    ? rawParams.dir[0]
    : rawParams.dir;
  const direction: SortDirection = rawDirection === "asc" ? "asc" : "desc";

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
  const [allConnections, allReports, recentAudit, funnelEvents, recentCodes] =
    await Promise.all([
      db.select().from(connections).orderBy(desc(connections.updatedAt)),
      db.select().from(reports).orderBy(desc(reports.createdAt)),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50),
      db.select({ name: analyticsEvents.name }).from(analyticsEvents),
      db
        .select()
        .from(verificationCodes)
        .orderBy(desc(verificationCodes.createdAt))
        .limit(CODE_LIST_LIMIT),
    ]);

  const userById = new Map(allUsers.map((user) => [user.id, user]));
  const userByEmail = new Map(allUsers.map((user) => [user.loginEmail, user]));
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
    { label: t.statUsers, value: allUsers.length },
    { label: t.statNeeds, value: allNeeds.length },
    { label: t.statOrgs, value: allOrgs.length },
    { label: t.statPendingRequests, value: pendingRequestCount },
    { label: t.statActiveSessions, value: activeSessions?.n ?? 0 },
    { label: t.statCompletedConnections, value: completedConnectionCount },
    { label: t.statPendingReports, value: pendingReportCount },
  ];
  const funnel = [
    [t.funnelPublished, "need_created"],
    [t.funnelRequested, "connection_requested"],
    [t.funnelAccepted, "connection_accepted"],
    [t.funnelCompleted, "connection_completed"],
  ].map(([label, name]) => ({
    label,
    value: funnelEvents.filter((event) => event.name === name).length,
  }));
  const activeCodeCount = recentCodes.filter(
    (record) => codeState(record) === "active",
  ).length;
  const userDisplayStatus = (user: (typeof allUsers)[number]) =>
    user.id === viewer.id
      ? t.userStatusAdmin
      : user.status === "active"
        ? t.userStatusActive
        : user.status === "deleted"
          ? t.userStatusDeleted
          : t.userStatusSuspended;
  const needDisplayStatus = (need: (typeof allNeeds)[number]["need"]) =>
    need.moderationStatus === "hidden"
      ? t.needHidden
      : isExpired(need)
        ? t.needExpired
        : statusLabel(ui, need.status);
  const filteredReports = sortRows(
    allReports.filter((report) => {
      const reporter = report.reporterId
        ? userById.get(report.reporterId)
        : null;
      return matchesQuery(query, [
        report.id,
        report.targetType,
        report.targetId,
        report.reason,
        reportReasonLabel(t, report.reason),
        reporter?.nickname,
        reporter?.loginEmail,
        report.details,
        report.status,
        reportStatusLabel(t, report.status),
      ]);
    }),
    (report) => {
      switch (sort) {
        case "status":
          return reportStatusLabel(t, report.status);
        case "reason":
          return reportReasonLabel(t, report.reason);
        case "reporter":
          return report.reporterId
            ? userById.get(report.reporterId)?.nickname
            : t.reportAnonymous;
        case "target":
          return `${report.targetType}-${report.targetId}`;
        default:
          return report.createdAt;
      }
    },
    direction,
    locale,
  );
  const filteredUsers = sortRows(
    allUsers.filter((user) =>
      matchesQuery(query, [
        user.id,
        user.nickname,
        user.loginEmail,
        user.city,
        user.tags,
        user.status,
        userDisplayStatus(user),
      ]),
    ),
    (user) => {
      switch (sort) {
        case "nickname":
          return user.nickname;
        case "email":
          return user.loginEmail;
        case "needs":
          return needCountByUser.get(user.id) ?? 0;
        case "orgs":
          return orgCountByUser.get(user.id) ?? 0;
        case "status":
          return userDisplayStatus(user);
        default:
          return user.createdAt;
      }
    },
    direction,
    locale,
  );
  const filteredNeeds = sortRows(
    allNeeds.filter(({ need, author, org }) =>
      matchesQuery(query, [
        need.id,
        need.type,
        typeLabel(ui, need.type),
        need.title,
        need.description,
        author.nickname,
        author.loginEmail,
        org?.name ?? t.needScopePlaza,
        need.status,
        need.moderationStatus,
        needDisplayStatus(need),
        need.tags,
      ]),
    ),
    ({ need, author, org }) => {
      switch (sort) {
        case "title":
          return need.title;
        case "author":
          return author.nickname;
        case "type":
          return typeLabel(ui, need.type);
        case "scope":
          return org?.name ?? t.needScopePlaza;
        case "status":
          return needDisplayStatus(need);
        default:
          return need.updatedAt;
      }
    },
    direction,
    locale,
  );
  const filteredOrgs = sortRows(
    allOrgs.filter(({ org, owner }) =>
      matchesQuery(query, [
        org.id,
        org.name,
        org.description,
        org.visibility,
        orgVisibilityLabel(ui, org.visibility),
        owner.nickname,
        owner.loginEmail,
        org.inviteCode,
      ]),
    ),
    ({ org, owner }) => {
      switch (sort) {
        case "name":
          return org.name;
        case "owner":
          return owner.nickname;
        case "members":
          return memberCountByOrg.get(org.id) ?? 0;
        case "type":
          return orgVisibilityLabel(ui, org.visibility);
        default:
          return org.createdAt;
      }
    },
    direction,
    locale,
  );
  const filteredRequests = sortRows(
    allRequests.filter(({ req, applicant, org }) =>
      matchesQuery(query, [
        req.id,
        org.name,
        applicant.nickname,
        applicant.loginEmail,
        req.via,
        requestViaLabel(ui, req.via),
        req.status,
        requestStatusLabel(t, req.status),
      ]),
    ),
    ({ req, applicant, org }) => {
      switch (sort) {
        case "org":
          return org.name;
        case "applicant":
          return applicant.nickname;
        case "status":
          return requestStatusLabel(t, req.status);
        case "via":
          return requestViaLabel(ui, req.via);
        default:
          return req.createdAt;
      }
    },
    direction,
    locale,
  );
  const filteredCodes = sortRows(
    recentCodes.filter((record) => {
      const state = codeState(record);
      const owner = userByEmail.get(record.email);
      return matchesQuery(query, [
        record.id,
        record.email,
        owner?.nickname,
        record.code,
        state,
        codeStateLabel(t, state),
        record.ip,
        record.failCount,
      ]);
    }),
    (record) => {
      const owner = userByEmail.get(record.email);
      switch (sort) {
        case "email":
          return record.email;
        case "user":
          return owner?.nickname ?? t.codeUnregistered;
        case "status":
          return codeStateLabel(t, codeState(record));
        case "expiresAt":
          return record.expiresAt;
        case "fails":
          return record.failCount;
        default:
          return record.createdAt;
      }
    },
    direction,
    locale,
  );
  const filteredAudit = sortRows(
    recentAudit.filter((log) => {
      const actor = log.actorId ? userById.get(log.actorId) : null;
      return matchesQuery(query, [
        log.id,
        actor?.nickname ?? t.auditSystem,
        actor?.loginEmail,
        log.action,
        log.targetType,
        log.targetId,
        log.metadata,
      ]);
    }),
    (log) => {
      const actor = log.actorId ? userById.get(log.actorId) : null;
      switch (sort) {
        case "actor":
          return actor?.nickname ?? t.auditSystem;
        case "action":
          return log.action;
        case "target":
          return `${log.targetType}-${log.targetId ?? ""}`;
        default:
          return log.createdAt;
      }
    },
    direction,
    locale,
  );
  const filteredPendingReportCount = filteredReports.filter(
    (report) => report.status === "pending",
  ).length;
  const filteredPendingRequestCount = filteredRequests.filter(
    ({ req }) => req.status === "pending",
  ).length;
  const filteredActiveCodeCount = filteredCodes.filter(
    (record) => codeState(record) === "active",
  ).length;
  const viewCounts: Partial<Record<AdminView, number>> = {
    reports: pendingReportCount,
    users: allUsers.length,
    needs: allNeeds.length,
    orgs: allOrgs.length,
    requests: pendingRequestCount,
    codes: activeCodeCount,
    audit: recentAudit.length,
  };
  const itemCountByView: Record<AdminView, number> = {
    overview: 0,
    reports: filteredReports.length,
    users: filteredUsers.length,
    needs: filteredNeeds.length,
    orgs: filteredOrgs.length,
    requests: filteredRequests.length,
    codes: filteredCodes.length,
    audit: filteredAudit.length,
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
  const visibleReports = filteredReports.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  );
  const visibleUsers = filteredUsers.slice(pageStart, pageStart + PAGE_SIZE);
  const visibleNeeds = filteredNeeds.slice(pageStart, pageStart + PAGE_SIZE);
  const visibleOrgs = filteredOrgs.slice(pageStart, pageStart + PAGE_SIZE);
  const visibleRequests = filteredRequests.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  );
  const visibleCodes = filteredCodes.slice(pageStart, pageStart + PAGE_SIZE);
  const visibleAudit = filteredAudit.slice(pageStart, pageStart + PAGE_SIZE);
  const rowNumber = (index: number) => pageStart + index + 1;

  return (
    <div>
      <h1 className="sr-only">{t.title}</h1>

      <nav
        aria-label={t.moduleNav}
        className="sticky top-0 z-10 -mx-4 border-b border-line bg-bg px-4 py-2 md:-mx-8 md:px-8"
      >
        <div className="grid grid-cols-4 gap-2 md:flex md:w-max">
          {ADMIN_VIEWS.map((view) => {
            const active = view === activeView;
            return (
              <LocaleLink
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
                {viewLabel(t, view)}
                {viewCounts[view] !== undefined && (
                  <span className="font-mono text-3xs">
                    {viewCounts[view]}
                  </span>
                )}
              </LocaleLink>
            );
          })}
        </div>
      </nav>

      {activeView === "overview" && (
        <>
          <Section title={t.overviewStatsTitle} description={t.overviewStatsDesc}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-md border border-line bg-panel px-4 py-3"
                >
                  <div className="text-2xs text-gray">{stat.label}</div>
                  <div className="mt-1 font-mono text-xl font-semibold">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title={t.overviewFunnelTitle} description={t.overviewFunnelDesc}>
            <div className="grid grid-cols-2 overflow-hidden rounded-md border border-line bg-line gap-px sm:grid-cols-4">
              {funnel.map((item) => (
                <div key={item.label} className="bg-panel p-4">
                  <div className="text-2xs text-gray">{item.label}</div>
                  <div className="mt-1 font-mono text-xl font-semibold">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title={t.overviewModulesTitle} description={t.overviewModulesDesc}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ADMIN_VIEWS.filter((view) => view !== "overview").map((view) => (
                <LocaleLink
                  key={view}
                  href={adminHref(view)}
                  className="rounded-md border border-line bg-panel p-4 transition-colors duration-100 hover:border-ink hover:bg-bg-3"
                >
                  <div className="text-sm font-semibold">
                    {viewLabel(t, view)}
                  </div>
                  <div className="mt-2 font-mono text-lg">
                    {viewCounts[view] ?? 0}
                  </div>
                </LocaleLink>
              ))}
            </div>
          </Section>
        </>
      )}

      {activeView === "reports" && (
        <Section
          title={fmt(t.reportsTitle, { n: filteredReports.length })}
          description={fmt(t.reportsDesc, {
            n: filteredPendingReportCount,
          })}
        >
          <TableControls
            t={t}
            action={localePath(locale, "/admin")}
            view="reports"
            query={query}
            sort={sort}
            defaultSort={defaultSort}
            direction={direction}
            options={sortOptions}
          />
          {filteredReports.length === 0 ? (
            <EmptyList>{query ? t.noMatchingRows : t.reportsEmpty}</EmptyList>
          ) : (
            <>
              <DesktopTable
                headers={[
                  t.colNumber,
                  t.colId,
                  t.colTarget,
                  t.colReason,
                  t.colReporter,
                  t.colDetails,
                  t.colStatus,
                  t.colSubmittedAt,
                  t.colActions,
                ]}
              >
                {visibleReports.map((report, index) => {
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
                      <td className={`${tdCls} font-mono text-3xs text-gray`}>
                        {rowNumber(index)}
                      </td>
                      <td className={`${tdCls} font-mono`}>{report.id}</td>
                      <td className={tdCls}>
                        <LocaleLink
                          href={targetHref}
                          className="whitespace-nowrap font-semibold hover:underline"
                        >
                          {report.targetType === "need" ? t.targetNeed : t.targetUser} #
                          {report.targetId}
                        </LocaleLink>
                      </td>
                      <td className={`${tdCls} whitespace-nowrap`}>
                        {reportReasonLabel(t, report.reason)}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap`}>
                        {reporter?.nickname ?? t.reportAnonymous}
                      </td>
                      <td className={`${tdCls} max-w-48`}>
                        <span className="line-clamp-2">
                          {report.details ?? "—"}
                        </span>
                      </td>
                      <td className={`${tdCls} whitespace-nowrap font-mono text-3xs text-gray`}>
                        {reportStatusLabel(t, report.status)}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap font-mono text-3xs text-gray`}>
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
                              {t.reportDismiss}
                            </button>
                            <button
                              type="submit"
                              name="decision"
                              value="resolved"
                              className={tableActionButtonCls}
                            >
                              {t.reportResolve}
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
                {visibleReports.map((report, index) => {
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
                          <div className="text-3xs font-mono text-gray">
                            {t.colNumber} {rowNumber(index)} · REPORT #{report.id}
                          </div>
                          <LocaleLink
                            href={targetHref}
                            className="mt-1 block text-sm font-semibold hover:underline"
                          >
                            {report.targetType === "need" ? t.targetNeed : t.targetUser} #
                            {report.targetId}
                          </LocaleLink>
                        </div>
                        <Status>{reportStatusLabel(t, report.status)}</Status>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                        <Field label={t.colReason}>
                          {reportReasonLabel(t, report.reason)}
                        </Field>
                        <Field label={t.colReporter}>{reporter?.nickname ?? t.reportAnonymous}</Field>
                        <Field label={t.colSubmittedAt} mono full>
                          {shortDateTime(report.createdAt)}
                        </Field>
                        {report.details && (
                          <Field label={t.colDetails} full>
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
                          {t.reportDismiss}
                        </button>
                        <button
                          type="submit"
                          name="decision"
                          value="resolved"
                          className={actionButtonCls}
                        >
                          {t.reportResolveLong}
                        </button>
                      </form>
                    )}
                    </article>
                  );
                })}
              </ItemGrid>
              <Pagination
                t={t}
                view="reports"
                page={currentPage}
                pageCount={pageCount}
                query={query}
                sort={sort}
                direction={direction}
              />
            </>
          )}
        </Section>
      )}

      {activeView === "users" && (
        <Section
          title={fmt(t.usersTitle, { n: filteredUsers.length })}
          description={t.usersDesc}
        >
          <TableControls
            t={t}
            action={localePath(locale, "/admin")}
            view="users"
            query={query}
            sort={sort}
            defaultSort={defaultSort}
            direction={direction}
            options={sortOptions}
          />
          {filteredUsers.length === 0 ? (
            <EmptyList>{query ? t.noMatchingRows : t.usersEmpty}</EmptyList>
          ) : (
            <>
              <DesktopTable
                headers={[
                  t.colNumber,
                  t.colId,
                  t.colNickname,
                  t.colEmail,
                  t.colCity,
                  t.colTags,
                  t.colNeeds,
                  t.colOrgs,
                  t.colStatus,
                  t.colRegisteredAt,
                  t.colActions,
                ]}
              >
                {visibleUsers.map((user, index) => (
                  <tr
                    key={user.id}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className={`${tdCls} font-mono text-3xs text-gray`}>
                      {rowNumber(index)}
                    </td>
                    <td className={`${tdCls} font-mono`}>{user.id}</td>
                    <td className={tdCls}>
                      <LocaleLink
                        href={`/u/${user.id}`}
                        className="whitespace-nowrap font-semibold hover:underline"
                      >
                        {user.nickname}
                      </LocaleLink>
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono`}>
                      {user.loginEmail}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>
                      {user.city ?? "—"}
                    </td>
                    <td className={`${tdCls} max-w-48 font-mono text-3xs text-gray`}>
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
                    <td className={`${tdCls} whitespace-nowrap font-mono text-3xs text-gray`}>
                      {user.id === viewer.id
                        ? t.userStatusAdmin
                        : user.status === "active"
                          ? t.userStatusActive
                          : user.status === "deleted"
                            ? t.userStatusDeleted
                            : t.userStatusSuspended}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-3xs text-gray`}>
                      {shortDateTime(user.createdAt)}
                    </td>
                    <td className={tdCls}>
                      {user.id !== viewer.id && user.status !== "deleted" ? (
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
                            {user.status === "active" ? t.userSuspend : t.userRestore}
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
                {visibleUsers.map((user, index) => (
                  <article
                    key={user.id}
                    className="overflow-hidden rounded-md border border-line bg-panel"
                  >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-3xs font-mono text-gray">
                          {t.colNumber} {rowNumber(index)} · USER #{user.id}
                        </div>
                        <LocaleLink
                          href={`/u/${user.id}`}
                          className="mt-1 block truncate text-sm font-semibold hover:underline"
                        >
                          {user.nickname}
                        </LocaleLink>
                      </div>
                      <Status>
                        {user.id === viewer.id
                          ? t.userStatusAdmin
                          : user.status === "active"
                            ? t.userStatusActive
                            : user.status === "deleted"
                              ? t.userStatusDeleted
                              : t.userStatusSuspended}
                      </Status>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                      <Field label={t.colEmail} mono>
                        {user.loginEmail}
                      </Field>
                      <Field label={t.colCity}>{user.city ?? "—"}</Field>
                      <Field label={t.colNeedsOrgs} mono>
                        {needCountByUser.get(user.id) ?? 0} /{" "}
                        {orgCountByUser.get(user.id) ?? 0}
                      </Field>
                      <Field label={t.colRegisteredAt} mono>
                        {shortDateTime(user.createdAt)}
                      </Field>
                      <Field label={t.colTags} mono full>
                        {user.tags.join(" · ") || "—"}
                      </Field>
                    </dl>
                  </div>
                  {user.id !== viewer.id && user.status !== "deleted" && (
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
                        {user.status === "active" ? t.userSuspendLong : t.userRestoreLong}
                      </button>
                    </form>
                  )}
                  </article>
                ))}
              </ItemGrid>
              <Pagination
                t={t}
                view="users"
                page={currentPage}
                pageCount={pageCount}
                query={query}
                sort={sort}
                direction={direction}
              />
            </>
          )}
        </Section>
      )}

      {activeView === "needs" && (
        <Section
          title={fmt(t.needsTitle, { n: filteredNeeds.length })}
          description={t.needsDesc}
        >
          <TableControls
            t={t}
            action={localePath(locale, "/admin")}
            view="needs"
            query={query}
            sort={sort}
            defaultSort={defaultSort}
            direction={direction}
            options={sortOptions}
          />
          {filteredNeeds.length === 0 ? (
            <EmptyList>{query ? t.noMatchingRows : t.needsEmpty}</EmptyList>
          ) : (
            <>
              <DesktopTable
                headers={[
                  t.colNumber,
                  t.colId,
                  t.colType,
                  t.colTitle,
                  t.colAuthor,
                  t.colScope,
                  t.colStatus,
                  t.colTags,
                  t.colUpdatedAt,
                  t.colActions,
                ]}
              >
                {visibleNeeds.map(({ need, author, org }, index) => (
                  <tr
                    key={need.id}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className={`${tdCls} font-mono text-3xs text-gray`}>
                      {rowNumber(index)}
                    </td>
                    <td className={`${tdCls} font-mono`}>{need.id}</td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-3xs`}>
                      {typeLabel(ui, need.type)}
                    </td>
                    <td className={`${tdCls} max-w-64`}>
                      <LocaleLink
                        href={`/needs/${need.id}`}
                        className="line-clamp-2 font-semibold hover:underline"
                      >
                        {need.title}
                      </LocaleLink>
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>
                      {author.nickname}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>
                      {org?.name ?? t.needScopePlaza}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-3xs text-gray`}>
                      {need.moderationStatus === "hidden"
                        ? t.needHidden
                        : isExpired(need)
                          ? t.needExpired
                          : statusLabel(ui, need.status)}
                    </td>
                    <td className={`${tdCls} max-w-48 font-mono text-3xs text-gray`}>
                      <span className="line-clamp-2">
                        {need.tags.join(" · ") || "—"}
                      </span>
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-3xs text-gray`}>
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
                            ? t.needHide
                            : t.needRestore}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </DesktopTable>

              <ItemGrid>
                {visibleNeeds.map(({ need, author, org }, index) => (
                  <article
                    key={need.id}
                    className="overflow-hidden rounded-md border border-line bg-panel"
                  >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-3xs font-mono text-gray">
                          {t.colNumber} {rowNumber(index)} · {typeLabel(ui, need.type)} #{need.id}
                        </div>
                        <LocaleLink
                          href={`/needs/${need.id}`}
                          className="mt-1 block text-sm font-semibold hover:underline"
                        >
                          {need.title}
                        </LocaleLink>
                      </div>
                      <Status>
                        {need.moderationStatus === "hidden"
                          ? t.needHidden
                          : isExpired(need)
                            ? t.needExpired
                            : statusLabel(ui, need.status)}
                      </Status>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                      <Field label={t.colAuthor}>{author.nickname}</Field>
                      <Field label={t.colScope}>{org?.name ?? t.needScopePlaza}</Field>
                      <Field label={t.colDeadline} mono>
                        {need.expiresAt
                          ? shortDateTime(need.expiresAt)
                          : t.needPermanent}
                      </Field>
                      <Field label={t.colUpdatedAt} mono>
                        {shortDateTime(need.updatedAt)}
                      </Field>
                      <Field label={t.colTags} mono full>
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
                        ? t.needHideLong
                        : t.needRestoreLong}
                    </button>
                  </form>
                  </article>
                ))}
              </ItemGrid>
              <Pagination
                t={t}
                view="needs"
                page={currentPage}
                pageCount={pageCount}
                query={query}
                sort={sort}
                direction={direction}
              />
            </>
          )}
        </Section>
      )}

      {activeView === "orgs" && (
        <Section
          title={fmt(t.orgsTitle, { n: filteredOrgs.length })}
          description={t.orgsDesc}
        >
          <TableControls
            t={t}
            action={localePath(locale, "/admin")}
            view="orgs"
            query={query}
            sort={sort}
            defaultSort={defaultSort}
            direction={direction}
            options={sortOptions}
          />
          {filteredOrgs.length === 0 ? (
            <EmptyList>{query ? t.noMatchingRows : t.orgsEmpty}</EmptyList>
          ) : (
            <>
              <DesktopTable
                headers={[
                  t.colNumber,
                  t.colId,
                  t.colName,
                  t.colType,
                  t.colOwner,
                  t.colMemberCount,
                  t.colInviteCode,
                  t.colCreatedAt,
                ]}
              >
                {visibleOrgs.map(({ org, owner }, index) => (
                  <tr
                    key={org.id}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className={`${tdCls} font-mono text-3xs text-gray`}>
                      {rowNumber(index)}
                    </td>
                    <td className={`${tdCls} font-mono`}>{org.id}</td>
                    <td className={tdCls}>
                      <LocaleLink
                        href={`/orgs/${org.id}`}
                        className="whitespace-nowrap font-semibold hover:underline"
                      >
                        {org.name}
                      </LocaleLink>
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-3xs`}>
                      {orgVisibilityLabel(ui, org.visibility)}
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
                    <td className={`${tdCls} whitespace-nowrap font-mono text-3xs text-gray`}>
                      {shortDateTime(org.createdAt)}
                    </td>
                  </tr>
                ))}
              </DesktopTable>

              <ItemGrid>
                {visibleOrgs.map(({ org, owner }, index) => (
                  <article
                    key={org.id}
                    className="rounded-md border border-line bg-panel p-4"
                  >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-3xs font-mono text-gray">
                        {t.colNumber} {rowNumber(index)} · ORG #{org.id}
                      </div>
                      <LocaleLink
                        href={`/orgs/${org.id}`}
                        className="mt-1 block text-sm font-semibold hover:underline"
                      >
                        {org.name}
                      </LocaleLink>
                    </div>
                    <Status>{orgVisibilityLabel(ui, org.visibility)}</Status>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    <Field label={t.colOwner}>{owner.nickname}</Field>
                    <Field label={t.colMemberCount} mono>
                      {memberCountByOrg.get(org.id) ?? 0}
                    </Field>
                    <Field label={t.colInviteCode} mono>
                      {org.inviteCode}
                    </Field>
                    <Field label={t.colCreatedAt} mono>
                      {shortDateTime(org.createdAt)}
                    </Field>
                  </dl>
                  </article>
                ))}
              </ItemGrid>
              <Pagination
                t={t}
                view="orgs"
                page={currentPage}
                pageCount={pageCount}
                query={query}
                sort={sort}
                direction={direction}
              />
            </>
          )}
        </Section>
      )}

      {activeView === "requests" && (
        <Section
          title={fmt(t.requestsTitle, { n: filteredRequests.length })}
          description={fmt(t.requestsDesc, {
            n: filteredPendingRequestCount,
          })}
        >
          <TableControls
            t={t}
            action={localePath(locale, "/admin")}
            view="requests"
            query={query}
            sort={sort}
            defaultSort={defaultSort}
            direction={direction}
            options={sortOptions}
          />
          {filteredRequests.length === 0 ? (
            <EmptyList>{query ? t.noMatchingRows : t.requestsEmpty}</EmptyList>
          ) : (
            <>
              <DesktopTable
                headers={[
                  t.colNumber,
                  t.colId,
                  t.colOrgs,
                  t.colApplicant,
                  t.colVia,
                  t.colStatus,
                  t.colAppliedAt,
                  t.colHandledAt,
                ]}
              >
                {visibleRequests.map(({ req, applicant, org }, index) => (
                  <tr
                    key={req.id}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className={`${tdCls} font-mono text-3xs text-gray`}>
                      {rowNumber(index)}
                    </td>
                    <td className={`${tdCls} font-mono`}>{req.id}</td>
                    <td className={tdCls}>
                      <LocaleLink
                        href={`/orgs/${org.id}`}
                        className="whitespace-nowrap font-semibold hover:underline"
                      >
                        {org.name}
                      </LocaleLink>
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>
                      {applicant.nickname}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>
                      {requestViaLabel(ui, req.via)}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-3xs text-gray`}>
                      {requestStatusLabel(t, req.status)}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-3xs text-gray`}>
                      {shortDateTime(req.createdAt)}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap font-mono text-3xs text-gray`}>
                      {req.handledAt ? shortDateTime(req.handledAt) : "—"}
                    </td>
                  </tr>
                ))}
              </DesktopTable>

              <ItemGrid>
                {visibleRequests.map(({ req, applicant, org }, index) => (
                  <article
                    key={req.id}
                    className="rounded-md border border-line bg-panel p-4"
                  >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-3xs font-mono text-gray">
                        {t.colNumber} {rowNumber(index)} · REQUEST #{req.id}
                      </div>
                      <LocaleLink
                        href={`/orgs/${org.id}`}
                        className="mt-1 block text-sm font-semibold hover:underline"
                      >
                        {org.name}
                      </LocaleLink>
                    </div>
                    <Status>{requestStatusLabel(t, req.status)}</Status>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    <Field label={t.colApplicant}>{applicant.nickname}</Field>
                    <Field label={t.colVia}>{requestViaLabel(ui, req.via)}</Field>
                    <Field label={t.colAppliedAt} mono>
                      {shortDateTime(req.createdAt)}
                    </Field>
                    <Field label={t.colHandledAt} mono>
                      {req.handledAt ? shortDateTime(req.handledAt) : "—"}
                    </Field>
                  </dl>
                  </article>
                ))}
              </ItemGrid>
              <Pagination
                t={t}
                view="requests"
                page={currentPage}
                pageCount={pageCount}
                query={query}
                sort={sort}
                direction={direction}
              />
            </>
          )}
        </Section>
      )}

      {activeView === "codes" && (
        <Section
          title={fmt(t.codesTitle, { n: filteredCodes.length })}
          description={`${fmt(t.codesDescRecent, {
            n: CODE_LIST_LIMIT,
          })}${fmt(t.codesDescSuffix, { n: filteredActiveCodeCount })}`}
        >
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <TableControls
                t={t}
                action={localePath(locale, "/admin")}
                view="codes"
                query={query}
                sort={sort}
                defaultSort={defaultSort}
                direction={direction}
                options={sortOptions}
              />
            </div>
            <CodeAutoRefresh />
          </div>

          {filteredCodes.length === 0 ? (
            <EmptyList>{query ? t.noMatchingRows : t.codesEmpty}</EmptyList>
          ) : (
            <>
              <DesktopTable
                headers={[
                  t.colNumber,
                  t.colEmail,
                  t.colUser,
                  t.colCode,
                  t.colStatus,
                  t.colExpiresAt,
                  t.colFails,
                  "IP",
                  t.colRequestedAt,
                ]}
              >
                {visibleCodes.map((record, index) => {
                  const state = codeState(record);
                  const owner = userByEmail.get(record.email);
                  return (
                    <tr
                      key={record.id}
                      className="border-b border-line last:border-b-0"
                    >
                      <td className={`${tdCls} font-mono text-3xs text-gray`}>
                        {rowNumber(index)}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap font-mono`}>
                        {record.email}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap`}>
                        {owner ? (
                          <LocaleLink
                            href={`/u/${owner.id}`}
                            className="font-semibold hover:underline"
                          >
                            {owner.nickname}
                          </LocaleLink>
                        ) : (
                          <span className="text-gray">{t.codeUnregistered}</span>
                        )}
                      </td>
                      <td className={tdCls}>
                        <span
                          className={`font-mono text-sm font-semibold tracking-[0.12em] ${
                            state === "active" ? "" : "text-gray line-through"
                          }`}
                        >
                          {record.code}
                        </span>
                      </td>
                      <td className={`${tdCls} whitespace-nowrap font-mono text-3xs text-gray`}>
                        {codeStateLabel(t, state)}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap font-mono text-3xs text-gray`}>
                        {shortDateTime(record.expiresAt)}
                      </td>
                      <td className={`${tdCls} font-mono`}>
                        {record.failCount}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap font-mono text-3xs text-gray`}>
                        {record.ip}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap font-mono text-3xs text-gray`}>
                        {relativeTime(ui, record.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </DesktopTable>

              <ItemGrid>
                {visibleCodes.map((record, index) => {
                  const state = codeState(record);
                  const owner = userByEmail.get(record.email);
                  return (
                    <article
                      key={record.id}
                      className="rounded-md border border-line bg-panel p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-3xs font-mono text-gray">
                            {t.colNumber} {rowNumber(index)}
                          </div>
                          <div className="font-mono text-sm font-semibold">
                            {record.email}
                          </div>
                          <div className="mt-1 text-xs text-gray">
                            {owner ? owner.nickname : t.codeUnregistered} ·{" "}
                            {relativeTime(ui, record.createdAt)}
                          </div>
                        </div>
                        <Status>{codeStateLabel(t, state)}</Status>
                      </div>
                      <div
                        className={`mt-3 font-mono text-2xl font-semibold tracking-[0.2em] ${
                          state === "active" ? "" : "text-gray line-through"
                        }`}
                      >
                        {record.code}
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                        <Field label={t.colExpiresAt} mono>
                          {shortDateTime(record.expiresAt)}
                        </Field>
                        <Field label={t.colFailCount} mono>
                          {record.failCount}
                        </Field>
                        <Field label="IP" mono full>
                          {record.ip}
                        </Field>
                      </dl>
                    </article>
                  );
                })}
              </ItemGrid>
              <Pagination
                t={t}
                view="codes"
                page={currentPage}
                pageCount={pageCount}
                query={query}
                sort={sort}
                direction={direction}
              />
            </>
          )}
        </Section>
      )}

      {activeView === "audit" && (
        <Section
          title={fmt(t.auditTitle, { n: filteredAudit.length })}
          description={t.auditDesc}
        >
          <TableControls
            t={t}
            action={localePath(locale, "/admin")}
            view="audit"
            query={query}
            sort={sort}
            defaultSort={defaultSort}
            direction={direction}
            options={sortOptions}
          />
          {filteredAudit.length === 0 ? (
            <EmptyList>{query ? t.noMatchingRows : t.auditEmpty}</EmptyList>
          ) : (
            <>
              <DesktopTable
                headers={[
                  t.colNumber,
                  t.colId,
                  t.colActor,
                  t.colAction,
                  t.colTarget,
                  t.colMetadata,
                  t.colTime,
                ]}
              >
                {visibleAudit.map((log, index) => {
                  const actor = log.actorId ? userById.get(log.actorId) : null;
                  return (
                    <tr
                      key={log.id}
                      className="border-b border-line last:border-b-0"
                    >
                      <td className={`${tdCls} font-mono text-3xs text-gray`}>
                        {rowNumber(index)}
                      </td>
                      <td className={`${tdCls} font-mono`}>{log.id}</td>
                      <td className={`${tdCls} whitespace-nowrap`}>
                        {actor?.nickname ?? t.auditSystem}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap font-mono text-3xs font-semibold`}>
                        {log.action}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap`}>
                        {log.targetType}
                        {log.targetId ? ` #${log.targetId}` : ""}
                      </td>
                      <td className={`${tdCls} max-w-64 font-mono text-3xs text-gray`}>
                        <span className="line-clamp-2 break-all">
                          {log.metadata
                            ? JSON.stringify(log.metadata)
                            : "—"}
                        </span>
                      </td>
                      <td className={`${tdCls} whitespace-nowrap font-mono text-3xs text-gray`}>
                        {shortDateTime(log.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </DesktopTable>

              <div className="overflow-hidden rounded-md border border-line bg-panel md:hidden">
                {visibleAudit.map((log, index) => {
                  const actor = log.actorId ? userById.get(log.actorId) : null;
                  return (
                    <article
                      key={log.id}
                      className="border-b border-line p-4 last:border-b-0"
                    >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-3xs font-mono text-gray">
                          {t.colNumber} {rowNumber(index)}
                        </div>
                        <div className="break-all font-mono text-xs font-semibold">
                          {log.action}
                        </div>
                        <div className="mt-1 text-xs text-gray">
                          {actor?.nickname ?? t.auditSystem} · {log.targetType}
                          {log.targetId ? ` #${log.targetId}` : ""}
                        </div>
                      </div>
                      <time className="shrink-0 font-mono text-3xs text-gray">
                        {shortDateTime(log.createdAt)}
                      </time>
                    </div>
                    {log.metadata && (
                      <details className="mt-3 border-t border-line pt-3">
                        <summary className="cursor-pointer text-xs text-gray">
                          {t.auditViewMetadata}
                        </summary>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-3xs text-gray">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                    </article>
                  );
                })}
              </div>
              <Pagination
                t={t}
                view="audit"
                page={currentPage}
                pageCount={pageCount}
                query={query}
                sort={sort}
                direction={direction}
              />
            </>
          )}
        </Section>
      )}
    </div>
  );
}
