import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { needs, users } from "@/lib/db/schema";
import { normalizePlazaSort, plazaOrderBy } from "@/lib/plaza-sort";

describe("normalizePlazaSort", () => {
  test("只接受三个公开排序值，其他输入回落到最近更新", () => {
    expect(normalizePlazaSort("updated")).toBe("updated");
    expect(normalizePlazaSort("newest")).toBe("newest");
    expect(normalizePlazaSort("expiring")).toBe("expiring");
    expect(normalizePlazaSort("popular")).toBe("updated");
    expect(normalizePlazaSort(undefined)).toBe("updated");
  });
});

describe("plazaOrderBy", () => {
  test("最近更新、最新发布和即将截止使用各自稳定的顺序", async () => {
    const now = new Date("2026-08-10T04:00:00.000Z");
    const [user] = await db
      .insert(users)
      .values({
        loginEmail: `plaza-sort-${Date.now()}@test.local`,
        nickname: "排序测试",
      })
      .returning();

    await db.insert(needs).values([
      {
        userId: user.id,
        type: "need",
        title: "较晚截止",
        createdAt: new Date("2026-08-06T04:00:00.000Z"),
        updatedAt: new Date("2026-08-09T01:00:00.000Z"),
        expiresAt: new Date("2026-08-20T04:00:00.000Z"),
      },
      {
        userId: user.id,
        type: "need",
        title: "即将截止",
        createdAt: new Date("2026-08-07T04:00:00.000Z"),
        updatedAt: new Date("2026-08-08T01:00:00.000Z"),
        expiresAt: new Date("2026-08-11T04:00:00.000Z"),
      },
      {
        userId: user.id,
        type: "offer",
        title: "已过期",
        createdAt: new Date("2026-08-09T04:00:00.000Z"),
        updatedAt: new Date("2026-08-07T01:00:00.000Z"),
        expiresAt: new Date("2026-08-09T04:00:00.000Z"),
      },
      {
        userId: user.id,
        type: "offer",
        title: "永久有效",
        createdAt: new Date("2026-08-08T04:00:00.000Z"),
        updatedAt: new Date("2026-08-10T01:00:00.000Z"),
        expiresAt: null,
      },
    ]);

    async function titles(sort: "updated" | "newest" | "expiring") {
      const rows = await db
        .select({ title: needs.title })
        .from(needs)
        .where(eq(needs.userId, user.id))
        .orderBy(...plazaOrderBy(sort, now));
      return rows.map((row) => row.title);
    }

    expect(await titles("updated")).toEqual([
      "永久有效",
      "较晚截止",
      "即将截止",
      "已过期",
    ]);
    expect(await titles("newest")).toEqual([
      "已过期",
      "永久有效",
      "即将截止",
      "较晚截止",
    ]);
    expect(await titles("expiring")).toEqual([
      "即将截止",
      "较晚截止",
      "已过期",
      "永久有效",
    ]);
  });
});
