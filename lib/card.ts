import type { FieldVisibility, User } from "@/lib/db/schema";

// 名片的常量、可见性规则与对外投影，全是纯函数；写库在 lib/card-service.ts。
// 全站命名约定：lib/X.ts = 常量 + 纯函数/校验，lib/X-service.ts = 有 IO 的写路径。

// PRD 3.2：字段上限
export const LIMITS = {
  nickname: 20,
  bio: 100,
  city: 20,
  tagCount: 10,
  tagLength: 20,
  value: 100, // 联系方式/社媒单值
} as const;

// 字段展示名在 lib/i18n/labels.ts 的 cardFieldLabel()，这里只留结构

// 名片上的 contactPhone 用；登录身份是邮箱，与这里无关
export const PHONE_RE = /^1[3-9]\d{9}$/;

// 基本信息字段：两态 public | hidden
export const BASIC_FIELDS = [
  { key: "bio" },
  { key: "tags" },
  { key: "city" },
] as const;

// 联系方式：四态 connected | authenticated | orgs | hidden，缺省 connected
export const CONTACT_FIELDS = [
  { key: "wechat" },
  { key: "email" },
  { key: "contactPhone" },
] as const;

export type ContactFieldKey = (typeof CONTACT_FIELDS)[number]["key"];

// 社媒：三态 authenticated | orgs | hidden，缺省 authenticated
export const SOCIAL_FIELDS = [
  { key: "weixinMp" },
  { key: "weixinChannels" },
  { key: "xiaohongshu" },
  { key: "weibo" },
] as const;

export type CardFieldKey =
  | (typeof BASIC_FIELDS)[number]["key"]
  | (typeof CONTACT_FIELDS)[number]["key"]
  | (typeof SOCIAL_FIELDS)[number]["key"];

export type CardFieldVisibility =
  | "public"
  | "connected"
  | "authenticated"
  | "orgs"
  | "hidden";

export type CardViewer = {
  loggedIn: boolean;
  sharesOrg: boolean;
  revealedFields?: ReadonlySet<string>;
};

const BASIC_KEYS = new Set<string>(BASIC_FIELDS.map((field) => field.key));
const CONTACT_KEYS = new Set<string>(CONTACT_FIELDS.map((field) => field.key));
const SENSITIVE_FIELDS = [...CONTACT_FIELDS, ...SOCIAL_FIELDS] as const;

export function fieldVisibility(
  visibility: FieldVisibility,
  key: CardFieldKey,
): CardFieldVisibility {
  const stored = visibility[key];
  if (BASIC_KEYS.has(key)) return stored === "hidden" ? "hidden" : "public";
  if (stored === "orgs" || stored === "hidden") return stored;
  if (CONTACT_KEYS.has(key)) {
    // 未记录 / 历史 public / 显式 connected → 连接后可见。
    // 存量 authenticated 只有用户自己点过才会写进 JSON，予以保留。
    if (stored === "authenticated") return "authenticated";
    return "connected";
  }
  // 社媒：历史 public 降为 authenticated
  return "authenticated";
}

// 访问者视角能否看到某字段。revealedFields：对方通过连接交换给访问者的联系方式键
export function canSee(
  visibility: FieldVisibility,
  key: CardFieldKey,
  viewer: CardViewer,
): boolean {
  const v = fieldVisibility(visibility, key);
  if (v === "public") return true;
  if (v === "authenticated") return viewer.loggedIn;
  if (v === "orgs") return viewer.loggedIn && viewer.sharesOrg;
  if (v === "connected") return viewer.revealedFields?.has(key) ?? false;
  return false;
}

export function normalizedFieldVisibility(
  visibility: FieldVisibility,
): FieldVisibility {
  const normalized: FieldVisibility = {};
  for (const field of BASIC_FIELDS) {
    if (fieldVisibility(visibility, field.key) === "hidden") {
      normalized[field.key] = "hidden";
    }
  }
  for (const field of CONTACT_FIELDS) {
    const value = fieldVisibility(visibility, field.key);
    if (value !== "connected") normalized[field.key] = value;
  }
  for (const field of SOCIAL_FIELDS) {
    const value = fieldVisibility(visibility, field.key);
    if (value !== "authenticated") normalized[field.key] = value;
  }
  return normalized;
}

export function hasLoginVisibleCardDetails(user: User): boolean {
  return SENSITIVE_FIELDS.some((field) => {
    if (!user[field.key]) return false;
    return fieldVisibility(user.fieldVisibility, field.key) === "authenticated";
  });
}

/** @deprecated 用 hasLoginVisibleCardDetails */
export const hasAuthenticatedCardDetails = hasLoginVisibleCardDetails;

export function countConnectedContacts(user: User): number {
  return CONTACT_FIELDS.filter(
    (field) =>
      !!user[field.key] &&
      fieldVisibility(user.fieldVisibility, field.key) === "connected",
  ).length;
}

export function hasUnrevealedConnectedContacts(user: User): boolean {
  return countConnectedContacts(user) > 0;
}

// 他人视角的名片数据：不可见字段直接置空，绝不下发
export function visibleCard(user: User, viewer: CardViewer) {
  const vis = user.fieldVisibility;
  const pick = (key: CardFieldKey, value: string | null) =>
    value && canSee(vis, key, viewer) ? value : null;
  return {
    id: user.id,
    nickname: user.nickname, // 昵称始终公开
    bio: pick("bio", user.bio),
    city: pick("city", user.city),
    tags: canSee(vis, "tags", viewer) ? user.tags : [],
    contacts: CONTACT_FIELDS.map((f) => ({
      key: f.key,
      value: pick(f.key, user[f.key]),
      visibility: fieldVisibility(vis, f.key),
    })).filter((f) => f.value),
    socials: SOCIAL_FIELDS.map((f) => ({
      key: f.key,
      value: pick(f.key, user[f.key]),
      visibility: fieldVisibility(vis, f.key),
    })).filter((f) => f.value),
  };
}
