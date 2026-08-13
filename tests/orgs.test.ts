import { describe, expect, test } from "vitest";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  connections,
  contactReveals,
  joinRequests,
  needs,
  orgMembers,
  orgs,
  users,
  type User,
} from "@/lib/db/schema";
import { ORG_LIMITS } from "@/lib/orgs";
import { getMembership } from "@/lib/queries";
import {
  applyByCode,
  applyPlaza,
  createOrg,
  dissolveOrg,
  handleJoinRequest,
  promoteOrgAdmin,
} from "@/lib/orgs-service";
import { expressInterest, handleConnection } from "@/lib/connections-service";
import { SERVER_DICTS } from "@/lib/i18n/dict";
import { fmt } from "@/lib/i18n/fmt";

const t = SERVER_DICTS.zh;
const DAY = 24 * 60 * 60 * 1000;

let userSeq = 0;

async function reload(userId: number): Promise<User> {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row;
}

async function createUser(): Promise<User> {
  const seq = ++userSeq;
  const [user] = await db
    .insert(users)
    .values({ loginEmail: `org-${seq}@test.local`, nickname: `组织用户${seq}` })
    .returning();
  return user;
}

async function getPendingRequest(orgId: number, userId: number) {
  const [row] = await db
    .select()
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.orgId, orgId),
        eq(joinRequests.userId, userId),
        eq(joinRequests.status, "pending"),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function getOrg(orgId: number) {
  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
  return org;
}

// 直接塞满加入数上限：走 createOrg 会先撞上每日建组织额度，那不是这里要测的东西
async function fillJoinedOrgs(user: User) {
  for (let i = 0; i < ORG_LIMITS.maxJoined; i++) {
    const [org] = await db
      .insert(orgs)
      .values({
        name: `满员${user.id}-${i}`,
        ownerId: user.id,
        inviteCode: `FILL${user.id}X${i}`,
      })
      .returning({ id: orgs.id });
    await db
      .insert(orgMembers)
      .values({ orgId: org.id, userId: user.id, role: "owner" });
  }
}

describe("createOrg", () => {
  test("创建者成为 owner", async () => {
    const owner = await createUser();
    const result = await createOrg(
      owner,
      { name: "测试圈", description: null, visibility: "private" },
      t,
    );
    expect("orgId" in result).toBe(true);
    if (!("orgId" in result)) return;
    const membership = await getMembership(result.orgId, owner.id);
    expect(membership?.role).toBe("owner");
  });

  test("空名称被拒", async () => {
    const owner = await createUser();
    const result = await createOrg(
      owner,
      { name: "  ", description: null, visibility: "private" },
      t,
    );
    expect(result).toEqual({ error: t.org.emptyName });
  });
});

describe("组织审批", () => {
  test("邀请码申请 → 管理员通过 → 成为 member", async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const created = await createOrg(
      owner,
      { name: "审批圈", description: null, visibility: "private" },
      t,
    );
    if (!("orgId" in created)) throw new Error("createOrg failed");
    const org = await getOrg(created.orgId);
    const applied = await applyByCode(applicant, org!.inviteCode, t);
    expect(applied).toEqual({ orgName: "审批圈" });

    const request = await getPendingRequest(created.orgId, applicant.id);
    expect(request?.via).toBe("code");
    const handled = await handleJoinRequest(
      owner,
      { requestId: request!.id, decision: "approve" },
      t,
    );
    expect(handled).toEqual({});
    expect((await getMembership(created.orgId, applicant.id))?.role).toBe("member");
  });

  test("管理员拒绝后申请人不是成员，可再次申请", async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const created = await createOrg(
      owner,
      { name: "拒绝圈", description: null, visibility: "public" },
      t,
    );
    if (!("orgId" in created)) throw new Error("createOrg failed");
    await applyPlaza(applicant, created.orgId, t);
    const request = await getPendingRequest(created.orgId, applicant.id);
    await handleJoinRequest(owner, { requestId: request!.id, decision: "reject" }, t);
    expect(await getMembership(created.orgId, applicant.id)).toBeNull();

    const again = await applyPlaza(applicant, created.orgId, t);
    expect(again).toEqual({ ok: true });
  });

  test("已是成员或已有 pending 申请时不能再申请", async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const created = await createOrg(
      owner,
      { name: "重复圈", description: null, visibility: "public" },
      t,
    );
    if (!("orgId" in created)) throw new Error("createOrg failed");
    await applyPlaza(applicant, created.orgId, t);
    expect(await applyPlaza(applicant, created.orgId, t)).toEqual({
      error: t.org.alreadyApplied,
    });

    const request = await getPendingRequest(created.orgId, applicant.id);
    await handleJoinRequest(owner, { requestId: request!.id, decision: "approve" }, t);
    expect(await applyPlaza(applicant, created.orgId, t)).toEqual({
      error: t.org.alreadyMember,
    });
  });

  test("私有组织不接受广场申请", async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const created = await createOrg(
      owner,
      { name: "私密圈", description: null, visibility: "private" },
      t,
    );
    if (!("orgId" in created)) throw new Error("createOrg failed");
    expect(await applyPlaza(applicant, created.orgId, t)).toEqual({
      error: t.org.notFound,
    });
  });

  test("非管理员不能审批", async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const stranger = await createUser();
    const created = await createOrg(
      owner,
      { name: "权限圈", description: null, visibility: "public" },
      t,
    );
    if (!("orgId" in created)) throw new Error("createOrg failed");
    await applyPlaza(applicant, created.orgId, t);
    const request = await getPendingRequest(created.orgId, applicant.id);
    expect(
      await handleJoinRequest(stranger, { requestId: request!.id, decision: "approve" }, t),
    ).toEqual({ error: t.org.adminOnly });
    expect(await getMembership(created.orgId, applicant.id)).toBeNull();
  });

  test("对方已满 3 个组织时通过被拒", async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const created = await createOrg(
      owner,
      { name: "第四个", description: null, visibility: "public" },
      t,
    );
    if (!("orgId" in created)) throw new Error("createOrg failed");
    await applyPlaza(applicant, created.orgId, t);
    await fillJoinedOrgs(applicant);
    const request = await getPendingRequest(created.orgId, applicant.id);
    expect(
      await handleJoinRequest(owner, { requestId: request!.id, decision: "approve" }, t),
    ).toEqual({
      error: fmt(t.org.targetJoinLimit, { max: ORG_LIMITS.maxJoined }),
    });
    expect(await getMembership(created.orgId, applicant.id)).toBeNull();
  });
});

