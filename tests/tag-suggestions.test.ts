import { describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import { blocks, needs, orgMembers, orgs, users } from "@/lib/db/schema";
import { getAllTags } from "@/lib/queries";

let seq = 0;

async function createUser(
  tags: string[] = [],
  fieldVisibility: Record<string, "public" | "hidden"> = {},
) {
  const id = ++seq;
  const [user] = await db
    .insert(users)
    .values({
      loginEmail: `tag-${id}@test.local`,
      nickname: `标签用户${id}`,
      tags,
      fieldVisibility,
    })
    .returning();
  return user;
}

describe("getAllTags 可见性", () => {
  test("不把隐藏名片、私有组织或已删除需求的标签泄露给无权用户", async () => {
    const viewer = await createUser();
    const publicAuthor = await createUser(["公开名片标签"]);
    const hiddenAuthor = await createUser(["隐藏名片标签"], { tags: "hidden" });
    const owner = await createUser();
    const [org] = await db
      .insert(orgs)
      .values({
        name: "标签私有组织",
        ownerId: owner.id,
        inviteCode: `TAGORG${seq}`,
      })
      .returning();
    await db
      .insert(orgMembers)
      .values({ orgId: org.id, userId: owner.id, role: "owner" });

    await db.insert(needs).values([
      {
        userId: publicAuthor.id,
        type: "offer",
        title: "公开标签需求",
        tags: ["公开需求标签"],
      },
      {
        userId: owner.id,
        orgId: org.id,
        type: "offer",
        title: "私有标签需求",
        tags: ["私有组织标签"],
      },
      {
        userId: publicAuthor.id,
        type: "offer",
        title: "已删除标签需求",
        tags: ["已删除需求标签"],
        status: "closed",
        deletedAt: new Date(),
      },
    ]);

    const outsiderTags = await getAllTags(viewer.id);
    expect(outsiderTags).toContain("公开名片标签");
    expect(outsiderTags).toContain("公开需求标签");
    expect(outsiderTags).not.toContain("隐藏名片标签");
    expect(outsiderTags).not.toContain("私有组织标签");
    expect(outsiderTags).not.toContain("已删除需求标签");

    await db
      .insert(blocks)
      .values({ blockerId: publicAuthor.id, blockedId: viewer.id });
    const blockedTags = await getAllTags(viewer.id);
    expect(blockedTags).not.toContain("公开名片标签");
    expect(blockedTags).not.toContain("公开需求标签");

    await db
      .insert(orgMembers)
      .values({ orgId: org.id, userId: viewer.id, role: "member" });
    expect(await getAllTags(viewer.id)).toContain("私有组织标签");
    expect(hiddenAuthor.id).toBeGreaterThan(0);
  });
});
