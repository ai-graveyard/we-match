import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { needs, orgs, users } from "@/lib/db/schema";
import {
  apiError,
  authenticate,
  readJson,
  unknownJsonFields,
} from "@/lib/api/auth";
import { serializeNeed } from "@/lib/api/serialize";
import { getMembership } from "@/lib/queries";
import {
  applyNeedPatch,
  deleteNeed,
  getOwnNeed,
  resolvePreferredContact,
  validateNeedPatch,
} from "@/lib/needs-service";
import { expiryFromPreset } from "@/lib/needs";
import { getRequestDict } from "@/lib/i18n/request";
import { audit, isBlockedEitherWay } from "@/lib/activity";

type Context = { params: Promise<{ id: string }> };

// GET /api/v1/needs/:id：需求详情。组织内需求对非成员返回 404，不暴露存在性
export async function GET(request: Request, { params }: Context) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0)
    return apiError(404, "not_found", (await getRequestDict()).api.needNotFound);

  const [row] = await db
    .select({ need: needs, author: users })
    .from(needs)
    .innerJoin(users, eq(needs.userId, users.id))
    .where(and(eq(needs.id, id), isNull(needs.deletedAt)))
    .limit(1);
  if (!row) return apiError(404, "not_found", (await getRequestDict()).api.needNotFound);

  const isOwner = row.need.userId === auth.user.id;
  if (
    (!isOwner && row.need.moderationStatus !== "visible") ||
    (!isOwner && row.author.status !== "active") ||
    (!isOwner && (await isBlockedEitherWay(auth.user.id, row.author.id)))
  ) {
    return apiError(404, "not_found", (await getRequestDict()).api.needNotFound);
  }

  let orgName: string | null = null;
  if (row.need.orgId != null) {
    if (!isOwner && !(await getMembership(row.need.orgId, auth.user.id)))
      return apiError(404, "not_found", (await getRequestDict()).api.needNotFound);
    const [org] = await db
      .select({ name: orgs.name })
      .from(orgs)
      .where(eq(orgs.id, row.need.orgId))
      .limit(1);
    orgName = org?.name ?? null;
  }

  return Response.json({
    need: serializeNeed(row.need, {
      author: { id: row.author.id, nickname: row.author.nickname },
      orgName,
    }),
  });
}

// PATCH /api/v1/needs/:id：编辑自己的需求（含 expiresAt；null = 永久）。
// 空 body {} 保留为快速续期：截止时间改为一个月后
export async function PATCH(request: Request, { params }: Context) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const need = await getOwnNeed(auth.user.id, Number((await params).id));
  const t = await getRequestDict();
  if (!need) return apiError(404, "not_found", t.api.needNotYours);

  const body = await readJson(request);
  if (!body) return apiError(422, "invalid_body", t.api.bodyNotObject);
  const unknown = unknownJsonFields(body, [
    "type",
    "title",
    "description",
    "tags",
    "status",
    "preferredContact",
    "expiresAt",
    "orgId",
  ]);
  if (unknown.length > 0) {
    return apiError(
      422,
      "unknown_fields",
      t.api.unknownFields.replace("{fields}", unknown.join(", ")),
    );
  }
  if (body.orgId !== undefined)
    return apiError(422, "invalid_input", t.api.scopeImmutable);
  const parsed = validateNeedPatch(body, { requireCore: false }, t);
  if ("error" in parsed) return apiError(422, "invalid_input", parsed.error);

  if (body.preferredContact !== undefined) {
    const preferredContact = resolvePreferredContact(
      auth.user,
      need.orgId == null ? "plaza" : "org",
      parsed.patch.preferredContact,
    );
    if (
      parsed.patch.preferredContact &&
      preferredContact !== parsed.patch.preferredContact
    ) {
      return apiError(422, "invalid_input", t.need.preferredContactUnavailable);
    }
    parsed.patch.preferredContact = preferredContact;
  }

  const applied = await applyNeedPatch(
    need,
    Object.keys(body).length === 0
      ? { expiresAt: expiryFromPreset("month") }
      : parsed.patch,
    t,
  );
  // 续期锁：有超过 72 小时未处理的举手时，续期/重开被拒（见 lib/needs-service.ts）
  if ("error" in applied) return apiError(422, "renewal_blocked", applied.error);
  await audit({
    actorId: auth.user.id,
    action: "agent_need_updated",
    targetType: "need",
    targetId: need.id,
    metadata: { apiKeyId: auth.apiKeyId, fields: Object.keys(body) },
  });
  return Response.json({ need: serializeNeed(applied.need) });
}

// DELETE /api/v1/needs/:id：删除自己的需求
export async function DELETE(request: Request, { params }: Context) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const need = await getOwnNeed(auth.user.id, Number((await params).id));
  if (!need)
    return apiError(404, "not_found", (await getRequestDict()).api.needNotYours);
  await deleteNeed(need);
  await audit({
    actorId: auth.user.id,
    action: "agent_need_deleted",
    targetType: "need",
    targetId: need.id,
    metadata: { apiKeyId: auth.apiKeyId },
  });
  return Response.json({ deleted: true });
}
