import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { needs, orgs, users } from "@/lib/db/schema";
import { apiError, authenticate, readJson } from "@/lib/api/auth";
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

type Context = { params: Promise<{ id: string }> };

// GET /api/v1/needs/:id：需求详情。组织内需求对非成员返回 404，不暴露存在性
export async function GET(request: Request, { params }: Context) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0)
    return apiError(404, "not_found", "需求不存在");

  const [row] = await db
    .select({ need: needs, author: { id: users.id, nickname: users.nickname } })
    .from(needs)
    .innerJoin(users, eq(needs.userId, users.id))
    .where(eq(needs.id, id))
    .limit(1);
  if (!row) return apiError(404, "not_found", "需求不存在");

  let orgName: string | null = null;
  if (row.need.orgId != null) {
    const isOwner = row.need.userId === auth.user.id;
    if (!isOwner && !(await getMembership(row.need.orgId, auth.user.id)))
      return apiError(404, "not_found", "需求不存在");
    const [org] = await db
      .select({ name: orgs.name })
      .from(orgs)
      .where(eq(orgs.id, row.need.orgId))
      .limit(1);
    orgName = org?.name ?? null;
  }

  return Response.json({
    need: serializeNeed(row.need, { author: row.author, orgName }),
  });
}

// PATCH /api/v1/needs/:id：编辑自己的需求（含 expiresAt；null = 永久）。
// 空 body {} 保留为快速续期：截止时间改为一个月后
export async function PATCH(request: Request, { params }: Context) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const need = await getOwnNeed(auth.user.id, Number((await params).id));
  if (!need) return apiError(404, "not_found", "需求不存在或不属于你");

  const body = await readJson(request);
  if (!body) return apiError(422, "invalid_body", "请求体需为 JSON 对象");
  if (body.orgId !== undefined)
    return apiError(422, "invalid_input", "可见范围发布后不可修改，请关闭后重新发布");
  const parsed = validateNeedPatch(body, { requireCore: false });
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
      return apiError(
        422,
        "invalid_input",
        "选择的优先联系方式在当前可见范围下不可用",
      );
    }
    parsed.patch.preferredContact = preferredContact;
  }

  const updated = await applyNeedPatch(
    need,
    Object.keys(body).length === 0
      ? { expiresAt: expiryFromPreset("month") }
      : parsed.patch,
  );
  return Response.json({ need: serializeNeed(updated) });
}

// DELETE /api/v1/needs/:id：删除自己的需求
export async function DELETE(request: Request, { params }: Context) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const need = await getOwnNeed(auth.user.id, Number((await params).id));
  if (!need) return apiError(404, "not_found", "需求不存在或不属于你");
  await deleteNeed(need);
  return Response.json({ deleted: true });
}
