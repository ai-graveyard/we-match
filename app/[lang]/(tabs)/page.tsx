import { Plus, Search, X } from "lucide-react";
import { and, desc, eq, gt, notInArray, or, sql, type SQL } from "drizzle-orm";
import { isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { blocks, needs, orgs, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getUserOrgs } from "@/lib/queries";
import { normalizeInviteCode } from "@/lib/orgs";
import { NeedCard } from "@/components/need-card";
import { EmptyState, ListEnd } from "@/components/list-states";
import { BrandFooter } from "@/components/brand-footer";
import { getDict, getLocale } from "@/lib/i18n/server";
import { LocaleLink } from "@/lib/i18n/link";
import { localePath } from "@/lib/i18n/routing";
import { fmt } from "@/lib/i18n/fmt";
import { typeLabel, typeShort } from "@/lib/i18n/labels";

export const dynamic = "force-dynamic";

function buildQuery(params: {
  org?: string;
  type?: string;
  q?: string;
  tag?: string;
  all?: string;
}) {
  const qs = new URLSearchParams();
  if (params.org) qs.set("org", params.org);
  if (params.type) qs.set("type", params.type);
  if (params.q) qs.set("q", params.q);
  if (params.tag) qs.set("tag", params.tag);
  if (params.all) qs.set("all", params.all);
  const s = qs.toString();
  return s ? `/?${s}` : "/";
}

export default async function PlazaPage({
  searchParams,
}: PageProps<"/[lang]">) {
  const t = await getDict();
  const locale = await getLocale();
  const raw = await searchParams;
  const pick = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const type = pick(raw.type);
  const q = pick(raw.q)?.trim();
  const tag = pick(raw.tag)?.trim();
  const showAll = pick(raw.all) === "1";
  const inviteCode = pick(raw.code)?.trim();

  const viewer = await getSessionUser();
  const myOrgs = viewer ? await getUserOrgs(viewer.id) : [];

  // 范围：广场（默认）或某个已加入的组织；非成员的组织参数直接忽略
  const orgParam = pick(raw.org);
  const activeOrg =
    orgParam != null
      ? (myOrgs.find((o) => String(o.org.id) === orgParam)?.org ?? null)
      : null;

  // 邀请链接 /?code=xxx 落地：识别组织并引导去申请
  let invitedOrg: { id: number; name: string } | null = null;
  if (inviteCode) {
    const [row] = await db
      .select({ id: orgs.id, name: orgs.name })
      .from(orgs)
      .where(eq(orgs.inviteCode, normalizeInviteCode(inviteCode)))
      .limit(1);
    invitedOrg = row ?? null;
  }

  const conds: SQL[] = [
    activeOrg ? eq(needs.orgId, activeOrg.id) : isNull(needs.orgId),
    eq(needs.moderationStatus, "visible"),
    eq(users.status, "active"),
  ];
  if (viewer) {
    const blockedRows = await db
      .select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
      .from(blocks)
      .where(
        or(eq(blocks.blockerId, viewer.id), eq(blocks.blockedId, viewer.id)),
      );
    const hiddenUserIds = blockedRows.map((row) =>
      row.blockerId === viewer.id ? row.blockedId : row.blockerId,
    );
    if (hiddenUserIds.length > 0) conds.push(notInArray(needs.userId, hiddenUserIds));
  }
  if (!showAll) {
    conds.push(eq(needs.status, "open"));
    conds.push(or(isNull(needs.expiresAt), gt(needs.expiresAt, new Date()))!);
  }
  if (type === "need" || type === "offer") conds.push(eq(needs.type, type));
  if (q) {
    const kw = `%${q}%`;
    conds.push(
      or(
        sql`${needs.title} LIKE ${kw}`,
        sql`${needs.description} LIKE ${kw}`,
      )!,
    );
  }
  if (tag) conds.push(sql`${needs.tags} LIKE ${`%"${tag}"%`}`);

  const rows = await db
    .select({ need: needs })
    .from(needs)
    .innerJoin(users, eq(needs.userId, users.id))
    .where(and(...conds))
    .orderBy(desc(needs.updatedAt))
    .limit(100);
  const list = rows.map((row) => row.need);

  const current = {
    org: activeOrg ? String(activeOrg.id) : undefined,
    type,
    q,
    tag,
    all: showAll ? "1" : undefined,
  };
  const typeTabs = [
    { label: t.plaza.typeAll, mobileLabel: t.plaza.typeAllShort, value: undefined },
    { label: typeLabel(t, "need"), mobileLabel: typeShort(t, "need"), value: "need" },
    { label: typeLabel(t, "offer"), mobileLabel: typeShort(t, "offer"), value: "offer" },
  ];
  const publishHref = activeOrg
    ? `/needs/new?scope=${activeOrg.id}`
    : "/needs/new";

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="sr-only">{t.plaza.title}</h1>
        {viewer && (
          <nav
            aria-label={t.plaza.scopeNavLabel}
            className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
          >
            <LocaleLink
              href={buildQuery({ ...current, org: undefined })}
              aria-current={!activeOrg ? "page" : undefined}
              scroll={false}
              className={`flex h-10 shrink-0 items-center justify-center bg-transparent px-1 transition-[color,font-size] duration-150 ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                !activeOrg
                  ? "text-xl font-semibold text-accent"
                  : "text-sm text-gray hover:text-ink"
              }`}
            >
              {t.plaza.title}
            </LocaleLink>
            {myOrgs.map(({ org }) => {
              const isActive = activeOrg?.id === org.id;

              return (
                <LocaleLink
                  key={org.id}
                  href={buildQuery({ ...current, org: String(org.id) })}
                  aria-current={isActive ? "page" : undefined}
                  scroll={false}
                  className={`flex h-10 max-w-56 shrink-0 items-center justify-center bg-transparent px-2 transition-[color,font-size] duration-150 ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    isActive
                      ? "text-xl font-semibold text-accent"
                      : "text-sm text-gray hover:text-ink"
                  }`}
                >
                  <span className="min-w-0 truncate">{org.name}</span>
                </LocaleLink>
              );
            })}
            <LocaleLink
              href="/orgs"
              aria-label={t.nav.discoverOrgs}
              className="flex size-10 shrink-0 items-center justify-center text-gray transition-colors duration-100 hover:text-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <Plus size={16} aria-hidden />
            </LocaleLink>
          </nav>
        )}
        <LocaleLink
          href={publishHref}
          className="ml-auto hidden shrink-0 items-center gap-1 rounded-sm bg-accent px-3 py-2 text-sm font-semibold tracking-[0.06em] text-panel active:translate-y-px md:inline-flex"
        >
          <Plus size={14} strokeWidth={2.5} />
          {t.common.publish}
        </LocaleLink>
      </div>

      {invitedOrg && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-line bg-panel p-3">
          <p className="min-w-0 flex-1 text-sm">
            {fmt(t.plaza.inviteBanner, { name: invitedOrg.name })}
          </p>
          <LocaleLink
            href={`/orgs?code=${encodeURIComponent(normalizeInviteCode(inviteCode!))}`}
            className="shrink-0 rounded-sm bg-accent px-3 py-2 text-sm font-semibold tracking-[0.06em] text-panel active:translate-y-px"
          >
            {t.plaza.inviteApply}
          </LocaleLink>
        </div>
      )}
      {inviteCode && !invitedOrg && (
        <p className="mt-4 text-xs text-gray">{t.plaza.inviteInvalid}</p>
      )}

      <div className="mt-4 flex gap-2">
        <form
          action={localePath(locale, "/")}
          className="relative flex h-10 min-w-0 flex-1 overflow-hidden rounded-sm border border-line bg-panel transition-colors duration-100 focus-within:border-ink"
        >
          {activeOrg && (
            <input type="hidden" name="org" value={activeOrg.id} />
          )}
          {type && <input type="hidden" name="type" value={type} />}
          {tag && <input type="hidden" name="tag" value={tag} />}
          {showAll && <input type="hidden" name="all" value="1" />}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder={t.plaza.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-gray"
          />
          <button
            type="submit"
            aria-label={t.plaza.searchLabel}
            title={t.plaza.searchLabel}
            className="flex w-10 shrink-0 items-center justify-center border-l border-line text-gray transition-colors duration-100 hover:text-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
          >
            <Search size={16} aria-hidden />
          </button>
        </form>
        <div className="flex shrink-0 overflow-hidden rounded-sm border border-line">
          {typeTabs.map((tab, i) => {
            const active = type === tab.value || (!type && !tab.value);
            return (
              <LocaleLink
                key={tab.label}
                href={buildQuery({ ...current, type: tab.value })}
                aria-label={tab.label}
                className={`flex items-center px-2.5 text-xs transition-colors duration-100 ${
                  i > 0 ? "border-l border-line" : ""
                } ${active ? "bg-ink font-semibold text-panel" : "text-gray hover:text-ink"}`}
              >
                <span className="md:hidden">{tab.mobileLabel}</span>
                <span className="hidden md:inline">{tab.label}</span>
              </LocaleLink>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {tag && (
          <LocaleLink
            href={buildQuery({ ...current, tag: undefined })}
            className="inline-flex items-center gap-1 rounded-sm border border-ink px-1.5 py-0.5 font-mono text-2xs"
          >
            {tag}
            <X size={11} aria-hidden />
          </LocaleLink>
        )}
        {q && (
          <LocaleLink
            href={buildQuery({ ...current, q: undefined })}
            className="inline-flex items-center gap-1 rounded-sm border border-ink px-1.5 py-0.5 font-mono text-2xs"
          >
            “{q}”
            <X size={11} aria-hidden />
          </LocaleLink>
        )}
        <div className="ml-auto inline-flex shrink-0 items-center gap-1.5 font-mono text-2xs text-gray">
          {!showAll && (
            <i className="size-1.5 rounded-full bg-accent" aria-hidden />
          )}
          <span>
            {fmt(showAll ? t.plaza.countAll : t.plaza.countOngoing, {
              n: list.length,
            })}
          </span>
          <span aria-hidden>·</span>
          <LocaleLink
            href={buildQuery({
              ...current,
              all: showAll ? undefined : "1",
            })}
            className="transition-colors duration-100 hover:text-ink"
          >
            {showAll ? t.plaza.showOngoingOnly : t.plaza.showAll}
          </LocaleLink>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState>
          {q || tag
            ? t.plaza.emptyNoMatch
            : activeOrg
              ? t.plaza.emptyOrg
              : t.plaza.emptyPlaza}
        </EmptyState>
      ) : (
        <>
          <div className="mt-3 rounded-md border border-line bg-panel">
            {list.map((need, i) => (
              <NeedCard key={need.id} need={need} first={i === 0} />
            ))}
          </div>
          {/* 广场范围的移动端末尾由品牌页脚兼任终点标记；组织范围和桌面端仍用普通标记 */}
          {!activeOrg && <BrandFooter />}
          <ListEnd desktopOnly={!activeOrg} />
        </>
      )}

      <LocaleLink
        href={publishHref}
        className="fixed bottom-[calc(var(--tabbar-h)+16px)] right-[calc(16px+var(--safe-r))] z-10 flex h-11 items-center gap-1 rounded-sm bg-accent px-4 text-sm font-semibold tracking-[0.06em] text-panel active:translate-y-px md:hidden"
      >
        <Plus size={14} strokeWidth={2.5} />
        {t.common.publish}
      </LocaleLink>
    </div>
  );
}
