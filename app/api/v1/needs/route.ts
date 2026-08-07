import { and, desc, eq, gt, notInArray, or, sql, isNull, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { blocks, needs, users } from "@/lib/db/schema";
import { apiError, authenticate, readJson } from "@/lib/api/auth";
import { serializeNeed } from "@/lib/api/serialize";
import { getMembership } from "@/lib/queries";
import { createNeed, validateNeedPatch } from "@/lib/needs-service";
import { getRequestDict } from "@/lib/i18n/request";

// GET /api/v1/needs：需求流。参数：
//   org=<id> 指定组织（需成员身份，缺省为广场）；type=need|offer；tag；q；
//   status=open|done|closed 指定状态；all=1 显示全部；缺省只看开放且未过期；
//   limit（默认 50，上限 100）
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const params = new URL(request.url).searchParams;

  const orgParam = params.get("org");
  let orgId: number | null = null;
  if (orgParam != null) {
    orgId = Number(orgParam);
    if (!Number.isInteger(orgId) || orgId <= 0)
      return apiError(422, "invalid_input", (await getRequestDict()).api.orgParamNotId);
    // 组织内容对非成员一律 404，不暴露存在性
    if (!(await getMembership(orgId, auth.user.id)))
      return apiError(404, "not_found", (await getRequestDict()).api.orgNotFoundOrNotMember);
  }

  const conds: SQL[] = [
    orgId != null ? eq(needs.orgId, orgId) : isNull(needs.orgId),
    eq(needs.moderationStatus, "visible"),
    eq(users.status, "active"),
  ];
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
      return apiError(422, "invalid_input", (await getRequestDict()).api.badStatusFilter);
    conds.push(eq(needs.status, status));
  } else if (params.get("all") !== "1") {
    conds.push(eq(needs.status, "open"));
    conds.push(or(isNull(needs.expiresAt), gt(needs.expiresAt, new Date()))!);
  }
  const type = params.get("type");
  if (type === "need" || type === "offer") conds.push(eq(needs.type, type));
  const q = params.get("q")?.trim();
  if (q) {
    const kw = `%${q}%`;
    conds.push(
      or(sql`${needs.title} LIKE ${kw}`, sql`${needs.description} LIKE ${kw}`)!,
    );
  }
  const tag = params.get("tag")?.trim();
  if (tag) conds.push(sql`${needs.tags} LIKE ${`%"${tag}"%`}`);

  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 100);
  const rows = await db
    .select({ need: needs, author: { id: users.id, nickname: users.nickname } })
    .from(needs)
    .innerJoin(users, eq(needs.userId, users.id))
    .where(and(...conds))
    .orderBy(desc(needs.updatedAt))
    .limit(limit);

  return Response.json({
    needs: rows.map((r) => serializeNeed(r.need, { author: r.author })),
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
  const parsed = validateNeedPatch(body, { requireCore: true }, t);
  if ("error" in parsed) return apiError(422, "invalid_input", parsed.error);
  if (parsed.patch.status !== undefined)
    return apiError(422, "invalid_input", t.api.statusOnCreate);

  const orgId = body.orgId == null ? null : Number(body.orgId);
  const result = await createNeed(auth.user, parsed.patch, orgId, t);
  if ("error" in result) return apiError(422, "invalid_input", result.error);
  return Response.json({ need: serializeNeed(result.need) }, { status: 201 });
}
