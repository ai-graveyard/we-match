import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { needs, users } from "@/lib/db/schema";
import { publicAuthor } from "@/lib/public-profile";
import { createNeed } from "@/lib/needs-service";
import { validatePublishingContact } from "@/lib/publishing-contact";
import { SERVER_DICTS } from "@/lib/i18n/dict";
import { needDraftKey, parseNeedDraft, publishedDraftMatches } from "@/lib/need-draft";
import type { NeedFormInitial } from "@/components/need-form";

const t = SERVER_DICTS.zh;
let seq = 0;
const patch = { type: "need" as const, title: "评审后台界面", expiresAt: new Date(Date.now() + 86_400_000) };
async function user() {
  return db.insert(users).values({ loginEmail: `flow-${++seq}@test.local`, nickname: "原昵称", bio: "产品开发", tags: ["产品"], createdAt: new Date(Date.now() - 10 * 86_400_000) }).returning().get();
}

describe("public plaza author projection", () => {
  test("hidden cities never enter list data", async () => {
    const person = await user();
    await db.update(users).set({ city: "隐藏城市", fieldVisibility: { city: "hidden" } }).where(eq(users.id, person.id));
    expect(db.select(publicAuthor).from(users).where(eq(users.id, person.id)).get()?.city).toBeNull();
    await db.update(users).set({ fieldVisibility: {} }).where(eq(users.id, person.id));
    expect(db.select(publicAuthor).from(users).where(eq(users.id, person.id)).get()?.city).toBe("隐藏城市");
  });
});

describe("first publication with an inline contact", () => {
  test("publishes and saves only the chosen contact, with connected visibility", async () => {
    const person = await user();
    await db.update(users).set({ fieldVisibility: { city: "hidden" } }).where(eq(users.id, person.id));
    const result = await createNeed(person, patch, null, t, { publishingContact: { nickname: "小林", field: "wechat", value: "demo_wx" } });
    expect("need" in result).toBe(true);
    const saved = db.select().from(users).where(eq(users.id, person.id)).get()!;
    expect(saved.nickname).toBe("小林");
    expect(saved.wechat).toBe("demo_wx");
    expect(saved.email).toBeNull();
    expect(saved.fieldVisibility).toEqual({ city: "hidden", wechat: "connected" });
    if ("need" in result) expect(result.need.preferredContact).toBe("wechat");
  });

  test("quota rejection leaves the profile untouched", async () => {
    const person = await user();
    await db.insert(needs).values(Array.from({ length: 10 }, (_, i) => ({ userId: person.id, type: "need" as const, title: `历史发布${i}`, status: "closed" as const })));
    const result = await createNeed(person, patch, null, t, { publishingContact: { nickname: "新昵称", field: "email", value: "contact@test.local" } });
    expect("error" in result).toBe(true);
    const saved = db.select().from(users).where(eq(users.id, person.id)).get()!;
    expect(saved.email).toBeNull();
    expect(saved.nickname).toBe("原昵称");
  });

  test("a stale form cannot overwrite a contact saved in another tab", async () => {
    const person = await user();
    await db.update(users).set({ wechat: "newer_contact", fieldVisibility: { wechat: "hidden" } }).where(eq(users.id, person.id));
    const result = await createNeed(person, patch, null, t, { publishingContact: { nickname: "新昵称", field: "wechat", value: "older_contact" } });
    expect(result).toEqual({ error: t.need.inlineContactExists });
    expect(db.select().from(needs).where(eq(needs.userId, person.id)).all()).toHaveLength(0);
    expect(db.select().from(users).where(eq(users.id, person.id)).get()?.wechat).toBe("newer_contact");
  });

  test("rejects invalid email and phone before persistence", () => {
    expect(validatePublishingContact({ nickname: "小林", field: "email", value: "invalid" }, t)).toEqual({ error: t.auth.badEmail });
    expect(validatePublishingContact({ nickname: "小林", field: "contactPhone", value: "123" }, t)).toEqual({ error: t.card.badContactPhone });
  });
});

describe("draft recovery boundaries", () => {
  test("opening an old published receipt cannot clear a newer draft", () => {
    const newerDraft = JSON.stringify({ version: 1, token: "newer-draft" });
    expect(publishedDraftMatches(newerDraft, "older-published-draft")).toBe(false);
    expect(publishedDraftMatches(newerDraft, "newer-draft")).toBe(true);
    expect(publishedDraftMatches(newerDraft, null)).toBe(false);
  });
  const initial: NeedFormInitial = { type: "need", title: "", description: "", tags: [], scope: "plaza", preferredContact: null, expiresAt: null, expiryPreset: "permanent" };
  test("recovers content and rejects inaccessible scopes and malformed data", () => {
    const fields = { ...initial, title: "未提交的需求" };
    const raw = JSON.stringify({ version: 1, fields });
    expect(parseNeedDraft(raw, initial, ["plaza"])?.title).toBe(fields.title);
    expect(parseNeedDraft(JSON.stringify({ version: 1, fields: { ...fields, scope: "99" } }), initial, ["plaza"])).toBeNull();
    expect(parseNeedDraft('{broken', initial, ["plaza"])).toBeNull();
    expect(parseNeedDraft(raw, { ...initial, id: 12 }, ["plaza"])).toBeNull();
    expect(needDraftKey(1)).not.toBe(needDraftKey(2));
  });
});
