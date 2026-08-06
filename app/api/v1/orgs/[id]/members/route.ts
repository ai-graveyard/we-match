import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orgMembers, users } from "@/lib/db/schema";
import { apiError, authenticate } from "@/lib/api/auth";
import { visibleCard } from "@/lib/card";
import { getMembership } from "@/lib/queries";

type Context = { params: Promise<{ id: string }> };

// GET /api/v1/orgs/:id/members：组织成员列表（需成员身份，否则 404）。
// 参数：tag 按技能标签筛选；q 按昵称搜索。
// 成员名片按「同组织成员」视角过滤（orgs 档字段可见）
export async function GET(request: Request, { params }: Context) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const orgId = Number((await params).id);
  if (!Number.isInteger(orgId) || orgId <= 0)
    return apiError(404, "not_found", "组织不存在或你不是成员");
  if (!(await getMembership(orgId, auth.user.id)))
    return apiError(404, "not_found", "组织不存在或你不是成员");

  const searchParams = new URL(request.url).searchParams;
  const tag = searchParams.get("tag")?.trim();
  const q = searchParams.get("q")?.trim();

  const rows = await db
    .select({ member: orgMembers, user: users })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, orgId))
    .orderBy(asc(orgMembers.joinedAt));

  const members = rows
    .filter((r) => (tag ? r.user.tags.includes(tag) : true))
    .filter((r) => (q ? r.user.nickname.includes(q) : true))
    .map((r) => ({
      ...visibleCard(r.user, { loggedIn: true, sharesOrg: true }),
      role: r.member.role,
      joinedAt: r.member.joinedAt.toISOString(),
    }));

  return Response.json({ members });
}
