import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, count, desc, eq, gt, gte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users, verificationCodes, type User } from "@/lib/db/schema";
import { getSmsProvider } from "@/lib/sms";

const SESSION_COOKIE = "wm_session";
const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60; // 30 天
const CODE_TTL_MS = 5 * 60 * 1000; // 验证码 5 分钟有效
const CODE_RESEND_INTERVAL_MS = 60 * 1000; // 同号 60 秒一次
const CODE_MAX_FAILS = 5; // 连续失败 5 次作废
const CODE_IP_HOURLY_LIMIT = 10; // 同 IP 每小时 10 次

export const PHONE_RE = /^1[3-9]\d{9}$/;

function sessionSecret() {
  const value = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!value || value.length < 32)) {
    throw new Error("生产环境必须配置至少 32 字符的 SESSION_SECRET");
  }
  return value ?? "we-match-dev-secret";
}

function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sign(token: string) {
  return crypto
    .createHmac("sha256", sessionSecret())
    .update(token)
    .digest("base64url");
}

async function clientIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "127.0.0.1";
}

export async function requestVerificationCode(
  phone: string,
): Promise<{ error?: string }> {
  if (!PHONE_RE.test(phone)) {
    return { error: "请输入大陆 11 位手机号" };
  }
  // 已注销的手机号永久禁止登录，在发码前就拦下，不浪费短信
  const [existing] = await db
    .select({ status: users.status })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);
  if (existing?.status === "deleted") {
    return { error: "该手机号的账号已注销，无法再次登录" };
  }
  const now = Date.now();
  const [latest] = await db
    .select({ createdAt: verificationCodes.createdAt })
    .from(verificationCodes)
    .where(eq(verificationCodes.phone, phone))
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);
  if (latest && now - latest.createdAt.getTime() < CODE_RESEND_INTERVAL_MS) {
    return { error: "发送太频繁，请一分钟后再试" };
  }
  const ip = await clientIp();
  const [ipCount] = await db
    .select({ n: count() })
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.ip, ip),
        gte(verificationCodes.createdAt, new Date(now - 60 * 60 * 1000)),
      ),
    );
  if ((ipCount?.n ?? 0) >= CODE_IP_HOURLY_LIMIT) {
    return { error: "请求过于频繁，请稍后再试" };
  }
  // 开发/演示环境固定 888888，免去查日志；生产随机
  const code =
    process.env.NODE_ENV !== "production"
      ? "888888"
      : crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const [inserted] = await db
    .insert(verificationCodes)
    .values({
      phone,
      code,
      ip,
      expiresAt: new Date(now + CODE_TTL_MS),
    })
    .returning({ id: verificationCodes.id });
  try {
    await getSmsProvider().sendVerificationCode(phone, code);
  } catch (error) {
    console.error("[SMS] 发送验证码失败：", error);
    // 发送失败就作废这条验证码，否则 60 秒重发间隔会卡住用户重试
    await db
      .delete(verificationCodes)
      .where(eq(verificationCodes.id, inserted.id));
    return { error: "短信发送失败，请稍后再试" };
  }
  return {};
}

export async function verifyCodeAndLogin(
  phone: string,
  code: string,
): Promise<{ error?: string; isNew?: boolean }> {
  if (!PHONE_RE.test(phone)) {
    return { error: "请输入大陆 11 位手机号" };
  }
  if (!/^\d{6}$/.test(code)) {
    return { error: "请输入 6 位数字验证码" };
  }
  const [record] = await db
    .select()
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.phone, phone),
        gt(verificationCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);
  if (!record || record.failCount >= CODE_MAX_FAILS) {
    return { error: "验证码无效或已过期，请重新获取" };
  }
  const ok = crypto.timingSafeEqual(Buffer.from(record.code), Buffer.from(code));
  if (!ok) {
    await db
      .update(verificationCodes)
      .set({ failCount: record.failCount + 1 })
      .where(eq(verificationCodes.id, record.id));
    return { error: "验证码错误" };
  }
  await db.delete(verificationCodes).where(eq(verificationCodes.phone, phone));

  let [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  const isNew = !user;
  if (user?.status === "deleted") {
    return { error: "该手机号的账号已注销，无法再次登录" };
  }
  if (user?.status === "suspended") {
    return { error: "账号已暂停使用，如有疑问请联系管理员" };
  }
  if (!user) {
    // 注册即生成默认昵称「用户 + 手机尾号 4 位」，保证任何场景都有可显示的名字
    [user] = await db
      .insert(users)
      .values({ phone, nickname: `用户${phone.slice(-4)}` })
      .returning();
  }

  const token = crypto.randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    id: hashSessionToken(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_S * 1000),
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, `${token}.${sign(token)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    priority: "high",
    maxAge: SESSION_MAX_AGE_S,
    path: "/",
  });
  return { isNew };
}

export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const token = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = sign(token);
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  const tokenHash = hashSessionToken(token);
  const [row] = await db
    .select({ user: users, expiresAt: sessions.expiresAt, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(or(eq(sessions.id, tokenHash), eq(sessions.id, token)))
    .limit(1);
  if (
    !row ||
    row.expiresAt.getTime() < Date.now() ||
    row.user.status !== "active"
  ) return null;
  if (row.sessionId === token) {
    await db
      .update(sessions)
      .set({ id: tokenHash })
      .where(eq(sessions.id, token));
  }
  return row.user;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (raw) {
    const token = raw.slice(0, raw.lastIndexOf("."));
    if (token) {
      await db
        .delete(sessions)
        .where(or(eq(sessions.id, hashSessionToken(token)), eq(sessions.id, token)));
    }
  }
  cookieStore.delete(SESSION_COOKIE);
}
