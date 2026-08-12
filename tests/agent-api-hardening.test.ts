import { describe, expect, test } from "vitest";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, needs, users, verificationCodes } from "@/lib/db/schema";
import { unknownJsonFields } from "@/lib/api/auth";
import {
  decodeCursor,
  encodeCursor,
  parseSince,
} from "@/lib/api/pagination";
import { createApiKey } from "@/lib/api-keys-service";
import { createNeed } from "@/lib/needs-service";
import { verifyCode } from "@/lib/auth";
import { SERVER_DICTS } from "@/lib/i18n/dict";
import { validateCardPatch } from "@/lib/card-service";

const t = SERVER_DICTS.zh;
let seq = 0;

async function createUser() {
  const id = ++seq;
  const [user] = await db
    .insert(users)
    .values({
      loginEmail: `agent-hardening-${id}@test.local`,
      nickname: `Agent 用户 ${id}`,
      email: `public-${id}@test.local`,
    })
    .returning();
  return user;
}

describe("Agent API strict contracts", () => {
  test("reports unknown JSON fields instead of silently ignoring them", () => {
    expect(unknownJsonFields({ title: "x", orgID: 12 }, ["title", "orgId"]))
      .toEqual(["orgID"]);
  });

  test("preserves explicit default visibility values for API merge", () => {
    const parsed = validateCardPatch(
      { fieldVisibility: { email: "authenticated", city: "public" } },
      t,
      { preserveVisibilityDefaults: true },
    );
    expect("patch" in parsed && parsed.patch.fieldVisibility).toEqual({
      email: "authenticated",
      city: "public",
    });
  });
});

describe("Agent pagination cursors", () => {
  test("round-trips a stable timestamp/id cursor", () => {
    const at = new Date("2026-08-10T08:00:00.123Z");
    expect(decodeCursor(encodeCursor(at, 42))).toEqual({ at, id: 42 });
    expect(decodeCursor("not-a-cursor")).toBe("invalid");
    expect(parseSince("not-a-date")).toBe("invalid");
  });
});

describe("Agent write safety", () => {
  test("reuses a need for the same idempotency key", async () => {
    const user = await createUser();
    const patch = {
      type: "need" as const,
      title: "幂等发布",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    const first = await createNeed(user, patch, null, t, {
      idempotencyKey: "test.logical-post.1",
    });
    const second = await createNeed(user, patch, null, t, {
      idempotencyKey: "test.logical-post.1",
    });
    expect("need" in first && first.replayed).toBe(false);
    expect("need" in second && second.replayed).toBe(true);
    expect("need" in first && "need" in second && first.need.id).toBe(
      "need" in second ? second.need.id : -1,
    );
    const [row] = await db
      .select({ n: count() })
      .from(needs)
      .where(
        and(
          eq(needs.userId, user.id),
          eq(needs.idempotencyKey, "test.logical-post.1"),
        ),
      );
    expect(row.n).toBe(1);
    const conflict = await createNeed(
      user,
      { ...patch, title: "另一条需求" },
      null,
      t,
      { idempotencyKey: "test.logical-post.1" },
    );
    expect(conflict).toEqual({ error: t.need.idempotencyConflict });
  });

  test("a verification code can only be consumed once", async () => {
    const user = await createUser();
    await db.insert(verificationCodes).values({
      email: user.loginEmail,
      code: "123456",
      ip: "127.0.0.1",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => verifyCode(user.loginEmail, "123456", t)),
    );
    expect(results.filter((result) => "user" in result)).toHaveLength(1);
    expect(results.filter((result) => "error" in result)).toHaveLength(4);
  });

  test("concurrent key creation cannot exceed the per-user limit", async () => {
    const user = await createUser();
    await createApiKey(user.id, "one", t);
    await createApiKey(user.id, "two", t);
    const results = await Promise.all([
      createApiKey(user.id, "three-a", t),
      createApiKey(user.id, "three-b", t),
    ]);
    expect(results.filter((result) => "secret" in result)).toHaveLength(1);
    expect(results.filter((result) => "error" in result)).toHaveLength(1);
    const [row] = await db
      .select({ n: count() })
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id));
    expect(row.n).toBe(3);
  });
});
