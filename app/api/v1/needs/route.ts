import {
  and,
  desc,
  eq,
  gt,
  gte,
  isNull,
  lt,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { blocks, needs, users } from "@/lib/db/schema";
import {
  apiError,
  authenticate,
  readJson,
  unknownJsonFields,
} from "@/lib/api/auth";
import { serializeNeed } from "@/lib/api/serialize";
import { getMembership } from "@/lib/queries";
import { createNeed, validateNeedPatch } from "@/lib/needs-service";
import { getRequestDict } from "@/lib/i18n/request";
import { audit } from "@/lib/activity";
import {
  apiLimit,
  decodeCursor,
  encodeCursor,
  parseSince,
} from "@/lib/api/pagination";

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{1,128}$/;

// GET /api/v1/needs：需求流。参数：
//   org=<id> 指定组织（需成员身份，缺省为广场）；type=need|offer；tag；q；
//   status=open|done|closed 指定状态；all=1 显示全部；缺省只看开放且未过期；
//   limit（默认 50，上限 100）
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const params = new URL(request.url).searchParams;
  const t = await getRequestDict();

  const since = parseSince(params.get("since"));
  if (since === "invalid") return apiError(422, "invalid_since", t.api.badSince);
  const cursor = decodeCursor(params.get("cursor"));
  if (cursor === "invalid") return apiError(422, "invalid_cursor", t.api.badCursor);

  const orgParam = params.get("org");
  let orgId: number | null = null;
  if (orgParam != null) {
    orgId = Number(orgParam);
    if (!Number.isInteger(orgId) || orgId <= 0)
      return apiError(422, "invalid_input", t.api.orgParamNotId);
    // 组织内容对非成员一律 404，不暴露存在性
    if (!(await getMembership(orgId, auth.user.id)))
      return apiError(404, "not_found", t.api.orgNotFoundOrNotMember);
  }

  const conds: SQL[] = [
    orgId != null ? eq(needs.orgId, orgId) : isNull(needs.orgId),
    isNull(needs.deletedAt),
    eq(needs.moderationStatus, "visible"),
    eq(users.status, "active"),
  ];
  if (since) conds.push(gte(needs.updatedAt, since));
  if (cursor) {
    conds.push(
      or(
        lt(needs.updatedAt, cursor.at),
        and(eq(needs.updatedAt, cursor.at), lt(needs.id, cursor.id)),
      )!,
    );
  }
  const blockedRows = await db
    .select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
    .from(blocks)
    .where(
      or(eq(blocks.blockerId, auth.user.id), eq(blocks.blockedId, auth.user.id)),
    );
  const hiddenUserIds = blockedRows.map((row) =>
    row.blockerId === auth.user.id ? row.blockedId : row.blockerId,
  );
  if (hiddenUserIds.length > 0) conds.push(notInArray(needs.userId, hiddenUserIds));
  const status = params.get("status");
  if (status != null) {
    if (status !== "open" && status !== "done" && status !== "closed")
      return apiError(422, "invalid_input", t.api.badStatusFilter);
    conds.push(eq(needs.status, status));
  } else if (params.get("all") !== "1") {
    conds.push(eq(needs.status, "open"));
    conds.push(or(isNull(needs.expiresAt), gt(needs.expiresAt, new Date()))!);
  }
  const type = params.get("type");
  if (type != null && type !== "need" && type !== "offer") {
    return apiError(422, "invalid_input", t.need.badType);
  }
  if (type === "need" || type === "offer") conds.push(eq(needs.type, type));
  const q = params.get("q")?.trim();
  if (q) {
    const kw = `%${q}%`;
    conds.push(
      or(sql`${needs.title} LIKE ${kw}`, sql`${needs.description} LIKE ${kw}`)!,
    );
  }
  const tag = params.get("tag")?.trim();
  if (tag) {
    conds.push(
      sql`exists (select 1 from json_each(${needs.tags}) where json_each.value = ${tag})`,
    );
  }

  const limit = apiLimit(params.get("limit"));
  const fetched = await db
    .select({ need: needs, author: { id: users.id, nickname: users.nickname } })
    .from(needs)
    .innerJoin(users, eq(needs.userId, users.id))
    .where(and(...conds))
    .orderBy(desc(needs.updatedAt), desc(needs.id))
    .limit(limit + 1);
  const hasMore = fetched.length > limit;
  const rows = fetched.slice(0, limit);
  const last = rows.at(-1)?.need;

  return Response.json({
    needs: rows.map((r) => serializeNeed(r.need, { author: r.author })),
    nextCursor: hasMore && last ? encodeCursor(last.updatedAt, last.id) : null,
  });
}

// POST /api/v1/needs：发布需求。body：{type, title, description?, tags?, orgId?, expiresAt, preferredContact?}
// orgId 缺省或 null 即广场公开；复用可联系性校验与每日发布限额
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;

  const body = await readJson(request);
  const t = await getRequestDict();
  if (!body) return apiError(422, "invalid_body", t.api.bodyNotObject);
  const unknown = unknownJsonFields(body, [
    "type",
    "title",
    "description",
    "tags",
    "orgId",
    "preferredContact",
    "expiresAt",
  ]);
  if (unknown.length > 0) {
    return apiError(
      422,
      "unknown_fields",
      t.api.unknownFields.replace("{fields}", unknown.join(", ")),
    );
  }
  const parsed = validateNeedPatch(body, { requireCore: true }, t);
  if ("error" in parsed) return apiError(422, "invalid_input", parsed.error);
  if (parsed.patch.status !== undefined)
    return apiError(422, "invalid_input", t.api.statusOnCreate);

  const orgId = body.orgId == null ? null : Number(body.orgId);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || null;
  if (idempotencyKey && !IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
    return apiError(422, "bad_idempotency_key", t.api.badIdempotencyKey);
  }
  const result = await createNeed(auth.user, parsed.patch, orgId, t, {
    idempotencyKey,
  });
  if ("error" in result) return apiError(422, "invalid_input", result.error);
  if (!result.replayed) {
    await audit({
      actorId: auth.user.id,
      action: "agent_need_created",
      targetType: "need",
      targetId: result.need.id,
      metadata: { apiKeyId: auth.apiKeyId },
    });
  }
  return Response.json(
    { need: serializeNeed(result.need), replayed: result.replayed },
    {
      status: result.replayed ? 200 : 201,
      headers: result.replayed ? { "idempotency-replayed": "true" } : undefined,
    },
  );
}
