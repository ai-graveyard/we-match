import "server-only";
import { and, count, eq, gte, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, connections, needs, users, type Need, type User } from "@/lib/db/schema";
import { validatePublishingContact, type PublishingContact } from "@/lib/publishing-contact";
import { getMembership } from "@/lib/queries";
import {
  CONTACT_FIELDS,
  fieldVisibility,
  type ContactFieldKey,
} from "@/lib/card";
import { NEED_LIMITS } from "@/lib/needs";
import { normalizeTags } from "@/lib/tags";
import { track } from "@/lib/activity";
import { notifyMatchesForNewNeed } from "@/lib/matches";
import { checkQuota, effectiveDailyLimit } from "@/lib/quota";
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
    return scope === "plaza"
      ? vis === "connected" || vis === "authenticated"
      : vis !== "hidden";
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

function sameIdempotentCreation(
  existing: Need,
  patch: NeedPatch,
  orgId: number | null,
  preferredContact: ContactFieldKey | null,
): boolean {
  return (
    existing.type === patch.type &&
    existing.title === patch.title &&
    existing.description === (patch.description ?? null) &&
    JSON.stringify(existing.tags) === JSON.stringify(patch.tags ?? []) &&
    existing.orgId === orgId &&
    existing.preferredContact === preferredContact &&
    (existing.expiresAt?.getTime() ?? null) ===
      (patch.expiresAt?.getTime() ?? null)
  );
}

export async function createNeed(
  user: User,
  patch: NeedPatch,
  orgId: number | null,
  t: ServerDict,
  options: { idempotencyKey?: string | null; publishingContact?: PublishingContact } = {},
): Promise<{ error: string } | { need: Need; replayed: boolean }> {
  const originalUser = user;
  let contact = options.publishingContact;
  if (contact) {
    const validated = validatePublishingContact(contact, t);
    if ("error" in validated) return validated;
    contact = validated.contact;
    if (user[contact.field]) return { error: t.need.inlineContactExists };
    user = { ...user, nickname: contact.nickname, [contact.field]: contact.value,
      fieldVisibility: { ...user.fieldVisibility, [contact.field]: "connected" } };
  }
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

  if (options.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(needs)
      .where(
        and(
          eq(needs.userId, user.id),
          eq(needs.idempotencyKey, options.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing) {
      if (existing.deletedAt != null) return { error: t.need.idempotencyConflict };
      return sameIdempotentCreation(existing, patch, orgId, preferredContact)
        ? { need: existing, replayed: true }
        : { error: t.need.idempotencyConflict };
    }
  }

  const quota = await checkQuota(user, "need.publish", t);
  if (!quota.ok) return { error: quota.message };

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  // 事务里只能同步查询，所以额度上限在进事务前先算好
  const { limit: publishMax } = await effectiveDailyLimit(user, "need.publish");
  // 幂等判定、每日额度和插入共用一个写事务：同一用户的多个 Agent
  // 即使并发发布，也不能重复创建或一起穿透每日上限。
  const inserted = db.transaction(
    (tx) => {
      if (options.idempotencyKey) {
        const existing = tx
          .select()
          .from(needs)
          .where(
            and(
              eq(needs.userId, user.id),
              eq(needs.idempotencyKey, options.idempotencyKey),
            ),
          )
          .limit(1)
          .all()[0];
        if (existing) {
          if (existing.deletedAt != null) {
            return { error: t.need.idempotencyConflict };
          }
          return sameIdempotentCreation(existing, patch, orgId, preferredContact)
            ? { need: existing, replayed: true }
            : { error: t.need.idempotencyConflict };
        }
      }

      const todayCount = tx
        .select({ n: count() })
        .from(needs)
        .where(and(eq(needs.userId, user.id), gte(needs.createdAt, dayStart)))
        .all()[0];
      if ((todayCount?.n ?? 0) >= publishMax) {
        return {
          error: fmt(t.need.dailyLimit, { max: publishMax }),
        };
      }

      if (contact) {
        const current = tx.select().from(users).where(eq(users.id, originalUser.id)).get();
        if (!current || current.status !== "active") return { error: t.auth.sessionExpired };
        if (current[contact.field]) return { error: t.need.inlineContactExists };
        tx.update(users).set({
          nickname: contact.nickname,
          [contact.field]: contact.value,
          fieldVisibility: { ...current.fieldVisibility, [contact.field]: "connected" },
        }).where(eq(users.id, user.id)).run();
      }
      const need = tx
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
          idempotencyKey: options.idempotencyKey ?? null,
        })
        .returning()
        .all()[0];
      return { need, replayed: false };
    },
    { behavior: "immediate" },
  );
  if ("error" in inserted || inserted.replayed) return inserted;
  const { need } = inserted;
  await track({
    name: "need_created",
    userId: user.id,
    entityType: "need",
    entityId: need.id,
    metadata: { scope: orgId == null ? "plaza" : "org" },
  });

  await notifyMatchesForNewNeed(need);
  return { need, replayed: false };
}

