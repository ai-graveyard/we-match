import "server-only";
import { and, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { analyticsEvents, connections, needs } from "@/lib/db/schema";

const DAY = 86_400_000;
export type NeedCohortMetrics = { published: number; raised: number; accepted: number; completed: number; firstRaiseMedianHours: number | null };

// 最近 30 个发布日、且每条都已观察满 7 天。阶段按需求去重，不能把举手数除以帖子数。
export async function getNeedCohortMetrics(now = new Date()): Promise<NeedCohortMetrics> {
  const stageTime = (name: string) => sql<number | null>`(
    select min(e.created_at) from ${analyticsEvents} e
    inner join ${connections} c on c.id = e.entity_id
    where e.name = ${name} and e.entity_type = 'connection' and c.need_id = "needs"."id"
      and e.created_at >= "needs"."created_at" and e.created_at <= "needs"."created_at" + ${7 * DAY}
  )`;
  const rows = await db.select({
    createdAt: needs.createdAt,
    raisedAt: sql<number | null>`(select min(e.created_at) from ${analyticsEvents} e
      where e.name = 'connection_requested' and e.entity_type = 'need' and e.entity_id = "needs"."id"
        and e.created_at >= "needs"."created_at" and e.created_at <= "needs"."created_at" + ${7 * DAY})`,
    acceptedAt: stageTime("connection_accepted"),
    completedAt: stageTime("connection_completed"),
  }).from(needs).where(and(
    gte(needs.createdAt, new Date(now.getTime() - 37 * DAY)),
    lt(needs.createdAt, new Date(now.getTime() - 7 * DAY)),
    sql`exists (select 1 from ${analyticsEvents} e where e.name = 'need_created' and e.entity_type = 'need' and e.entity_id = "needs"."id")`,
  ));
  const hours = rows.filter((row) => row.raisedAt != null).map((row) => (row.raisedAt! - row.createdAt.getTime()) / 3_600_000).sort((a, b) => a - b);
  const middle = Math.floor(hours.length / 2);
  return {
    published: rows.length,
    raised: rows.filter((row) => row.raisedAt != null).length,
    accepted: rows.filter((row) => row.acceptedAt != null).length,
    completed: rows.filter((row) => row.completedAt != null).length,
    firstRaiseMedianHours: hours.length ? hours.length % 2 ? hours[middle] : (hours[middle - 1] + hours[middle]) / 2 : null,
  };
}
