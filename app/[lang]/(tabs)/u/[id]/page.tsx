
import { Card } from "@/components/ui/card";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { blocks, connections, contactReveals, needs, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { isBlockedEitherWay } from "@/lib/activity";
import { sharesOrg } from "@/lib/queries";
import {
  countConnectedContacts,
  hasLoginVisibleCardDetails,
  hasUnrevealedConnectedContacts,
  visibleCard,
} from "@/lib/card";
import { CopyButton } from "@/components/copy-button";
import { NeedCard } from "@/components/need-card";
import { PageHeader } from "@/components/page-header";
import { DefaultUserAvatar } from "@/components/default-user-avatar";
import { MaskedEmail } from "@/components/masked-email";
import { ShareCard } from "@/components/share-card";
import { siteOrigin } from "@/lib/site-url";
import { SafetyActions } from "@/components/safety-actions";
import { revealedFieldsTo } from "@/lib/connections-service";
import {
  panel,
  primaryBtn,
  sectionLabel,
  tag as tagCls,
} from "@/lib/ui";
import { CardPreviewSelect } from "@/components/card-preview-select";
import { localePath } from "@/lib/i18n/routing";
import { getDict, getLocale } from "@/lib/i18n/server";
import { LocaleLink } from "@/lib/i18n/link";
import { fmt, plural } from "@/lib/i18n/fmt";
import { cardFieldLabel, cardVisibilityLabel } from "@/lib/i18n/labels";
import { uiDict } from "@/lib/i18n/dict";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import type { UiDict } from "@/lib/i18n/dict/types";

type PreviewView = "guest" | "user" | "org";

const PREVIEW_VIEWS: {
  value: PreviewView;
  label: (t: UiDict) => string;
}[] = [
  { value: "guest", label: (t) => t.card.previewGuest },
  { value: "user", label: (t) => t.card.previewUser },
  { value: "org", label: (t) => t.card.previewOrg },
];

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/u/[id]">): Promise<Metadata> {
  const { id, lang } = await params;
  const t = uiDict(isLocale(lang) ? lang : DEFAULT_LOCALE);
  const uid = Number(id);
  if (!Number.isInteger(uid) || uid <= 0) return { title: t.card.metaDetail };
  const [owner] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
  if (!owner || owner.status !== "active") return { title: t.card.metaDetail };
  const viewer = await getSessionUser();
  if (
    viewer &&
    viewer.id !== owner.id &&
    (await isBlockedEitherWay(viewer.id, owner.id))
  ) {
    return { title: t.card.metaDetail };
  }
  const card = visibleCard(owner, { loggedIn: false, sharesOrg: false });
  const title = fmt(t.share.copyUserTitle, { name: card.nickname });
  const description =
    card.bio || fmt(t.share.copyUserText, { name: card.nickname });
  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      type: "profile",
    },
  };
}