export async function getOwnNeed(
  userId: number,
  id: number,
): Promise<Need | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [need] = await db
    .select()
    .from(needs)
    .where(and(eq(needs.id, id), isNull(needs.deletedAt)))
    .limit(1);
  if (!need || need.userId !== userId) return null;
  return need;
}

// 续期锁：存在超过该时长未处理的举手时，发布者不能给任何需求续命。
// 举手只能由人在网页处理，所以这条等于要求续命背后有人类心跳——
// 人失联后帖子自然过期下架（QUOTA.md 第 6 节配套规则 / AGENT-FIRST.md 7.3）
export const STALE_HAND_LOCK_HOURS = 72;

export async function hasStaleIncomingHands(
  userId: number,
  now = Date.now(),
): Promise<boolean> {
  const cutoff = new Date(now - STALE_HAND_LOCK_HOURS * 60 * 60 * 1000);
  const [row] = await db
    .select({ n: count() })
    .from(connections)
    .innerJoin(needs, eq(connections.needId, needs.id))
    .where(
      and(
        eq(needs.userId, userId),
        isNull(needs.deletedAt),
        eq(connections.status, "pending"),
        lt(connections.createdAt, cutoff),
      ),
    );
  return (row?.n ?? 0) > 0;
}

// 续命 = 延长截止时间（含改为永久）或把非 open 状态重新开放；
// 缩短截止、关闭、标完成、只改内容都不算
export function isLifeExtension(need: Need, patch: NeedPatch): boolean {
  if (patch.status === "open" && need.status !== "open") return true;
  if (patch.expiresAt !== undefined) {
    if (patch.expiresAt === null) return need.expiresAt != null;
    if (need.expiresAt == null) return false;
    return patch.expiresAt.getTime() > need.expiresAt.getTime();
  }
  return false;
}

// 应用补丁并刷新内容更新时间；截止时间只在补丁明确传入时改变
export async function applyNeedPatch(
  need: Need,
  patch: NeedPatch,
  t: ServerDict,
): Promise<{ error: string } | { need: Need }> {
  if (isLifeExtension(need, patch) && (await hasStaleIncomingHands(need.userId))) {
    return { error: t.need.staleHandsBlockRenewal };
  }
  const [updated] = await db
    .update(needs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(needs.id, need.id))
    .returning();
  return { need: updated };
}

// 删除只撤下内容，不删除连接与揭示台账。配额和滥用调查都依赖这些不可变证据。
export async function deleteNeed(need: Need): Promise<void> {
  db.transaction(
    (tx) => {
      const now = new Date();
      const deleted = tx
        .update(needs)
        .set({ status: "closed", deletedAt: now, updatedAt: now })
        .where(and(eq(needs.id, need.id), isNull(needs.deletedAt)))
        .returning({ id: needs.id })
        .all();
      if (deleted.length === 0) return;
      tx.insert(auditLogs)
        .values({
          actorId: need.userId,
          action: "need_deleted",
          targetType: "need",
          targetId: need.id,
          metadata: { scope: need.orgId == null ? "plaza" : "org" },
        })
        .run();
    },
    { behavior: "immediate" },
  );
}
