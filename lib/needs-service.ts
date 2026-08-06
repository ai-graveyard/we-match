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
): { error: string } | { patch: NeedPatch } {
  const patch: NeedPatch = {};

  if (input.type !== undefined || requireCore) {
    if (input.type !== "need" && input.type !== "offer")
      return { error: "请选择需求类型（need / offer）" };
    patch.type = input.type;
  }
  if (input.title !== undefined || requireCore) {
    const title = String(input.title ?? "").trim();
    if (!title) return { error: "标题不能为空" };
    if (title.length > NEED_LIMITS.title)
      return { error: `标题最多 ${NEED_LIMITS.title} 字` };
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
    if (!tags) return { error: "标签格式不正确" };
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
      return { error: "优先联系方式只能是 wechat / email / contactPhone" };
    }
  }
  if (input.status !== undefined) {
    if (
      input.status !== "open" &&
      input.status !== "done" &&
      input.status !== "closed"
    )
      return { error: "状态只能是 open / done / closed" };
    patch.status = input.status;
  }
  if (input.expiresAt !== undefined || requireCore) {
    if (input.expiresAt === null) {
      patch.expiresAt = null;
    } else {
      const expiresAt = new Date(String(input.expiresAt ?? ""));
      if (Number.isNaN(expiresAt.getTime()))
        return { error: "请选择截止时间，或选择永久" };
      if (expiresAt.getTime() <= Date.now())
        return { error: "截止时间必须晚于当前时间" };
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
): Promise<{ error: string } | { need: Need }> {
  if (orgId != null) {
    if (!Number.isInteger(orgId) || orgId <= 0)
      return { error: "可见范围不正确" };
    if (!(await getMembership(orgId, user.id)))
      return { error: "只能发到自己已加入的组织" };
  }

  if (!canBeContacted(user, orgId ? "org" : "plaza")) {
    return {
      error: orgId
        ? "名片上还没有组织成员可见的联系方式，发布后别人联系不到你。请先到「我的 → 编辑名片」开启"
        : "名片上还没有登录用户可见的联系方式，发布后别人联系不到你。请先到「我的 → 编辑名片」开启",
    };
  }

  const preferredContact = resolvePreferredContact(
    user,
    orgId ? "org" : "plaza",
    patch.preferredContact,
  );
  if (patch.preferredContact && preferredContact !== patch.preferredContact) {
    return { error: "选择的优先联系方式在当前可见范围下不可用" };
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const [todayCount] = await db
    .select({ n: count() })
    .from(needs)
    .where(and(eq(needs.userId, user.id), gte(needs.createdAt, dayStart)));
  if ((todayCount?.n ?? 0) >= NEED_LIMITS.dailyPublish) {
    return { error: `每天最多发布 ${NEED_LIMITS.dailyPublish} 条需求` };
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
        type: "matches_available",
        title: `发现 ${matchCount.n} 条可能匹配的需求`,
        body: `与你刚发布的「${need.title}」标签相关`,
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
