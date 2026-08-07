import "server-only";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { PHONE_RE } from "@/lib/auth";
import { needs, users, type FieldVisibility, type User } from "@/lib/db/schema";
import {
  BASIC_FIELDS,
  CONTACT_FIELDS,
  SOCIAL_FIELDS,
  LIMITS,
  fieldVisibility,
  normalizedFieldVisibility,
  type CardFieldKey,
} from "@/lib/card";
import { normalizeTags } from "@/lib/tags";
import type { ServerDict } from "@/lib/i18n/dict/types";
import { fmt } from "@/lib/i18n/fmt";

// 名片补丁：网页表单（全量替换）与开放 API（部分更新）共用的校验与落库层

type TextFieldKey =
  | "bio"
  | "city"
  | "wechat"
  | "email"
  | "contactPhone"
  | "weixinMp"
  | "weixinChannels"
  | "xiaohongshu"
  | "weibo";

const TEXT_FIELD_LIMITS: Record<TextFieldKey, number> = {
  bio: LIMITS.bio,
  city: LIMITS.city,
  wechat: LIMITS.value,
  email: LIMITS.value,
  contactPhone: LIMITS.value,
  weixinMp: LIMITS.value,
  weixinChannels: LIMITS.value,
  xiaohongshu: LIMITS.value,
  weibo: LIMITS.value,
};

export type CardPatch = Partial<Record<TextFieldKey, string | null>> & {
  nickname?: string;
  tags?: string[];
  fieldVisibility?: FieldVisibility; // 整体替换，不做逐键合并
};

// unknown 输入 → 合法补丁或错误。只校验出现的键；各类字段只存非默认档。
export function validateCardPatch(
  input: Record<string, unknown>,
  t: ServerDict,
): { error: string } | { patch: CardPatch } {
  const patch: CardPatch = {};

  if (input.nickname !== undefined) {
    const nickname = String(input.nickname ?? "").trim();
    if (!nickname) return { error: t.card.emptyNickname };
    if (nickname.length > LIMITS.nickname)
      return { error: fmt(t.card.nicknameTooLong, { max: LIMITS.nickname }) };
    patch.nickname = nickname;
  }

  for (const key of Object.keys(TEXT_FIELD_LIMITS) as TextFieldKey[]) {
    if (input[key] === undefined) continue;
    patch[key] =
      String(input[key] ?? "")
        .trim()
        .slice(0, TEXT_FIELD_LIMITS[key]) || null;
  }

  // 只支持中国大陆手机号（与登录一致），留空可以
  if (patch.contactPhone && !PHONE_RE.test(patch.contactPhone))
    return { error: t.card.badContactPhone };

  if (input.tags !== undefined) {
    const tags = normalizeTags(input.tags, {
      count: LIMITS.tagCount,
      length: LIMITS.tagLength,
    });
    if (!tags) return { error: t.common.badTags };
    patch.tags = tags;
  }

  if (input.fieldVisibility !== undefined) {
    const raw = input.fieldVisibility;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
      return { error: t.card.badVisibilityObject };
    const visibility: FieldVisibility = {};
    const basicKeys = new Set<string>(BASIC_FIELDS.map((f) => f.key));
    const threeStateKeys = new Set<string>(
      [...CONTACT_FIELDS, ...SOCIAL_FIELDS].map((f) => f.key),
    );
    for (const [key, value] of Object.entries(raw)) {
      if (basicKeys.has(key)) {
        if (value === "public") continue;
        if (value === "hidden") {
          visibility[key as CardFieldKey] = "hidden";
          continue;
        }
      }
      if (threeStateKeys.has(key)) {
        // public 是旧客户端的兼容别名，安全解释成默认 authenticated。
        if (value === "authenticated" || value === "public") continue;
        if (value === "orgs" || value === "hidden") {
          visibility[key as CardFieldKey] = value;
          continue;
        }
      }
      return {
        error: fmt(t.card.badVisibilityValue, { key, value: String(value) }),
      };
    }
    patch.fieldVisibility = normalizedFieldVisibility(visibility);
  }

  return { patch };
}

// 应用补丁；返回更新后的用户与可联系性提醒（非阻断）
export async function applyCardPatch(
  user: User,
  patch: CardPatch,
  t: ServerDict,
): Promise<{ user: User; warning?: string }> {
  const [updated] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, user.id))
    .returning();

  // 可联系性提醒：有开放需求但受众看不到任何联系方式
  const vis = (key: (typeof CONTACT_FIELDS)[number]["key"]) =>
    fieldVisibility(updated.fieldVisibility, key);
  const hasAuthenticated = CONTACT_FIELDS.some(
    (f) => updated[f.key] && vis(f.key) === "authenticated",
  );
  const hasOrgVisible = CONTACT_FIELDS.some(
    (f) => updated[f.key] && vis(f.key) !== "hidden",
  );
  let warning: string | undefined;
  if (!hasAuthenticated) {
    const [plazaNeed] = await db
      .select({ id: needs.id })
      .from(needs)
      .where(
        and(
          eq(needs.userId, user.id),
          eq(needs.status, "open"),
          isNull(needs.orgId),
        ),
      )
      .limit(1);
    if (plazaNeed) {
      return { user: updated, warning: t.card.warnNoPlazaContact };
    }
  }
  if (!hasOrgVisible) {
    const [orgNeed] = await db
      .select({ id: needs.id })
      .from(needs)
      .where(
        and(
          eq(needs.userId, user.id),
          eq(needs.status, "open"),
          isNotNull(needs.orgId),
        ),
      )
      .limit(1);
    if (orgNeed) {
      warning = t.card.warnNoOrgContact;
    }
  }
  return { user: updated, warning };
}
