
import { Badge } from "@/components/ui/badge";

import { Card } from "@/components/ui/card";
import { getDict } from "@/lib/i18n/server";
import { LocaleLink } from "@/lib/i18n/link";
import { fmt } from "@/lib/i18n/fmt";
import { connectionStatusLabel, relativeTime } from "@/lib/i18n/labels";
import type { UiDict } from "@/lib/i18n/dict/types";
import type { ConnectionStatus } from "@/components/connection-panel";
import {
  isStalePending,
  QUOTAS,
  type QuotaLine,
  type QuotaStockLine,
  type QuotaSummary,
} from "@/lib/quota";
import { badge, panel, sectionLabel, statusDot } from "@/lib/ui";

type Hand = {
  id: number;
  needId: number;
  needTitle: string;
  otherName: string;
  status: ConnectionStatus;
  createdAt: Date;
};

function dailyLabel(t: UiDict, key: QuotaLine["key"]) {
  if (key === "need.publish") return t.quota.dailyPublish;
  if (key === "connection.create") return t.quota.dailyRaise;
  return t.quota.dailyAccept;
}

function stockLabel(t: UiDict, key: QuotaStockLine["key"]) {
  const map: Record<QuotaStockLine["key"], string> = {
    openNeeds: t.quota.stockOpenNeeds,
    pendingHands: t.quota.stockPendingHands,
    acceptedOpen: t.quota.stockAcceptedOpen,
    incomingPending: t.quota.stockIncomingPending,
    pendingJoinRequests: t.quota.stockPendingJoins,
  };
  return map[key];
}

/* 计数一律 --mono，额度提示走 --gray：焦橙只留给当屏主控件（DESIGN.md 焦橙纪律） */
function Row({
  label,
  value,
  hint,
  first,
}: {
  label: string;
  value: string;
  hint?: string;
  first: boolean;
}) {
  return (
    <div
      className={`flex min-h-12 items-center gap-4 px-4 py-2 ${
        first ? "" : "border-t border-line"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{label}</span>
        {hint && <span className="mt-0.5 block text-2xs text-gray">{hint}</span>}
      </span>
      <span className="shrink-0 font-mono text-2xs text-gray">{value}</span>
    </div>
  );
}

async function HandList({ hands, empty }: { hands: Hand[]; empty: string }) {
  const t = await getDict();
  if (hands.length === 0) {
    return <p className="mt-2 text-2xs text-gray">{empty}</p>;
  }
  return (
    <Card className={`mt-2 overflow-hidden ${panel}`}>
      {hands.map((hand, index) => {
        const stale = isStalePending(hand.status, hand.createdAt);
        return (
          <LocaleLink
            key={hand.id}
            href={`/needs/${hand.needId}`}
            className={`flex min-h-14 items-center gap-3 px-4 py-2 transition-colors duration-100 hover:bg-bg-3 ${
              index === 0 ? "" : "border-t border-line"
            }`}
          >
            {stale && <i className={statusDot} aria-hidden />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {hand.needTitle}
              </span>
              <span className="mt-0.5 block truncate text-2xs text-gray">
                {hand.otherName} · {relativeTime(t, hand.createdAt)}
              </span>
            </span>
            <Badge className={`${badge} shrink-0`}>
              {connectionStatusLabel(t, hand.status, stale)}
            </Badge>
          </LocaleLink>
        );
      })}
    </Card>
  );
}

export async function QuotaPanel({
  summary,
  incomingHands,
  outgoingHands,
}: {
  summary: QuotaSummary;
  incomingHands: Hand[];
  outgoingHands: Hand[];
}) {
  const t = await getDict();

  return (
    <section>
      <p className="text-2xs leading-5 text-gray">{t.quota.intro}</p>

      <h2 className={`mt-4 ${sectionLabel}`}>{t.quota.dailyHeading}</h2>
      <Card className={`mt-2 overflow-hidden ${panel}`}>
        {summary.daily.map((line, index) => (
          <Row
            key={line.key}
            first={index === 0}
            label={dailyLabel(t, line.key)}
            value={fmt(t.quota.used, { used: line.used, max: line.limit })}
            hint={
              line.penalty
                ? t.quota.penaltyHint
                : line.limit > line.base
                  ? fmt(t.quota.earnedHint, { n: line.limit - line.base })
                  : undefined
            }
          />
        ))}
      </Card>
      <p className="mt-2 text-2xs text-gray">{t.quota.resetHint}</p>
      {!summary.regular && (
        <p className="mt-1 text-2xs leading-5 text-gray">
          {fmt(t.quota.newbieHint, {
            newbie: QUOTAS.daily["need.publish"].newbie,
            regular: QUOTAS.daily["need.publish"].regular,
          })}
          <LocaleLink href="/me/card" className="ml-1 text-ink underline">
            {t.quota.newbieHintLink}
          </LocaleLink>
        </p>
      )}

      <h2 className={`mt-6 ${sectionLabel}`}>{t.quota.stockHeading}</h2>
      <Card className={`mt-2 overflow-hidden ${panel}`}>
        {summary.stock.map((line, index) => (
          <Row
            key={line.key}
            first={index === 0}
            label={stockLabel(t, line.key)}
            value={fmt(t.quota.used, { used: line.used, max: line.max })}
          />
        ))}
      </Card>

      <h2 className={`mt-6 ${sectionLabel}`}>{t.quota.handsHeading}</h2>
      {summary.staleIncoming > 0 && (
        <p className="mt-1 text-2xs leading-5 text-gray">
          {t.quota.handsRenewalLocked}
        </p>
      )}
      <HandList hands={incomingHands} empty={t.quota.handsEmpty} />

      <h2 className={`mt-6 ${sectionLabel}`}>{t.quota.myHandsHeading}</h2>
      <HandList hands={outgoingHands} empty={t.quota.myHandsEmpty} />

      <LocaleLink
        href="/me/connections?view=received"
        className={`mt-4 flex h-12 items-center gap-2 ${panel} px-4 text-sm font-semibold transition-colors duration-100 hover:bg-bg-3`}
      >
        {t.connection.viewAll}
        <span className="ml-auto shrink-0 font-mono text-2xs text-gray">
          {t.common.enter}
        </span>
      </LocaleLink>
    </section>
  );
}
