import { afterEach, expect, test, vi } from "vitest";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { needs, notifications, orgMembers, orgs, users } from "@/lib/db/schema";
import { notify } from "@/lib/activity";
import { deliverConnectionEmail, sendConnectionEmail } from "@/lib/connection-email";
import * as mail from "@/lib/mail";

let seq = 0;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function fixture() {
  vi.stubEnv("SITE_ORIGIN", "https://wematch.example/path");
  const user = db.insert(users).values({ loginEmail: `recipient-${++seq}@test.local`, nickname: "收件人", wechat: "private_wechat", email: "different-contact@test.local" }).returning().get();
  const need = db.insert(needs).values({ userId: user.id, type: "need", title: "找架构评审" }).returning().get();
  await notify({ userId: user.id, payload: { type: "connection_requested", name: "申请人", need: need.title, needId: need.id, message: "private message" }, href: `/needs/${need.id}` });
  const notification = db.select().from(notifications).where(eq(notifications.userId, user.id)).get()!;
  return { user, need, notification };
}

test("emails the sign-in address with canonical links, without contacts or raise messages", async () => {
  const f = await fixture();
  const send = vi.fn<mail.MailProvider["send"]>().mockResolvedValue(undefined);
  await sendConnectionEmail(f.notification.id, { send });
  const message = send.mock.calls[0][0];
  expect(message.to).toBe(f.user.loginEmail);
  expect(message.text).toContain(`https://wematch.example/zh/needs/${f.need.id}`);
  expect(message.text).not.toContain("private_wechat");
  expect(message.text).not.toContain("different-contact");
  expect(message.text).not.toContain("private message");
  expect(after).toHaveBeenCalled();
});

test("respects opt-out and suspensions at delivery time", async () => {
  const f = await fixture();
  const send = vi.fn<mail.MailProvider["send"]>().mockResolvedValue(undefined);
  await db.update(users).set({ connectionEmailEnabled: false }).where(eq(users.id, f.user.id));
  await sendConnectionEmail(f.notification.id, { send });
  await db.update(users).set({ connectionEmailEnabled: true, status: "suspended" }).where(eq(users.id, f.user.id));
  await sendConnectionEmail(f.notification.id, { send });
  expect(send).not.toHaveBeenCalled();
});

test("does not disclose a private group post after membership is removed", async () => {
  const f = await fixture();
  const org = db.insert(orgs).values({ name: "私有组织", ownerId: f.user.id, inviteCode: `EMAIL${seq}` }).returning().get();
  await db.update(needs).set({ orgId: org.id }).where(eq(needs.id, f.need.id));
  const send = vi.fn<mail.MailProvider["send"]>().mockResolvedValue(undefined);
  await sendConnectionEmail(f.notification.id, { send });
  expect(send).not.toHaveBeenCalled();
  await db.insert(orgMembers).values({ orgId: org.id, userId: f.user.id, role: "owner" });
  await sendConnectionEmail(f.notification.id, { send });
  expect(send).toHaveBeenCalledOnce();
});

test("missing or invalid origins prevent delivery", async () => {
  const f = await fixture();
  const send = vi.fn<mail.MailProvider["send"]>().mockResolvedValue(undefined);
  for (const origin of ["", "javascript:alert(1)", "https://name:secret@wematch.example"]) {
    vi.stubEnv("SITE_ORIGIN", origin);
    await sendConnectionEmail(f.notification.id, { send });
  }
  expect(send).not.toHaveBeenCalled();
});

test("delivery failure keeps the station notification and does not escape the background task", async () => {
  const f = await fixture();
  vi.spyOn(mail, "isMailDeliveryEnabled").mockReturnValue(true);
  vi.spyOn(mail, "getMailProvider").mockReturnValue({ send: async () => { throw new Error("provider failed"); } });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(deliverConnectionEmail(f.notification.id)).resolves.toBeUndefined();
  expect(db.select().from(notifications).where(eq(notifications.id, f.notification.id)).get()).toBeTruthy();
  expect(log.mock.calls.flat().join(" ")).not.toContain(f.user.loginEmail);
});
