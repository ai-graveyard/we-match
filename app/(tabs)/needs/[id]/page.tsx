import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { connections, needs, orgMembers, orgs, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { isExpired } from "@/lib/needs";
import { relativeTime, shortDateTime } from "@/lib/format";
import { TypeBadge, StatusBadge } from "@/components/need-card";
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

export async function generateMetadata({
  params,
}: PageProps<"/needs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const nid = Number(id);
  if (!Number.isInteger(nid) || nid <= 0) return { title: "需求详情" };
  const [row] = await db
    .select({ need: needs, author: users })
    .from(needs)
    .innerJoin(users, eq(needs.userId, users.id))
    .where(eq(needs.id, nid))
    .limit(1);
  if (!row || row.need.orgId != null) return { title: "需求详情" };
  const typeLabel = row.need.type === "need" ? "我需要" : "我提供";
  const title = `${typeLabel}｜${row.need.title}`;
  const socialTitle = `${title} · We Match`;
  const description = row.need.description
    ? row.need.description.slice(0, 120)
    : `${row.author.nickname} 在 We Match 发布了一条需求`;
  return {
    title,
    description,
    openGraph: { title: socialTitle, description, type: "website" },
  };
}

export default async function NeedDetailPage({
  params,
  searchParams,
}: PageProps<"/needs/[id]">) {
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
      contact.value
        ? [{ key: contact.key, label: contact.label, value: contact.value }]
        : [],
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
      <PageHeader title="需求详情" mobileOnly className="mb-4" />
      <section className="rounded-md border border-line bg-panel p-4">
        <div className="flex items-center gap-2">
          <TypeBadge type={need.type} />
          <StatusBadge need={need} />
          <span className="font-mono text-2xs text-gray">
            {orgName ? `${orgName} · ` : ""}
            {relativeTime(need.updatedAt)}
          </span>
          <div className="ml-auto">
            <ShareCard
              data={{
                kind: "need",
                title: need.title,
                description: need.description,
                tags: need.tags,
                typeLabel: need.type === "need" ? "我需要" : "我提供",
                author: author.nickname,
                meta: need.expiresAt
                  ? `截止 ${shortDateTime(need.expiresAt)}`
                  : "永久有效",
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
              <Link
                key={tag}
                href={`/?tag=${encodeURIComponent(tag)}`}
                className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-2xs text-gray transition-colors duration-100 hover:border-ink hover:text-ink"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}
        <p className="mt-3 border-t border-line pt-3 font-mono text-2xs text-gray">
          {need.expiresAt
            ? `截止 ${shortDateTime(need.expiresAt)}`
            : "永久有效"}
        </p>
      </section>

      {isOwner && (
        <section className="mt-4">
          <NeedActions id={need.id} status={need.status} expired={expired} />
          {expired && (
            <p className="mt-2 text-2xs text-gray">
              这条需求已超过截止时间并从列表隐藏；点「续期一个月」可快速恢复
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
                : `/login?next=${encodeURIComponent(`/needs/${need.id}?contact=1`)}`
            }
            initialOpen={!!viewer && contactQuery === "1"}
          />
        </section>
      )}

      <section className="mt-4">
        <h2 className="text-2xs font-semibold tracking-[0.08em] text-gray">
          发布者
        </h2>
        <Link
          href={`/u/${author.id}`}
          className="mt-2 flex items-center gap-3 rounded-md border border-line bg-panel p-4 transition-colors duration-100 hover:bg-bg-3"
        >
          <DefaultUserAvatar className="size-11" iconSize={20} />
          <div className="min-w-0">
            <div className="font-semibold">{author.nickname}</div>
            <div className="truncate text-xs text-gray">
              {author.bio ||
                (viewer ? "查看名片和联系方式" : "登录后查看联系方式")}
            </div>
          </div>
          <ChevronRight
            size={15}
            className="ml-auto shrink-0 text-gray"
            aria-hidden
          />
        </Link>
      </section>

      {viewer && !isOwner && (
        <SafetyActions targetType="need" targetId={need.id} />
      )}
    </div>
  );
}