describe("dissolveOrg 级联", () => {
  test("解散组织清掉需求及其举手、揭示、成员与申请", async () => {
    const ownerBase = await createUser();
    await db
      .update(users)
      .set({ email: `owner-${ownerBase.id}@test.local` })
      .where(eq(users.id, ownerBase.id));
    const created = await createOrg(
      ownerBase,
      { name: "解散圈", description: null, visibility: "private" },
      t,
    );
    if (!("orgId" in created)) throw new Error("createOrg failed");
    const orgId = created.orgId;

    const memberBase = await createUser();
    await db
      .update(users)
      .set({ email: `member-${memberBase.id}@test.local` })
      .where(eq(users.id, memberBase.id));
    await db
      .insert(orgMembers)
      .values({ orgId, userId: memberBase.id, role: "member" });
    // 一条待审批申请，验证解散时一并清除
    const applicant = await createUser();
    await db
      .insert(joinRequests)
      .values({ orgId, userId: applicant.id, via: "plaza" });

    const owner = await reload(ownerBase.id);
    const member = await reload(memberBase.id);
    const [need] = await db
      .insert(needs)
      .values({
        userId: owner.id,
        orgId,
        type: "offer",
        title: "组织需求",
        preferredContact: "email",
        expiresAt: new Date(Date.now() + 3 * DAY),
      })
      .returning();
    await expressInterest(member, { needId: need.id, message: "", contact: "email" }, t);
    const [conn] = await db
      .select()
      .from(connections)
      .where(eq(connections.needId, need.id))
      .limit(1);
    await handleConnection(owner, { connectionId: conn.id, decision: "accept" }, t);

    const revealsBefore = await db
      .select({ n: count() })
      .from(contactReveals)
      .where(eq(contactReveals.needId, need.id));
    expect(revealsBefore[0]?.n).toBe(2);

    expect(await dissolveOrg(owner, orgId)).toEqual({ ok: true });

    const [needsLeft] = await db
      .select({ n: count() })
      .from(needs)
      .where(eq(needs.orgId, orgId));
    const [connsLeft] = await db
      .select({ n: count() })
      .from(connections)
      .where(eq(connections.needId, need.id));
    const [revealsLeft] = await db
      .select({ n: count() })
      .from(contactReveals)
      .where(eq(contactReveals.needId, need.id));
    const [membersLeft] = await db
      .select({ n: count() })
      .from(orgMembers)
      .where(eq(orgMembers.orgId, orgId));
    const [requestsLeft] = await db
      .select({ n: count() })
      .from(joinRequests)
      .where(eq(joinRequests.orgId, orgId));
    const [orgLeft] = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);

    expect(needsLeft?.n).toBe(0);
    expect(connsLeft?.n).toBe(0);
    expect(revealsLeft?.n).toBe(0);
    expect(membersLeft?.n).toBe(0);
    expect(requestsLeft?.n).toBe(0);
    expect(orgLeft).toBeUndefined();
  });
});

describe("promoteOrgAdmin", () => {
  test("owner 可把 member 设为 admin", async () => {
    const owner = await createUser();
    const member = await createUser();
    const created = await createOrg(
      owner,
      { name: "任命圈", description: null, visibility: "public" },
      t,
    );
    if (!("orgId" in created)) throw new Error("createOrg failed");
    await applyPlaza(member, created.orgId, t);
    const request = await getPendingRequest(created.orgId, member.id);
    await handleJoinRequest(owner, { requestId: request!.id, decision: "approve" }, t);
    const promoted = await promoteOrgAdmin(
      owner,
      { orgId: created.orgId, userId: member.id },
      t,
    );
    expect(promoted).toEqual({ ok: t.org.promoted });
    expect((await getMembership(created.orgId, member.id))?.role).toBe("admin");
  });
});
