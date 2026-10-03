
import { Badge } from "@/components/ui/badge";
import type { Need, User } from "@/lib/db/schema";
import { isExpired } from "@/lib/needs";
import { shortDateTime } from "@/lib/format";
import { getDict } from "@/lib/i18n/server";
import { LocaleLink } from "@/lib/i18n/link";
import { fmt } from "@/lib/i18n/fmt";
import {
  relativeTime,
  statusLabel,
  typeLabel,
  typeShort,
} from "@/lib/i18n/labels";
import type { UiDict } from "@/lib/i18n/dict/types";
import { badge } from "@/lib/ui";

export async function TypeBadge({ type }: { type: Need["type"] }) {
  const t = await getDict();
  return (
    <span
      title={typeLabel(t, type)}
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-3xs leading-none ${
        type === "need"
          ? "bg-ink text-panel"
          : "border border-gray text-gray"
      }`}
    >
      {typeShort(t, type)}
    </span>
  );
}

export async function StatusBadge({
  need,
}: {
  need: Pick<Need, "status" | "expiresAt">;
}) {
  if (need.status === "open" && !isExpired(need)) return null;
  const t = await getDict();
  const label = isExpired(need)
    ? t.need.statusExpired
    : statusLabel(t, need.status);
  return (
    <Badge className={badge}>
      {label}
    </Badge>
  );
}

/** 列表卡片右下角的期限：有截止时间就写截止，否则「永久有效」 */
export function deadlineText(t: UiDict, expiresAt: Date | null) {
  return expiresAt
    ? fmt(t.need.deadlineAt, { time: shortDateTime(expiresAt) })
    : t.need.permanent;
}

type NeedCardAuthor = Pick<User, "nickname" | "city">;

/**
 * 广场卡片需要在点开前给足第一次判断所需的信息；本人需求和名片内的附属列表则继续
 * 使用紧凑形态，避免重复显示发布者。author 既是数据，也是两种信息密度的明确开关。
 */
export async function NeedCard({
  need,
  author,
  first,
}: {
  need: Need;
  author?: NeedCardAuthor;
  first?: boolean;
}) {
  const t = await getDict();

  if (author) {
    return (
      <LocaleLink
        href={`/needs/${need.id}`}
        className={`group block px-4 py-4 transition-colors duration-100 hover:bg-bg-3 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-3px] focus-visible:outline-ink ${
          first ? "" : "border-t border-line"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex h-5 shrink-0 items-center rounded-sm px-1.5 font-mono text-3xs ${
              need.type === "need"
                ? "bg-ink text-panel"
                : "border border-line text-gray"
            }`}
          >
            {typeLabel(t, need.type)}
          </span>
          <span className="min-w-0 truncate text-xs text-gray">
            {author.nickname}
          </span>
          {author.city && (
            <span className="min-w-0 truncate text-2xs text-gray">
              {author.city}
            </span>
          )}
          <span className="ml-auto shrink-0 font-mono text-3xs text-gray">
            {relativeTime(t, need.updatedAt)}
          </span>
        </div>

        <div className="mt-2 flex items-start gap-2">
          <h2 className="min-w-0 flex-1 break-words text-base font-semibold leading-snug">
            {need.title}
          </h2>
          <StatusBadge need={need} />
        </div>
        {need.description && (
          <p className="mt-2 line-clamp-2 break-words text-sm leading-relaxed text-gray">
            {need.description}
          </p>
        )}

        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {need.tags.length > 0 && (
            <span className="min-w-0 truncate font-mono text-2xs text-gray">
              {need.tags.join(" · ")}
            </span>
          )}
          <span className="ml-auto font-mono text-3xs text-gray">
            {deadlineText(t, need.expiresAt)}
          </span>
        </div>
      </LocaleLink>
    );
  }

  return (
    <LocaleLink
      href={`/needs/${need.id}`}
      className={`block px-4 py-3 transition-colors duration-100 hover:bg-bg-3 ${
        first ? "" : "border-t border-line"
      }`}
    >
      <div className="flex items-center gap-2">
        <TypeBadge type={need.type} />
        <span className="min-w-0 truncate text-sm font-semibold">
          {need.title}
        </span>
        <StatusBadge need={need} />
      </div>
      <div className="mt-1.5 flex items-center gap-2 font-mono text-2xs text-gray">
        {need.tags.length > 0 && <span>{need.tags.join(" · ")}</span>}
        <span className={need.tags.length > 0 ? "ml-auto shrink-0" : ""}>
          {deadlineText(t, need.expiresAt)}
        </span>
      </div>
    </LocaleLink>
  );
}
