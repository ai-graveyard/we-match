
import { Card } from "@/components/ui/card";
import { Plus, X } from "lucide-react";
import { and, count, eq, gt, notInArray, or, sql, type SQL } from "drizzle-orm";
import { isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { blocks, needs, orgs, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getUserOrgs } from "@/lib/queries";
import { normalizeInviteCode } from "@/lib/orgs";
import { NeedCard } from "@/components/need-card";
import { publicAuthor } from "@/lib/public-profile";
import { EmptyState, ListEnd } from "@/components/list-states";
import { BrandFooter } from "@/components/brand-footer";
import { SearchField } from "@/components/search-field";
import { PlazaSortSelect } from "@/components/plaza-sort";
import {
  panel,
  primaryBtn,
  secondaryBtn,
  segmentFrame,
  segmentItem,
  statusDot,
  tag as tagCls,
} from "@/lib/ui";
import { getDict, getLocale } from "@/lib/i18n/server";
import { LocaleLink } from "@/lib/i18n/link";
import { localePath } from "@/lib/i18n/routing";
import { fmt } from "@/lib/i18n/fmt";
import {
  normalizePlazaSort,
  plazaOrderBy,
  type PlazaSort,
} from "@/lib/plaza-sort";

export const dynamic = "force-dynamic";

function buildQuery(params: {
  org?: string;
  type?: string;
  q?: string;
  tag?: string;
  all?: string;
  sort?: PlazaSort;
  page?: number;
}) {
  const qs = new URLSearchParams();
  if (params.org) qs.set("org", params.org);
  if (params.type) qs.set("type", params.type);
  if (params.q) qs.set("q", params.q);
  if (params.tag) qs.set("tag", params.tag);
  if (params.all) qs.set("all", params.all);
  if (params.sort && params.sort !== "updated") qs.set("sort", params.sort);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
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
  const sort = normalizePlazaSort(pick(raw.sort));
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
    isNull(needs.deletedAt),
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

  const filter = and(...conds);
  const [totalRow] = await db.select({ n: count() }).from(needs)
    .innerJoin(users, eq(needs.userId, users.id)).where(filter);
  const total = totalRow?.n ?? 0;
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const requestedPage = Number(pick(raw.page));
  const page = Math.min(pageCount, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  const list = await db
    .select({
      need: needs,
      author: publicAuthor,
    })
    .from(needs)
    .innerJoin(users, eq(needs.userId, users.id))
    .where(filter)
    .orderBy(...plazaOrderBy(sort))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const current = {
    org: activeOrg ? String(activeOrg.id) : undefined,
    type,
    q,
    tag,
    all: showAll ? "1" : undefined,
    sort,
  };
  const typeTabs = [
    { label: t.plaza.typeAll, value: undefined },
    { label: t.plaza.typeNeed, value: "need" },
    { label: t.plaza.typeOffer, value: "offer" },
  ];
  const publishHref = activeOrg
    ? `/needs/new?scope=${activeOrg.id}`
    : "/needs/new";

  return (
    <div>
      <div className="flex items-center gap-3">
        {!viewer && (
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{t.plaza.title}</h1>
            <p className="mt-1 text-xs text-gray">{t.plaza.intro}</p>
          </div>
        )}
        {viewer && <h1 className="sr-only">{t.plaza.title}</h1>}
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
          className={`${primaryBtn} ml-auto shrink-0 max-md:hidden`}
        >
          <Plus size={14} strokeWidth={2.5} />
          {t.common.publish}
        </LocaleLink>
      </div>

      {/* 「去申请」用墨色次按钮：本屏的焦橙已经给了「+ 发布」，
          邀请横幅再来一个就是同屏两处焦橙（见 DESIGN.md 焦橙纪律） */}
      {invitedOrg && (
        <Card className={`mt-4 flex items-center gap-2 ${panel} p-3`}>
          <p className="min-w-0 flex-1 text-sm">
            {fmt(t.plaza.inviteBanner, { name: invitedOrg.name })}
          </p>
          <LocaleLink
            href={`/orgs?code=${encodeURIComponent(normalizeInviteCode(inviteCode!))}`}
            className={`${secondaryBtn} shrink-0`}
          >
            {t.plaza.inviteApply}
          </LocaleLink>
        </Card>
      )}
      {inviteCode && !invitedOrg && (
        <p className="mt-4 text-xs text-gray">{t.plaza.inviteInvalid}</p>
      )}

      <div className="mt-4 flex flex-col gap-2 md:flex-row">
        <SearchField
          action={localePath(locale, "/")}
          name="q"
          defaultValue={q}
          placeholder={t.plaza.searchPlaceholder}
          label={t.plaza.searchLabel}
          className="md:flex-1"
          hidden={
            <>
              {activeOrg && (
                <input type="hidden" name="org" value={activeOrg.id} />
              )}
              {type && <input type="hidden" name="type" value={type} />}
              {tag && <input type="hidden" name="tag" value={tag} />}
              {showAll && <input type="hidden" name="all" value="1" />}
              {sort !== "updated" && (
                <input type="hidden" name="sort" value={sort} />
              )}
            </>
          }
        />
        <div className={`${segmentFrame} grid w-full shrink-0 grid-cols-3 md:w-auto`}>
          {typeTabs.map((tab, i) => {
            const active = type === tab.value || (!type && !tab.value);
            return (
              <LocaleLink
                key={tab.label}
                href={buildQuery({ ...current, type: tab.value })}
                aria-label={tab.label}
                aria-current={active ? "true" : undefined}
                scroll={false}
                className={segmentItem(active, i === 0)}
              >
                {tab.label}
              </LocaleLink>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {tag && (
          <LocaleLink
            href={buildQuery({ ...current, tag: undefined })}
            className={`${tagCls(true)} inline-flex items-center gap-1`}
          >
            {tag}
            <X size={11} aria-hidden />
          </LocaleLink>
        )}
        {q && (
          <LocaleLink
            href={buildQuery({ ...current, q: undefined })}
            className={`${tagCls(true)} inline-flex items-center gap-1`}
          >
            “{q}”
            <X size={11} aria-hidden />
          </LocaleLink>
        )}
        <PlazaSortSelect
          label={t.plaza.sortLabel}
          value={sort}
          options={[
            {
              value: "updated",
              label: t.plaza.sortUpdated,
              href: localePath(
                locale,
                buildQuery({ ...current, sort: "updated" }),
              ),
            },
            {
              value: "newest",
              label: t.plaza.sortNewest,
              href: localePath(
                locale,
                buildQuery({ ...current, sort: "newest" }),
              ),
            },
            {
              value: "expiring",
              label: t.plaza.sortExpiring,
              href: localePath(
                locale,
                buildQuery({ ...current, sort: "expiring" }),
              ),
            },
          ]}
        />
        <div className="ml-auto inline-flex shrink-0 items-center gap-1.5 font-mono text-2xs text-gray">
          {!showAll && <i className={statusDot} aria-hidden />}
          <span>
            {fmt(showAll ? t.plaza.countAll : t.plaza.countOngoing, {
              n: total,
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
          <span className="mt-3 flex flex-wrap justify-center gap-3">
            {(q || tag || type) && (
              <LocaleLink href={buildQuery({ org: current.org, all: current.all, sort })} className="text-ink underline">
                {t.plaza.clearFilters}
              </LocaleLink>
            )}
            <LocaleLink href={publishHref} className="text-ink underline">{t.plaza.publishFirst}</LocaleLink>
          </span>
        </EmptyState>
      ) : (
        <>
          <Card className={`mt-3 overflow-hidden ${panel}`}>
            {list.map(({ need, author }, i) => (
              <NeedCard
                key={need.id}
                need={need}
                author={author}
                first={i === 0}
              />
            ))}
          </Card>
          {pageCount > 1 && (
            <nav aria-label={t.plaza.paginationLabel} className="mt-4 flex items-center justify-between gap-2">
              {page > 1 ? <LocaleLink href={buildQuery({ ...current, page: page - 1 })} className={secondaryBtn}>{t.plaza.previousPage}</LocaleLink> : <span />}
              <span className="font-mono text-2xs text-gray">{page} / {pageCount}</span>
              {page < pageCount ? <LocaleLink href={buildQuery({ ...current, page: page + 1 })} className={secondaryBtn}>{t.plaza.nextPage}</LocaleLink> : <span />}
            </nav>
          )}
          {/* 广场范围的移动端末尾由品牌页脚兼任终点标记；组织范围和桌面端仍用普通标记 */}
          {!activeOrg && <BrandFooter />}
          <ListEnd desktopOnly={!activeOrg} />
        </>
      )}

      <LocaleLink
        href={publishHref}
        className={`${primaryBtn} fixed bottom-[calc(var(--tabbar-h)+16px)] right-[calc(16px+var(--safe-r))] z-10 md:hidden`}
      >
        <Plus size={14} strokeWidth={2.5} />
        {t.common.publish}
      </LocaleLink>
    </div>
  );
}
