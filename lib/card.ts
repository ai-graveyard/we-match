import type { FieldVisibility, User } from "@/lib/db/schema";

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

// 基本信息字段：两态 public | hidden
export const BASIC_FIELDS = [
  { key: "bio" },
  { key: "tags" },
  { key: "city" },
] as const;

// 联系方式与社媒：三态 authenticated | orgs | hidden
export const CONTACT_FIELDS = [
  { key: "wechat" },
  { key: "email" },
  { key: "contactPhone" },
] as const;

export type ContactFieldKey = (typeof CONTACT_FIELDS)[number]["key"];

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
  | "authenticated"
  | "orgs"
  | "hidden";

const BASIC_KEYS = new Set<string>(BASIC_FIELDS.map((field) => field.key));
const SENSITIVE_FIELDS = [...CONTACT_FIELDS, ...SOCIAL_FIELDS] as const;

export function fieldVisibility(
  visibility: FieldVisibility,
  key: CardFieldKey,
): CardFieldVisibility {
  const stored = visibility[key];
  if (BASIC_KEYS.has(key)) return stored === "hidden" ? "hidden" : "public";
  // 敏感字段缺省为登录可见；历史 public 也安全降级为 authenticated。
  if (stored === "orgs" || stored === "hidden") return stored;
  return "authenticated";
}

// 访问者视角能否看到某字段。sharesOrg：访问者与名片主人是否同属至少一个组织
export function canSee(
  visibility: FieldVisibility,
  key: CardFieldKey,
  viewer: { loggedIn: boolean; sharesOrg: boolean },
): boolean {
  const v = fieldVisibility(visibility, key);
  if (v === "public") return true;
  if (v === "authenticated") return viewer.loggedIn;
  if (v === "orgs") return viewer.loggedIn && viewer.sharesOrg;
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
  for (const field of SENSITIVE_FIELDS) {
    const value = fieldVisibility(visibility, field.key);
    if (value !== "authenticated") normalized[field.key] = value;
  }
  return normalized;
}

export function hasAuthenticatedCardDetails(user: User): boolean {
  return SENSITIVE_FIELDS.some(
    (field) =>
      !!user[field.key] &&
      fieldVisibility(user.fieldVisibility, field.key) === "authenticated",
  );
}

// 他人视角的名片数据：不可见字段直接置空，绝不下发
export function visibleCard(
  user: User,
  viewer: { loggedIn: boolean; sharesOrg: boolean },
) {
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
