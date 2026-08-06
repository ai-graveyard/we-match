import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { joinRequests, orgs } from "@/lib/db/schema";
import { authenticate } from "@/lib/api/auth";
import { serializeOrg } from "@/lib/api/serialize";
import { getUserOrgs } from "@/lib/queries";

// GET /api/v1/me/orgs：我加入的组织（含角色）与申请中的组织
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;

  const myOrgs = await getUserOrgs(auth.user.id);
  const pending = await db
    .select({ orgId: orgs.id, orgName: orgs.name })
    .from(joinRequests)
    .innerJoin(orgs, eq(joinRequests.orgId, orgs.id))
    .where(
      and(
        eq(joinRequests.userId, auth.user.id),
        eq(joinRequests.status, "pending"),
      ),
    )
    .orderBy(desc(joinRequests.createdAt));

  return Response.json({
    orgs: myOrgs.map(({ org, role }) => serializeOrg(org, role)),
    pendingRequests: pending,
  });
}
