import "server-only";

import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

/**
 * SQLite-backed fixed-window limiter. It survives restarts and is shared by
 * every app process that points at the same database file.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const now = Date.now();
  const bucketMs = Math.floor(now / windowMs) * windowMs;
  const bucketStart = new Date(bucketMs);

  await db
    .insert(rateLimits)
    .values({ key, bucketStart, count: 1, updatedAt: new Date(now) })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.bucketStart],
      set: {
        count: sql`${rateLimits.count} + 1`,
        updatedAt: new Date(now),
      },
    });

  const [row] = await db
    .select({ count: rateLimits.count })
    .from(rateLimits)
    .where(
      and(eq(rateLimits.key, key), eq(rateLimits.bucketStart, bucketStart)),
    )
    .limit(1);

  // Opportunistic cleanup keeps the table bounded without a scheduler.
  if (Math.random() < 0.01) {
    await db
      .delete(rateLimits)
      .where(lt(rateLimits.updatedAt, new Date(now - 7 * 24 * 60 * 60 * 1000)));
  }

  return (row?.count ?? 0) <= limit;
}
