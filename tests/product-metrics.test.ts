import { expect, test } from "vitest";
import { db } from "@/lib/db";
import { analyticsEvents, connections, needs, users } from "@/lib/db/schema";
import { getNeedCohortMetrics } from "@/lib/product-metrics";

test("counts distinct mature needs, bounds outcomes to seven days and preserves missing timing", async () => {
  const now = new Date();
  const day = 86_400_000;
  const user = db.insert(users).values({ loginEmail: "metrics@test.local", nickname: "统计测试" }).returning().get();
  const create = (age: number) => db.insert(needs).values({ userId: user.id, type: "need", title: "测试", createdAt: new Date(now.getTime() - age * day) }).returning().get();
  const first = create(10), second = create(15), fresh = create(1);
  for (const need of [first, second, fresh]) await db.insert(analyticsEvents).values({ name: "need_created", entityType: "need", entityId: need.id, createdAt: need.createdAt });
  const request = (need: typeof first, hours: number) => db.insert(analyticsEvents).values({ name: "connection_requested", entityType: "need", entityId: need.id, createdAt: new Date(need.createdAt.getTime() + hours * 3_600_000) });
  await request(first, 2); await request(first, 3); await request(second, 8 * 24); await request(fresh, 1);
  const connection = db.insert(connections).values({ needId: first.id, initiatorId: user.id }).returning().get();
  await db.insert(analyticsEvents).values([
    { name: "connection_accepted", entityType: "connection", entityId: connection.id, createdAt: new Date(first.createdAt.getTime() + day) },
    { name: "connection_completed", entityType: "connection", entityId: connection.id, createdAt: new Date(first.createdAt.getTime() + 8 * day) },
  ]);
  expect(await getNeedCohortMetrics(now)).toEqual({ published: 2, raised: 1, accepted: 1, completed: 0, firstRaiseMedianHours: 2 });
  expect((await getNeedCohortMetrics(new Date(now.getTime() + 100 * day))).firstRaiseMedianHours).toBeNull();
});