export default async function UserCardPage({
  params,
  searchParams,
}: PageProps<"/[lang]/u/[id]">) {
  const t = await getDict();
  const locale = await getLocale();
  const { id } = await params;
  const uid = Number(id);
  if (!Number.isInteger(uid) || uid <= 0) notFound();
  const [owner] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
  if (!owner) notFound();

  const viewer = await getSessionUser();
  const isSelf = viewer?.id === owner.id;
  if (!isSelf && owner.status !== "active") notFound();
  const blockRelations = viewer && !isSelf
    ? await db
        .select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
        .from(blocks)
        .where(
          or(
            and(eq(blocks.blockerId, viewer.id), eq(blocks.blockedId, owner.id)),
            and(eq(blocks.blockerId, owner.id), eq(blocks.blockedId, viewer.id)),
          ),
        )
    : [];
  if (viewer && blockRelations.some((row) => row.blockerId === owner.id)) {
    notFound();
  }
  const blockedByViewer = !!viewer && blockRelations.some(
    (row) => row.blockerId === viewer.id,
  );
  const shared =
    viewer && !isSelf ? await sharesOrg(viewer.id, owner.id) : false;
  const query = await searchParams;
  const requestedView = Array.isArray(query.view) ? query.view[0] : query.view;
  const previewView: PreviewView =
    requestedView === "user" || requestedView === "org"
      ? requestedView
      : "guest";
  const revealedFields =
    viewer && !isSelf
      ? await revealedFieldsTo(owner.id, viewer.id)
      : new Set<string>();
  const revealSources =
    viewer && !isSelf
      ? await db
          .select({
            field: contactReveals.field,
            title: needs.title,
          })
          .from(contactReveals)
          .innerJoin(connections, eq(connections.id, contactReveals.connectionId))
          .innerJoin(needs, eq(needs.id, contactReveals.needId))
          .where(
            and(
              eq(contactReveals.fromUserId, owner.id),
              eq(contactReveals.toUserId, viewer.id),
              inArray(connections.status, ["accepted", "completed"]),
              isNull(needs.deletedAt),
            ),
          )
      : [];
  const revealSourceByField = new Map<string, string>(
    revealSources.map((row) => [row.field, row.title]),
  );
  const audience = isSelf
    ? {
        loggedIn: previewView !== "guest",
        sharesOrg: previewView === "org",
      }
    : {
        loggedIn: !!viewer,
        sharesOrg: !!shared,
        revealedFields,
      };
  const card = visibleCard(owner, audience);
  const visibleEmail = card.contacts.find((item) => item.key === "email")?.value;
  const publicCard = visibleCard(owner, {
    loggedIn: false,
    sharesOrg: false,
  });
  const origin = await siteOrigin();
  const showLoginGate =
    !audience.loggedIn && hasLoginVisibleCardDetails(owner);
  const showConnectionGate =
    !!audience.loggedIn &&
    !isSelf &&
    hasUnrevealedConnectedContacts(owner) &&
    card.contacts.length === 0;

  const groups = [
    {
      title: t.card.groupContact,
      items: card.contacts.filter((item) => item.key !== "email"),
    },
    { title: t.card.groupSocial, items: card.socials },
  ].filter((g) => g.items.length > 0);
  const primaryCopyKey = groups[0]?.items[0]?.key;
  const connectedCount = isSelf ? countConnectedContacts(owner) : 0;

  return (
    <div>
      <PageHeader title={t.card.metaDetail} mobileOnly className="mb-4" />
      {isSelf && (
        <Card as="section" className={`mb-4 ${panel} p-3`}>
          <CardPreviewSelect
            label={t.card.previewHint}
            value={previewView}
            options={PREVIEW_VIEWS.map((option) => ({
              value: option.value,
              label: option.label(t),
              href: localePath(locale, `/u/${owner.id}?view=${option.value}`),
            }))}
          />
          <div className="mt-2 flex items-center justify-between gap-3 text-2xs text-gray">
            <span>{t.card.previewHint}</span>
            <LocaleLink href="/me/card" className="shrink-0 text-ink underline">
              {t.me.editCard}
            </LocaleLink>
          </div>
          {connectedCount > 0 && (
            <p className="mt-1 text-xs text-gray">
              {plural(t.card.previewConnected, connectedCount)}
            </p>
          )}
        </Card>
      )}
      <Card as="section" className={`${panel} p-4`}>
        <div className="flex items-center gap-3">
          <DefaultUserAvatar className="size-12" iconSize={22} />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-semibold">{card.nickname}</h1>
            {visibleEmail && (
              <>
                <MaskedEmail
                  email={visibleEmail}
                  showLabel={t.card.showEmail}
                  hideLabel={t.card.hideEmail}
                />
                {revealSourceByField.get("email") && (
                  <p className="font-mono text-3xs text-gray">
                    {fmt(t.card.revealedFromNeed, {
                      title: revealSourceByField.get("email")!,
                    })}
                  </p>
                )}
              </>
            )}
            {card.city && <p className="text-xs text-gray">{card.city}</p>}
          </div>
          <div className="ml-auto shrink-0">
            <ShareCard
              data={{
                kind: "user",
                nickname: publicCard.nickname,
                bio: publicCard.bio,
                city: publicCard.city,
                tags: publicCard.tags,
                url: `${origin}/u/${owner.id}`,
              }}
            />
          </div>
        </div>
        {card.bio && <p className="mt-3 text-sm">{card.bio}</p>}
        {card.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {card.tags.map((tag) => (
              <span
                key={tag}
                className={tagCls()}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </Card>

      {showLoginGate && (
        <Card as="section" className={`mt-4 ${panel}`}>
          <h2 className={`${sectionLabel} border-b border-line px-4 py-2`}>
            {t.card.loginGateTitle}
          </h2>
          <div className="p-4">
            <p className="text-sm">{t.card.loginGateBody}</p>
            <LocaleLink
              href={
                isSelf
                  ? `/u/${owner.id}?view=user`
                  : `/login?next=${encodeURIComponent(`/u/${owner.id}`)}`
              }
              className={`${primaryBtn} mt-3 w-full`}
            >
              {t.card.loginGateAction}
            </LocaleLink>
          </div>
        </Card>
      )}

      {showConnectionGate && (
        <Card as="section" className={`mt-4 ${panel}`}>
          <h2 className={`${sectionLabel} border-b border-line px-4 py-2`}>
            {t.card.connectionGateTitle}
          </h2>
          <div className="p-4">
            <p className="text-sm">{t.card.connectionGateBody}</p>
            <a href="#plaza-needs" className="mt-2 inline-block text-xs text-ink underline">
              {t.card.connectionGateNeeds}
            </a>
          </div>
        </Card>
      )}

      {groups.map((group) => (
        <Card as="section"
          key={group.title}
          className={`mt-4 ${panel}`}
        >
          <h2 className={`${sectionLabel} border-b border-line px-4 py-2`}>
            {group.title}
          </h2>
          {group.items.map((item, i) => (
            <div
              key={item.key}
              className={`flex min-h-12 items-center justify-between gap-2 px-4 py-2 ${
                i > 0 ? "border-t border-line" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-2xs text-gray">
                    {cardFieldLabel(t, item.key)}
                  </span>
                  {item.visibility === "orgs" && (
                    <span className="font-mono text-3xs text-gray">
                      {cardVisibilityLabel(t, "orgs")}
                    </span>
                  )}
                  {revealSourceByField.get(item.key) && (
                    <span className="font-mono text-3xs text-gray">
                      {fmt(t.card.revealedFromNeed, {
                        title: revealSourceByField.get(item.key)!,
                      })}
                    </span>
                  )}
                </div>
                <div className="truncate font-mono text-sm">
                  {item.value}
                </div>
              </div>
              <CopyButton
                text={item.value!}
                accent={item.key === primaryCopyKey}
              />
            </div>
          ))}
        </Card>
      ))}

      <PlazaNeeds t={t} userId={owner.id} isSelf={isSelf} />
      {viewer && !isSelf && (
        <SafetyActions
          targetType="user"
          targetId={owner.id}
          canBlock
          blocked={blockedByViewer}
        />
      )}
    </div>
  );
}

// 名片页只展示广场公开需求；组织内需求去广场页切范围查看
async function PlazaNeeds({
  t,
  userId,
  isSelf,
}: {
  t: UiDict;
  userId: number;
  isSelf: boolean;
}) {
  const list = await db
    .select()
    .from(needs)
    .where(
      and(
        eq(needs.userId, userId),
        isNull(needs.orgId),
        isNull(needs.deletedAt),
        eq(needs.status, "open"),
        eq(needs.moderationStatus, "visible"),
        or(isNull(needs.expiresAt), gt(needs.expiresAt, new Date())),
      ),
    )
    .orderBy(desc(needs.updatedAt))
    .limit(50);

  return (
    <section id="plaza-needs" className="mt-4">
      <h2 className={sectionLabel}>
        {isSelf ? t.card.plazaNeedsSelf : t.card.plazaNeedsOther}
      </h2>
      {list.length === 0 ? (
        <p className="mt-3 text-xs text-gray">{t.card.plazaNeedsEmpty}</p>
      ) : (
        <Card className={`mt-2 overflow-hidden ${panel}`}>
          {list.map((need, i) => (
            <NeedCard key={need.id} need={need} first={i === 0} />
          ))}
        </Card>
      )}
    </section>
  );
}
