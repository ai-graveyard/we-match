import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { connections, needs, orgMembers, orgs, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { isExpired } from "@/lib/needs";
import { TypeBadge, StatusBadge, deadlineText } from "@/components/need-card";
import { NeedActions } from "@/components/need-actions";
import { PageHeader } from "@/components/page-header";
import { DefaultUserAvatar } from "@/components/default-user-avatar";
import { ShareCard } from "@/components/share-card";
import { siteOrigin } from "@/lib/site-url";
import { visibleCard } from "@/lib/card";
import { sharesOrg } from "@/lib/queries";
import {
  ContactPanel,
  type ContactChannel,
} from "@/components/contact-panel";
import { ConnectionPanel } from "@/components/connection-panel";
import { isBlockedEitherWay } from "@/lib/activity";
import { SafetyActions } from "@/components/safety-actions";
import { getDict, getLocale } from "@/lib/i18n/server";
import { LocaleLink } from "@/lib/i18n/link";
import { localePath } from "@/lib/i18n/routing";
import { fmt } from "@/lib/i18n/fmt";
import { intentLabel, relativeTime } from "@/lib/i18n/labels";
import { uiDict } from "@/lib/i18n/dict";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { BRAND_NAME } from "@/lib/brand";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/needs/[id]">): Promise<Metadata> {
  const { id, lang } = await params;
  const t = uiDict(isLocale(lang) ? lang : DEFAULT_LOCALE);
  const nid = Number(id);
  if (!Number.isInteger(nid) || nid <= 0) return { title: t.need.metaDetail };
  const [row] = await db
    .select({ need: needs, author: users })
    .from(needs)
    .innerJoin(users, eq(needs.userId, users.id))
    .where(eq(needs.id, nid))
    .limit(1);
  // 组织内需求不做对外分享卡，只给通用标题
  if (!row || row.need.orgId != null) return { title: t.need.metaDetail };
  const title = fmt(t.share.copyNeedTitle, {
    type: intentLabel(t, row.need.type),
    title: row.need.title,
  });
  const description = row.need.description
    ? row.need.description.slice(0, 120)
    : fmt(t.share.copyNeedText, { name: row.author.nickname });
  return {
    title,
    description,
    openGraph: {
      title: `${title} · ${BRAND_NAME}`,
      description,
      type: "website",
    },
  };
}

