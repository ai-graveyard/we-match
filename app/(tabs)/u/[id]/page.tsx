import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { blocks, needs, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { sharesOrg } from "@/lib/queries";
import { hasAuthenticatedCardDetails, visibleCard } from "@/lib/card";
import { CopyButton } from "@/components/copy-button";
import { NeedCard } from "@/components/need-card";
import { PageHeader } from "@/components/page-header";
import { DefaultUserAvatar } from "@/components/default-user-avatar";
import { ShareCard } from "@/components/share-card";
import { siteOrigin } from "@/lib/site-url";
import { SafetyActions } from "@/components/safety-actions";

type PreviewView = "guest" | "user" | "org";

const PREVIEW_VIEWS: { value: PreviewView; label: string }[] = [
  { value: "guest", label: "未登录访客" },
  { value: "user", label: "已登录用户" },
  { value: "org", label: "共同组织成员" },
];

export async function generateMetadata({
  params,
}: PageProps<"/u/[id]">): Promise<Metadata> {
  const { id } = await params;
  const uid = Number(id);
  if (!Number.isInteger(uid) || uid <= 0) return { title: "名片详情" };
  const [owner] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
  if (!owner) return { title: "名片详情" };
  const card = visibleCard(owner, { loggedIn: false, sharesOrg: false });
  const title = `${card.nickname}的名片`;
  const description = card.bio || `查看 ${card.nickname} 的公开名片与需求`;
  return {
    title,
    description,
    openGraph: {
      title: `${title} · We Match`,
      description,
      type: "profile",
    },
  };
}

export default async function UserCardPage({
  params,
  searchParams,
}: PageProps<"/u/[id]">) {
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
  const audience = isSelf
    ? {
        loggedIn: previewView !== "guest",
        sharesOrg: previewView === "org",
      }
    : { loggedIn: !!viewer, sharesOrg: !!shared };
  const card = visibleCard(owner, audience);
  const publicCard = visibleCard(owner, {
    loggedIn: false,
    sharesOrg: false,
  });
  const origin = await siteOrigin();
  const showLoginGate =
    !audience.loggedIn && hasAuthenticatedCardDetails(owner);

  const groups = [
    { title: "联系方式", items: card.contacts },
    { title: "社媒账号", items: card.socials },
  ].filter((g) => g.items.length > 0);
  const primaryCopyKey = groups[0]?.items[0]?.key;

  return (
    <div>
      <PageHeader title="名片详情" mobileOnly className="mb-4" />
      {isSelf && (
        <section className="mb-4 rounded-md border border-line bg-panel p-3">
          <div className="inline-flex w-full overflow-hidden rounded-sm border border-line">
            {PREVIEW_VIEWS.map((option, index) => (
              <Link
                key={option.value}
                href={`/u/${owner.id}?view=${option.value}`}
                replace
                className={`flex h-9 flex-1 items-center justify-center px-2 text-center text-[11px] transition-colors duration-100 ${
                  index > 0 ? "border-l border-line" : ""
                } ${
                  previewView === option.value
                    ? "bg-ink font-semibold text-panel"
                    : "text-gray hover:text-ink"
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-gray">
            <span>正在预览该身份看到的版本</span>
            <Link href="/me/card" className="shrink-0 text-ink underline">
              编辑名片
            </Link>
          </div>
        </section>
      )}
      <section className="rounded-md border border-line bg-panel p-4">
        <div className="flex items-center gap-3">
          <DefaultUserAvatar className="size-12" iconSize={22} />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">{card.nickname}</h1>
            {card.city && <p className="text-xs text-gray">{card.city}</p>}
          </div>
          <div className="ml-auto">
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
                className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-[11px] text-gray"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </section>

      {showLoginGate && (
        <section className="mt-4 rounded-md border border-line bg-panel">
          <h2 className="border-b border-line px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-gray">
            联系方式与社媒
          </h2>
          <div className="p-4">
            <p className="text-sm">登录后可查看对方向已登录用户开放的联系方式与社媒</p>
            <Link
              href={
                isSelf
                  ? `/u/${owner.id}?view=user`
                  : `/login?next=${encodeURIComponent(`/u/${owner.id}`)}`
              }
              className="mt-3 flex h-10 w-full items-center justify-center rounded-sm bg-accent text-xs font-semibold tracking-[0.08em] text-panel active:translate-y-px"
            >
              登录后查看
            </Link>
          </div>
        </section>
      )}

      {groups.map((group) => (
        <section
          key={group.title}
          className="mt-4 rounded-md border border-line bg-panel"
        >
          <h2 className="border-b border-line px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-gray">
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
                  <span className="text-[11px] text-gray">{item.label}</span>
                  {item.visibility === "orgs" && (
                    <span className="font-mono text-[10px] text-gray">
                      共同组织可见
                    </span>
                  )}
                </div>
                <div className="truncate font-mono text-[13px]">
                  {item.value}
                </div>
              </div>
              <CopyButton
                text={item.value!}
                accent={item.key === primaryCopyKey}
              />
            </div>
          ))}
        </section>
      ))}

      <PlazaNeeds userId={owner.id} isSelf={isSelf} />
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
  userId,
  isSelf,
}: {
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
        eq(needs.status, "open"),
        eq(needs.moderationStatus, "visible"),
        or(isNull(needs.expiresAt), gt(needs.expiresAt, new Date())),
      ),
    )
    .orderBy(desc(needs.updatedAt))
    .limit(50);

  return (
    <section className="mt-4">
      <h2 className="text-[11px] font-semibold tracking-[0.08em] text-gray">
        {isSelf ? "我的广场需求" : "对方的广场需求"}
      </h2>
      {list.length === 0 ? (
        <p className="mt-3 text-xs text-gray">暂无广场需求</p>
      ) : (
        <div className="mt-2 rounded-md border border-line bg-panel">
          {list.map((need, i) => (
            <NeedCard key={need.id} need={need} first={i === 0} />
          ))}
        </div>
      )}
    </section>
  );
}
