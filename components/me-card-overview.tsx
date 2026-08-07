import type { User } from "@/lib/db/schema";
import {
  CONTACT_FIELDS,
  SOCIAL_FIELDS,
  fieldVisibility,
  visibleCard,
  type CardFieldKey,
} from "@/lib/card";
import { CopyButton } from "@/components/copy-button";
import { DefaultUserAvatar } from "@/components/default-user-avatar";
import { ShareCard } from "@/components/share-card";
import { getDict } from "@/lib/i18n/server";
import { LocaleLink } from "@/lib/i18n/link";
import { cardFieldLabel, cardVisibilityLabel } from "@/lib/i18n/labels";
import type { UiDict } from "@/lib/i18n/dict/types";

function VisibilityLabel({
  t,
  user,
  field,
}: {
  t: UiDict;
  user: User;
  field: CardFieldKey;
}) {
  return (
    <span className="shrink-0 font-mono text-3xs text-gray">
      {cardVisibilityLabel(t, fieldVisibility(user.fieldVisibility, field))}
    </span>
  );
}

export async function MeCardOverview({
  user,
  shareUrl,
}: {
  user: User;
  shareUrl: string;
}) {
  const t = await getDict();
  const publicCard = visibleCard(user, {
    loggedIn: false,
    sharesOrg: false,
  });
  const groups = [
    { title: t.card.groupContact, fields: CONTACT_FIELDS },
    { title: t.card.groupSocial, fields: SOCIAL_FIELDS },
  ]
    .map((group) => ({
      title: group.title,
      items: group.fields
        .map((field) => ({ ...field, value: user[field.key] }))
        .filter((item) => item.value),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <section className="rounded-md border border-line bg-panel p-4">
        <div className="flex items-start gap-3">
          <DefaultUserAvatar className="size-12" iconSize={22} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-base font-semibold">
                {user.nickname}
              </h2>
              {user.city && (
                <>
                  <span className="text-line" aria-hidden>
                    ·
                  </span>
                  <span className="truncate text-xs text-gray">
                    {user.city}
                  </span>
                </>
              )}
            </div>
            {user.bio && <p className="mt-1 text-sm">{user.bio}</p>}
          </div>
          <ShareCard
            data={{
              kind: "user",
              nickname: publicCard.nickname,
              bio: publicCard.bio,
              city: publicCard.city,
              tags: publicCard.tags,
              url: shareUrl,
            }}
          />
        </div>

        {user.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {user.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-2xs text-gray"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 border-t border-line pt-3">
          <LocaleLink
            href={`/u/${user.id}`}
            className="text-xs text-gray transition-colors duration-100 hover:text-ink"
          >
            {t.me.previewPublic}
          </LocaleLink>
          <LocaleLink
            href="/me/card"
            className="ml-auto text-sm font-semibold tracking-[0.06em] hover:underline"
          >
            {t.me.editCard}
          </LocaleLink>
        </div>
      </section>

      {groups.map((group) => (
        <section
          key={group.title}
          className="mt-4 rounded-md border border-line bg-panel"
        >
          <h2 className="border-b border-line px-4 py-2 text-2xs font-semibold tracking-[0.08em] text-gray">
            {group.title}
          </h2>
          {group.items.map((item, index) => (
            <div
              key={item.key}
              className={`flex min-h-12 items-center gap-3 px-4 py-2 ${
                index > 0 ? "border-t border-line" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-2xs text-gray">
                    {cardFieldLabel(t, item.key)}
                  </span>
                  <VisibilityLabel t={t} user={user} field={item.key} />
                </div>
                <div className="truncate font-mono text-sm">
                  {item.value}
                </div>
              </div>
              <CopyButton text={item.value!} />
            </div>
          ))}
        </section>
      ))}

      <p className="mt-3 text-2xs text-gray">{t.me.cardOverviewHint}</p>
    </>
  );
}
