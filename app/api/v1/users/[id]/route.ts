import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { needs, users } from "@/lib/db/schema";
import { apiError, authenticate } from "@/lib/api/auth";
import { serializeNeed } from "@/lib/api/serialize";
import { visibleCard } from "@/lib/card";
import { sharesOrg } from "@/lib/queries";
import { isBlockedEitherWay } from "@/lib/activity";
import { getRequestDict } from "@/lib/i18n/request";

type Context = { params: Promise<{ id: string }> };

// GET /api/v1/users/:id：他人名片，以 Key 主人视角过滤可见性
// （「共同组织可见」字段需与对方同属至少一个组织）；附其广场公开的开放需求
export async function GET(request: Request, { params }: Context) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0)
    return apiError(404, "not_found", (await getRequestDict()).api.userNotFound);

  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (
    !target ||
    target.status !== "active" ||
    (target.id !== auth.user.id && (await isBlockedEitherWay(auth.user.id, target.id)))
  ) return apiError(404, "not_found", (await getRequestDict()).api.userNotFound);

  const shares = await sharesOrg(auth.user.id, target.id);
  const card = visibleCard(target, { loggedIn: true, sharesOrg: shares });

  const plazaNeeds = await db
    .select()
    .from(needs)
    .where(
      and(
        eq(needs.userId, target.id),
        isNull(needs.orgId),
        eq(needs.status, "open"),
        eq(needs.moderationStatus, "visible"),
        or(isNull(needs.expiresAt), gt(needs.expiresAt, new Date())),
      ),
    )
    .orderBy(desc(needs.updatedAt))
    .limit(50);

  return Response.json({
    card,
    plazaNeeds: plazaNeeds.map((n) => serializeNeed(n)),
  });
}