export default async function NeedDetailPage({
  params,
  searchParams,
}: PageProps<"/[lang]/needs/[id]">) {
  const t = await getDict();
  const locale = await getLocale();
  const { id } = await params;
  const nid = Number(id);
  if (!Number.isInteger(nid) || nid <= 0) notFound();

  const [row] = await db
    .select({ need: needs, author: users })
    .from(needs)
    .innerJoin(users, eq(needs.userId, users.id))
    .where(eq(needs.id, nid))
    .limit(1);
  if (!row) notFound();
  const { need, author } = row;

  const viewer = await getSessionUser();
  const isOwner = viewer?.id === need.userId;
  if (
    (!isOwner && need.moderationStatus === "hidden") ||
    (!isOwner && author.status !== "active")
  ) notFound();
  if (viewer && !isOwner && (await isBlockedEitherWay(viewer.id, author.id))) {
    notFound();
  }

  // 组织内需求：非成员一律 404，不暴露存在性
  let orgName: string | null = null;
  if (need.orgId != null) {
    if (!viewer) notFound();
    if (!isOwner) {
      const [membership] = await db
        .select({ orgId: orgMembers.orgId })
        .from(orgMembers)
        .where(
          and(eq(orgMembers.orgId, need.orgId), eq(orgMembers.userId, viewer.id)),
        )
        .limit(1);
      if (!membership) notFound();
    }
    const [org] = await db
      .select({ name: orgs.name })
      .from(orgs)
      .where(eq(orgs.id, need.orgId))
      .limit(1);
    orgName = org?.name ?? null;
  }

  const expired = isExpired(need);
  const origin = await siteOrigin();
  const viewerSharesOrg =
    viewer && !isOwner ? await sharesOrg(viewer.id, author.id) : false;
  const contactCard = visibleCard(author, {
    loggedIn: !!viewer,
    sharesOrg: !!viewerSharesOrg,
  });
  const contactChannels: ContactChannel[] = contactCard.contacts.flatMap(
    (contact) =>
      contact.value ? [{ key: contact.key, value: contact.value }] : [],
  );
  const canContact = !isOwner && need.status === "open" && !expired;
  const query = await searchParams;
  const contactQuery = Array.isArray(query.contact)
    ? query.contact[0]
    : query.contact;
  const connectionRows = viewer
    ? await db
        .select({ connection: connections, initiator: users })
        .from(connections)
        .innerJoin(users, eq(connections.initiatorId, users.id))
        .where(
          isOwner
            ? eq(connections.needId, need.id)
            : and(
                eq(connections.needId, need.id),
                eq(connections.initiatorId, viewer.id),
              ),
        )
        .orderBy(desc(connections.updatedAt))
    : [];
  const connectionItems = connectionRows.map(({ connection, initiator }) => ({
    id: connection.id,
    initiatorId: connection.initiatorId,
    initiatorName: initiator.nickname,
    message: connection.message,
    status: connection.status,
    ownerConfirmed: !!connection.ownerConfirmedAt,
    initiatorConfirmed: !!connection.initiatorConfirmedAt,
  }));
  const currentConnection = connectionItems[0];
  // 非发布者视角下 connectionItems 只会有自己的那条举手
  const interestStatus = isOwner ? null : currentConnection?.status ?? null;
  const canExpressInterest =
    !interestStatus ||
    interestStatus === "rejected" ||
    interestStatus === "cancelled";
  // 未登录先引导登录；登录后只要还能举手、或有可见联系方式，就给一个入口
  const showContactAction =
    canContact && (!viewer || canExpressInterest || contactChannels.length > 0);

  return (
    <div>
      <PageHeader title={t.need.metaDetail} mobileOnly className="mb-4" />
      <section className="rounded-md border border-line bg-panel p-4">
        <div className="flex items-center gap-2">
          <TypeBadge type={need.type} />
          <StatusBadge need={need} />
          <span className="font-mono text-2xs text-gray">
            {orgName ? `${orgName} · ` : ""}
            {relativeTime(t, need.updatedAt)}
          </span>
          <div className="ml-auto">
            <ShareCard
              data={{
                kind: "need",
                title: need.title,
                description: need.description,
                tags: need.tags,
                type: need.type,
                author: author.nickname,
                meta: deadlineText(t, need.expiresAt),
                url: `${origin}/needs/${need.id}`,
              }}
            />
          </div>
        </div>
        <h1 className="mt-2 text-xl font-semibold">{need.title}</h1>
        {need.description && (
          <p className="mt-2 whitespace-pre-wrap text-sm">{need.description}</p>
        )}
        {need.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {need.tags.map((tag) => (
              <LocaleLink
                key={tag}
                href={`/?tag=${encodeURIComponent(tag)}`}
                className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-2xs text-gray transition-colors duration-100 hover:border-ink hover:text-ink"
              >
                {tag}
              </LocaleLink>
            ))}
          </div>
        )}
        <p className="mt-3 border-t border-line pt-3 font-mono text-2xs text-gray">
          {deadlineText(t, need.expiresAt)}
        </p>
      </section>

      {isOwner && (
        <section className="mt-4">
          <NeedActions id={need.id} status={need.status} expired={expired} />
          {expired && (
            <p className="mt-2 text-2xs text-gray">
              {t.need.detailExpiredHint}
            </p>
          )}
        </section>
      )}

      {viewer && (
        <ConnectionPanel
          rows={connectionItems}
          viewerId={viewer.id}
          ownerId={need.userId}
        />
      )}

      {showContactAction && (
        <section className="sticky bottom-[calc(var(--tabbar-h)+16px)] z-20 mt-4 bg-bg py-2 md:static md:py-0">
          <ContactPanel
            need={{ id: need.id, type: need.type, title: need.title }}
            author={author.nickname}
            channels={contactChannels}
            interestStatus={interestStatus}
            preferredContact={viewer ? need.preferredContact : null}
            loginHref={
              viewer
                ? undefined
                : localePath(
                    locale,
                    `/login?next=${encodeURIComponent(`/needs/${need.id}?contact=1`)}`,
                  )
            }
            initialOpen={!!viewer && contactQuery === "1"}
          />
        </section>
      )}

      <section className="mt-4">
        <h2 className="text-2xs font-semibold tracking-[0.08em] text-gray">
          {t.need.detailPublisher}
        </h2>
        <LocaleLink
          href={`/u/${author.id}`}
          className="mt-2 flex items-center gap-3 rounded-md border border-line bg-panel p-4 transition-colors duration-100 hover:bg-bg-3"
        >
          <DefaultUserAvatar className="size-11" iconSize={20} />
          <div className="min-w-0">
            <div className="font-semibold">{author.nickname}</div>
            <div className="truncate text-xs text-gray">
              {author.bio ||
                (viewer ? t.need.detailViewCard : t.need.detailLoginToView)}
            </div>
          </div>
          <ChevronRight
            size={15}
            className="ml-auto shrink-0 text-gray"
            aria-hidden
          />
        </LocaleLink>
      </section>

      {viewer && !isOwner && (
        <SafetyActions targetType="need" targetId={need.id} />
      )}
    </div>
  );
}
