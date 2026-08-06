import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { needs, orgs } from "@/lib/db/schema";
import { authenticate } from "@/lib/api/auth";
import { serializeNeed } from "@/lib/api/serialize";

// GET /api/v1/me/needs：我的全部需求（含各组织内的），按更新时间倒序
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;

  const rows = await db
    .select({ need: needs, orgName: orgs.name })
    .from(needs)
    .leftJoin(orgs, eq(needs.orgId, orgs.id))
    .where(eq(needs.userId, auth.user.id))
    .orderBy(desc(needs.updatedAt));

  return Response.json({
    needs: rows.map((r) => serializeNeed(r.need, { orgName: r.orgName })),
  });
}
