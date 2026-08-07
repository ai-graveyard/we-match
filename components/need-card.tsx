import type { Need } from "@/lib/db/schema";
import { isExpired } from "@/lib/needs";
import { shortDateTime } from "@/lib/format";
import { getDict } from "@/lib/i18n/server";
import { LocaleLink } from "@/lib/i18n/link";
import { fmt } from "@/lib/i18n/fmt";
import { statusLabel, typeLabel, typeShort } from "@/lib/i18n/labels";
import type { UiDict } from "@/lib/i18n/dict/types";

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
    <span className="shrink-0 rounded-sm bg-bg-3 px-1.5 py-px font-mono text-3xs text-gray">
      {label}
    </span>
  );
}

/** 列表卡片右下角的期限：有截止时间就写截止，否则「永久有效」 */
export function deadlineText(t: UiDict, expiresAt: Date | null) {
  return expiresAt
    ? fmt(t.need.deadlineAt, { time: shortDateTime(expiresAt) })
    : t.need.permanent;
}

export async function NeedCard({ need, first }: { need: Need; first?: boolean }) {
  const t = await getDict();
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
