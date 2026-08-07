import "server-only";
import { and, count, eq, gt, gte, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { connections, needs, type Need, type User } from "@/lib/db/schema";
import { getMembership } from "@/lib/queries";
import {
  CONTACT_FIELDS,
  fieldVisibility,
  type ContactFieldKey,
} from "@/lib/card";
import { NEED_LIMITS } from "@/lib/needs";
import { normalizeTags } from "@/lib/tags";
import { notify, track } from "@/lib/activity";
import type { ServerDict } from "@/lib/i18n/dict/types";
import { fmt } from "@/lib/i18n/fmt";

// 需求字段补丁：网页表单（全量）与开放 API（部分）共用的校验与落库层

export type NeedPatch = {
  type?: "need" | "offer";
  title?: string;
  description?: string | null;
  tags?: string[];
  preferredContact?: ContactFieldKey | null;
  status?: "open" | "done" | "closed";
  expiresAt?: Date | null;
};

// unknown 输入 → 合法补丁或错误。requireCore：创建/整单编辑时 type 与 title 必填
export function validateNeedPatch(
  input: Record<string, unknown>,
  { requireCore }: { requireCore: boolean },
  t: ServerDict,
): { error: string } | { patch: NeedPatch } {
  const patch: NeedPatch = {};

  if (input.type !== undefined || requireCore) {
    if (input.type !== "need" && input.type !== "offer")
      return { error: t.need.badType };
    patch.type = input.type;
  }
  if (input.title !== undefined || requireCore) {
    const title = String(input.title ?? "").trim();
    if (!title) return { error: t.need.emptyTitle };
    if (title.length > NEED_LIMITS.title)
      return { error: fmt(t.need.titleTooLong, { max: NEED_LIMITS.title }) };
    patch.title = title;
  }
  if (input.description !== undefined) {
    patch.description =
      String(input.description ?? "")
        .trim()
        .slice(0, NEED_LIMITS.description) || null;
  }
  if (input.tags !== undefined) {
    const tags = normalizeTags(input.tags, {
      count: NEED_LIMITS.tagCount,
      length: NEED_LIMITS.tagLength,
    });
    if (!tags) return { error: t.common.badTags };
    patch.tags = tags;
  }
  if (input.preferredContact !== undefined) {
    if (input.preferredContact === null || input.preferredContact === "") {
      patch.preferredContact = null;
    } else if (
      input.preferredContact === "wechat" ||
      input.preferredContact === "email" ||
      input.preferredContact === "contactPhone"
    ) {
      patch.preferredContact = input.preferredContact;
    } else {
      return { error: t.need.badPreferredContact };
    }
  }
  if (input.status !== undefined) {
    if (
      input.status !== "open" &&
      input.status !== "done" &&
      input.status !== "closed"
    )
      return { error: t.need.badStatus };
    patch.status = input.status;
  }
  if (input.expiresAt !== undefined || requireCore) {
    if (input.expiresAt === null) {
      patch.expiresAt = null;
    } else {
      const expiresAt = new Date(String(input.expiresAt ?? ""));
      if (Number.isNaN(expiresAt.getTime()))
        return { error: t.need.missingExpiry };
      if (expiresAt.getTime() <= Date.now())
        return { error: t.need.expiryInPast };
      patch.expiresAt = expiresAt;
    }
  }
  return { patch };
}

// 发布前的可联系性校验：广场需求要有登录可见联系方式，组织需求可额外使用共同组织可见档。
export function canBeContacted(user: User, scope: "plaza" | "org"): boolean {
  return contactableFields(user, scope).length > 0;
}

export function contactableFields(
  user: User,
  scope: "plaza" | "org",
): (typeof CONTACT_FIELDS)[number][] {
  return CONTACT_FIELDS.filter((f) => {
    if (!user[f.key]) return false;
    const vis = fieldVisibility(user.fieldVisibility, f.key);
    return scope === "plaza" ? vis === "authenticated" : vis !== "hidden";
  });
}

export function resolvePreferredContact(
  user: User,
  scope: "plaza" | "org",
  requested?: ContactFieldKey | null,
): ContactFieldKey | null {
  const available = contactableFields(user, scope);
  if (requested && available.some((field) => field.key === requested)) {
    return requested;
  }
  return available[0]?.key ?? null;
}

export async function createNeed(
  user: User,
  patch: NeedPatch,
  orgId: number | null,
  t: ServerDict,
): Promise<{ error: string } | { need: Need }> {
  if (orgId != null) {
    if (!Number.isInteger(orgId) || orgId <= 0)
      return { error: t.need.badScope };
    if (!(await getMembership(orgId, user.id)))
      return { error: t.need.notOrgMember };
  }

  if (!canBeContacted(user, orgId ? "org" : "plaza")) {
    return {
      error: orgId ? t.need.noOrgContact : t.need.noPlazaContact,
    };
  }

  const preferredContact = resolvePreferredContact(
    user,
    orgId ? "org" : "plaza",
    patch.preferredContact,
  );
  if (patch.preferredContact && preferredContact !== patch.preferredContact) {
    return { error: t.need.preferredContactUnavailable };
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const [todayCount] = await db
    .select({ n: count() })
    .from(needs)
    .where(and(eq(needs.userId, user.id), gte(needs.createdAt, dayStart)));
  if ((todayCount?.n ?? 0) >= NEED_LIMITS.dailyPublish) {
    return {
      error: fmt(t.need.dailyLimit, { max: NEED_LIMITS.dailyPublish }),
    };
  }

  const [need] = await db
    .insert(needs)
    .values({
      userId: user.id,
      orgId,
      type: patch.type!,
      title: patch.title!,
      description: patch.description ?? null,
      tags: patch.tags ?? [],
      preferredContact,
      expiresAt: patch.expiresAt ?? null,
    })
    .returning();
  await track({
    name: "need_created",
    userId: user.id,
    entityType: "need",
    entityId: need.id,
    metadata: { scope: orgId == null ? "plaza" : "org" },
  });

  if (need.tags.length > 0) {
    const tagConditions = need.tags.map((tag) => sql`${needs.tags} LIKE ${`%${tag}%`}`);
    const [matchCount] = await db
      .select({ n: count() })
      .from(needs)
      .where(
        and(
          ne(needs.id, need.id),
          eq(needs.type, need.type === "need" ? "offer" : "need"),
          orgId == null ? isNull(needs.orgId) : eq(needs.orgId, orgId),
          eq(needs.status, "open"),
          eq(needs.moderationStatus, "visible"),
          or(isNull(needs.expiresAt), gt(needs.expiresAt, new Date())),
          or(...tagConditions),
        ),
      );
    if ((matchCount?.n ?? 0) > 0) {
      await notify({
        userId: user.id,
        payload: {
          type: "matches_available",
          n: matchCount.n,
          need: need.title,
        },
        href: `/?type=${need.type === "need" ? "offer" : "need"}&tag=${encodeURIComponent(need.tags[0])}`,
      });
    }
  }
  return { need };
}

export async function getOwnNeed(
  userId: number,
  id: number,
): Promise<Need | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [need] = await db.select().from(needs).where(eq(needs.id, id)).limit(1);
  if (!need || need.userId !== userId) return null;
  return need;
}

// 应用补丁并刷新内容更新时间；截止时间只在补丁明确传入时改变
export async function applyNeedPatch(
  need: Need,
  patch: NeedPatch,
): Promise<Need> {
  const [updated] = await db
    .update(needs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(needs.id, need.id))
    .returning();
  return updated;
}

export async function deleteNeed(need: Need): Promise<void> {
  await db.delete(connections).where(eq(connections.needId, need.id));
  await db.delete(needs).where(eq(needs.id, need.id));
}
