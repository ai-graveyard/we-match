import type { UiDict } from "@/lib/i18n/dict/types";
import { plural } from "@/lib/i18n/fmt";
import type { CardFieldKey, CardFieldVisibility } from "@/lib/card";
import type { ExpiryPreset } from "@/lib/needs";
import type { OrgRole } from "@/lib/orgs";

// 枚举值 → 展示文案。全站唯一的映射处，客户端和服务端都从这里取，
// 免得同一个 status 在三个页面写出三种说法。纯函数，不依赖 next。

type NeedType = "need" | "offer";
type NeedStatus = "open" | "done" | "closed";
type OrgVisibility = "public" | "private";
type RequestVia = "code" | "plaza";
type ConnectionStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "completed"
  | "cancelled";

export function typeLabel(t: UiDict, type: NeedType) {
  return type === "need" ? t.need.typeNeed : t.need.typeOffer;
}

/** 列表徽章里的单字符（中文「需 / 供」，英文 N / O） */
export function typeShort(t: UiDict, type: NeedType) {
  return type === "need" ? t.need.typeNeedShort : t.need.typeOfferShort;
}

/** 第一人称口径，用于发布表单与联系入口 */
export function intentLabel(t: UiDict, type: NeedType) {
  return type === "need" ? t.need.intentNeed : t.need.intentOffer;
}

export function statusLabel(t: UiDict, status: NeedStatus) {
  if (status === "done") return t.need.statusDone;
  if (status === "closed") return t.need.statusClosed;
  return t.need.statusOpen;
}

export function expiryLabel(t: UiDict, preset: ExpiryPreset) {
  const map: Record<ExpiryPreset, string> = {
    day: t.need.expiryDay,
    "three-days": t.need.expiryThreeDays,
    week: t.need.expiryWeek,
    month: t.need.expiryMonth,
    permanent: t.need.expiryPermanent,
  };
  return map[preset];
}

export function orgVisibilityLabel(t: UiDict, visibility: OrgVisibility) {
  return visibility === "public"
    ? t.org.visibilityPublic
    : t.org.visibilityPrivate;
}

export function requestViaLabel(t: UiDict, via: RequestVia) {
  return via === "code" ? t.org.viaCode : t.org.viaPlaza;
}

export function orgRoleEntryLabel(t: UiDict, role: OrgRole) {
  if (role === "owner") return t.org.overviewSettings;
  if (role === "admin") return t.org.overviewManage;
  return t.org.overviewHome;
}

export function cardFieldLabel(t: UiDict, key: CardFieldKey) {
  const map: Record<CardFieldKey, string> = {
    bio: t.card.fieldBio,
    tags: t.card.fieldTags,
    city: t.card.fieldCity,
    wechat: t.card.fieldWechat,
    email: t.card.fieldEmail,
    contactPhone: t.card.fieldContactPhone,
    weixinMp: t.card.fieldWeixinMp,
    weixinChannels: t.card.fieldWeixinChannels,
    xiaohongshu: t.card.fieldXiaohongshu,
    weibo: t.card.fieldWeibo,
  };
  return map[key];
}

export function cardVisibilityLabel(t: UiDict, value: CardFieldVisibility) {
  const map: Record<CardFieldVisibility, string> = {
    public: t.card.visPublic,
    authenticated: t.card.visAuthenticated,
    orgs: t.card.visOrgs,
    hidden: t.card.visHidden,
  };
  return map[value];
}

export function connectionStatusLabel(t: UiDict, status: ConnectionStatus) {
  const map: Record<ConnectionStatus, string> = {
    pending: t.connection.statusPending,
    accepted: t.connection.statusAccepted,
    rejected: t.connection.statusRejected,
    completed: t.connection.statusCompleted,
    cancelled: t.connection.statusCancelled,
  };
  return map[status];
}

/** 联系渠道上的动作词：邮箱写信、手机拨号、其余复制 */
export function contactActionLabel(t: UiDict, key: CardFieldKey) {
  if (key === "email") return t.contact.actionEmail;
  if (key === "contactPhone") return t.contact.actionPhone;
  return t.contact.actionWechat;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 相对时间。中文不分单复数，英文靠字典里的 { one, other } 分。 */
export function relativeTime(t: UiDict, date: Date, now = Date.now()): string {
  const diff = now - date.getTime();
  if (diff < MINUTE) return t.time.justNow;
  if (diff < HOUR) return plural(t.time.minutesAgo, Math.floor(diff / MINUTE));
  if (diff < DAY) return plural(t.time.hoursAgo, Math.floor(diff / HOUR));
  if (diff < 30 * DAY) return plural(t.time.daysAgo, Math.floor(diff / DAY));
  if (diff < 365 * DAY)
    return plural(t.time.monthsAgo, Math.floor(diff / (30 * DAY)));
  return plural(t.time.yearsAgo, Math.floor(diff / (365 * DAY)));
}
