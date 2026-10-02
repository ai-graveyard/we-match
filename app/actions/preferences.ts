"use server";
import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getRequestDict } from "@/lib/i18n/request";

export async function setConnectionEmailAction(_previous: { error?: string; saved?: boolean }, formData: FormData): Promise<{ error?: string; saved?: boolean }> {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.sessionExpired };
  const enabled = formData.get("enabled");
  if (enabled !== "0" && enabled !== "1") return { error: t.common.badParams };
  await db.update(users).set({ connectionEmailEnabled: enabled === "1" }).where(eq(users.id, user.id));
  refresh();
  return { saved: true };
}
