import { describe, expect, test } from "vitest";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blocks,
  needs,
  notifications,
  orgMembers,
  orgs,
  users,
} from "@/lib/db/schema";
import { getMatchCandidates } from "@/lib/matches";
import { createNeed } from "@/lib/needs-service";
import { SERVER_DICTS } from "@/lib/i18n/dict";

const t = SERVER_DICTS.zh;
let seq = 0;
const future = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

async function createUser(label: string) {
  const id = ++seq;
  const [user] = await db
    .insert(users)
    .values({
      loginEmail: `match-${id}@test.local`,
      nickname: label,
      email: `public-match-${id}@test.local`,
    })
    .returning();
  return user;
}

async function insertNeed(
  userId: number,
  input: {
    type: "need" | "offer";
    title: string;
    tags?: string[];
    status?: "open" | "done" | "closed";
    orgId?: number | null;
    expiresAt?: Date | null;
    updatedAt?: Date;
  },
) {
  const [need] = await db
    .insert(needs)
    .values({
      userId,
      type: input.type,
      title: input.title,
      tags: input.tags ?? [],
      status: input.status ?? "open",
      orgId: input.orgId ?? null,
      expiresAt: input.expiresAt === undefined ? future() : input.expiresAt,
      updatedAt: input.updatedAt ?? new Date(),
    })
    .returning();
  return need;
}

describe("Agent match candidate recall", () => {
  test("ranks exact tag overlap first while retaining semantic-fallback candidates", async () => {
    const owner = await createUser("需求方");
    const exactOwner = await createUser("精确供给方");
    const semanticOwner = await createUser("语义供给方");
    const source = await insertNeed(owner.id, {
      type: "need",
      title: "找 React 页面实现",
      tags: ["前端", "Next.js"],
    });
    const semantic = await insertNeed(semanticOwner.id, {
      type: "offer",
      title: "可做 Web 界面开发",
      tags: ["React"],
      updatedAt: new Date(Date.now() + 1000),
    });
    const exact = await insertNeed(exactOwner.id, {
      type: "offer",
      title: "提供 Next.js 前端开发",
      tags: ["前端", "Next.js"],
    });
    await insertNeed(owner.id, {
      type: "offer",
      title: "自己的供给不能匹配自己",
      tags: ["前端"],
    });
    await insertNeed(exactOwner.id, {
      type: "need",
      title: "同方向不能成为候选",
      tags: ["前端"],
    });
    await insertNeed(exactOwner.id, {
      type: "offer",
      title: "已关闭不能成为候选",
      tags: ["前端"],
      status: "closed",
    });

    const result = await getMatchCandidates(owner.id, source.id, { limit: 20 });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.candidates.map((item) => item.need.id)).toEqual([
      exact.id,
      semantic.id,
    ]);
    expect(result.candidates[0].matchedTags).toEqual(["前端", "Next.js"]);
    expect(result.candidates[1].matchedTags).toEqual([]);
  });

  test("removes candidates when either side has blocked the other", async () => {
    const owner = await createUser("被拉黑需求方");
    const provider = await createUser("拉黑供给方");
    const source = await insertNeed(owner.id, {
      type: "need",
      title: "需要 API 支持",
      tags: ["API"],
    });
    await insertNeed(provider.id, {
      type: "offer",
      title: "提供 API 支持",
      tags: ["API"],
    });
    await db.insert(blocks).values({ blockerId: provider.id, blockedId: owner.id });

    const result = await getMatchCandidates(owner.id, source.id);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.candidates.some((item) => item.author.id === provider.id)).toBe(
      false,
    );
  });

  test("rejects closed source needs", async () => {
    const owner = await createUser("关闭需求方");
    const source = await insertNeed(owner.id, {
      type: "need",
      title: "已经关闭",
      status: "closed",
    });
    expect(await getMatchCandidates(owner.id, source.id)).toEqual({
      error: "not_open",
    });
  });

  test("requires current organization membership on both sides", async () => {
    const orgOwner = await createUser("组织 Owner");
    const sourceOwner = await createUser("仍在组织的需求方");
    const removedProvider = await createUser("已退出组织的供给方");
    const [org] = await db
      .insert(orgs)
      .values({
        name: "匹配权限测试组织",
        ownerId: orgOwner.id,
        inviteCode: `MATCH${seq}`,
      })
      .returning();
    await db.insert(orgMembers).values([
      { orgId: org.id, userId: orgOwner.id, role: "owner" },
      { orgId: org.id, userId: sourceOwner.id, role: "member" },
    ]);
    const source = await insertNeed(sourceOwner.id, {
      type: "need",
      title: "组织内找前端",
      tags: ["前端"],
      orgId: org.id,
    });
    await insertNeed(removedProvider.id, {
      type: "offer",
      title: "已经退出组织的前端",
      tags: ["前端"],
      orgId: org.id,
    });

    const result = await getMatchCandidates(sourceOwner.id, source.id);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.candidates).toHaveLength(0);

    await db
      .delete(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, org.id),
          eq(orgMembers.userId, sourceOwner.id),
        ),
      );
    expect(await getMatchCandidates(sourceOwner.id, source.id)).toEqual({
      error: "not_found",
    });
  });
});

describe("symmetric match notifications", () => {
  test("notifies the new publisher and existing owner once across an idempotent replay", async () => {
    const existingOwner = await createUser("已有供给方");
    const publisher = await createUser("新需求方");
    const existing = await insertNeed(existingOwner.id, {
      type: "offer",
      title: "可以提供 API 联调",
      tags: ["API联调"],
    });
    const patch = {
      type: "need" as const,
      title: "寻找 API 联调伙伴",
      tags: ["API联调"],
      expiresAt: future(),
    };

    const first = await createNeed(publisher, patch, null, t, {
      idempotencyKey: "match-notification-replay",
    });
    const replay = await createNeed(publisher, patch, null, t, {
      idempotencyKey: "match-notification-replay",
    });
    expect("need" in first && first.replayed).toBe(false);
    expect("need" in replay && replay.replayed).toBe(true);

    const publisherNotices = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, publisher.id),
          eq(notifications.type, "matches_available"),
        ),
      );
    const ownerNotices = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, existingOwner.id),
          eq(notifications.type, "matching_need_added"),
        ),
      );
    expect(publisherNotices).toHaveLength(1);
    expect(ownerNotices).toHaveLength(1);
    expect(ownerNotices[0].params).toMatchObject({
      need: existing.title,
      candidate: patch.title,
      candidateId: "need" in first ? first.need.id : -1,
    });
  });

  test("uses exact tags rather than substring matches for push notifications", async () => {
    const existingOwner = await createUser("AIGC 供给方");
    const publisher = await createUser("AI 需求方");
    await insertNeed(existingOwner.id, {
      type: "offer",
      title: "AIGC 服务",
      tags: ["AIGC"],
    });
    await createNeed(
      publisher,
      {
        type: "need",
        title: "AI 咨询",
        tags: ["AI"],
        expiresAt: future(),
      },
      null,
      t,
    );

    const [row] = await db
      .select({ n: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, existingOwner.id),
          eq(notifications.type, "matching_need_added"),
        ),
      );
    expect(row.n).toBe(0);
  });
});
