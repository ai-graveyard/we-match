import Link from "next/link";
import type { Need } from "@/lib/db/schema";
import { TYPE_LABELS, STATUS_LABELS, isExpired } from "@/lib/needs";
import { shortDateTime } from "@/lib/format";

const TYPE_CHARS = { need: "需", offer: "供" } as const;

export function TypeBadge({ type }: { type: Need["type"] }) {
  return (
    <span
      title={TYPE_LABELS[type]}
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] leading-none ${
        type === "need"
          ? "bg-ink text-panel"
          : "border border-gray text-gray"
      }`}
    >
      {TYPE_CHARS[type]}
    </span>
  );
}

export function StatusBadge({
  need,
}: {
  need: Pick<Need, "status" | "expiresAt">;
}) {
  if (need.status === "open" && !isExpired(need)) return null;
  const label = isExpired(need) ? "已过期" : STATUS_LABELS[need.status];
  return (
    <span className="shrink-0 rounded-sm bg-bg-3 px-1.5 py-px font-mono text-[10px] text-gray">
      {label}
    </span>
  );
}

export function NeedCard({ need, first }: { need: Need; first?: boolean }) {
  return (
    <Link
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
      <div className="mt-1.5 flex items-center gap-2 font-mono text-[11px] text-gray">
        {need.tags.length > 0 && <span>{need.tags.join(" · ")}</span>}
        <span className={need.tags.length > 0 ? "ml-auto shrink-0" : ""}>
          {need.expiresAt ? `截止 ${shortDateTime(need.expiresAt)}` : "永久有效"}
        </span>
      </div>
    </Link>
  );
}
