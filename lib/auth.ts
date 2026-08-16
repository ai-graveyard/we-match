import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, count, desc, eq, gt, gte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users, verificationCodes, type User } from "@/lib/db/schema";
import { getMailProvider } from "@/lib/mail";
import type { Locale } from "@/lib/i18n/config";
import type { ServerDict } from "@/lib/i18n/dict/types";
import { fmt } from "@/lib/i18n/fmt";

const SESSION_COOKIE = "wm_session";
const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60; // 30 天
const CODE_TTL_MS = 5 * 60 * 1000; // 验证码 5 分钟有效
const CODE_RESEND_INTERVAL_MS = 60 * 1000; // 同邮箱 60 秒一次
export const CODE_MAX_FAILS = 5; // 连续失败 5 次作废
const CODE_IP_HOURLY_LIMIT = 10; // 同 IP 每小时 10 次

export const FIXED_CODE = "888888";

/**
 * 固定验证码模式：所有验证码都是 888888。
 *
 * 开发环境一直开，免去翻日志。生产环境默认关闭；只有显式设置
 * `BETA_MODE=1` 才进入固定码内测。没接 Resend 时宁可让外部用户无法登录，
 * 也不能因为一次漏配把所有邮箱账号自动敞开。
 *
 * 代价必须说清楚：**开着就等于任何人可以登录成任何人**，只有内测期可以接受。
 * `BETA_MODE=1` 只允许明确的小范围测试账号使用。
 */
export function isFixedCodeMode(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.BETA_MODE === "1";
}

let warnedFixedCode = false;
function warnFixedCodeOnce() {
  if (process.env.NODE_ENV !== "production" || warnedFixedCode) return;
  warnedFixedCode = true;
  // 服务端日志固定英文，运维读的不是产品界面
  console.warn(
    `[AUTH] BETA MODE: every verification code is ${FIXED_CODE}. Anyone can sign in as anyone. ` +
      `Before public access, configure MAIL_PROVIDER=resend and keep BETA_MODE different from 1.`,
  );
}

// 实用主义校验，不求 RFC 5322 完备：挡住明显不是邮箱的输入即可，
// 真正的所有权证明是那封验证码邮件本身。
const EMAIL_MAX_LENGTH = 254; // RFC 5321 信封地址上限
const EMAIL_RE = /^[^\s@,;]{1,64}@[^\s@.,;]+(\.[^\s@.,;]+)+$/;

// 统一小写后入库，唯一索引因此大小写不敏感（Foo@x.com 与 foo@x.com 是同一个人）
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= EMAIL_MAX_LENGTH && EMAIL_RE.test(email);
}

// 默认昵称刻意不取邮箱 @ 前的部分：昵称在名片上始终公开，
// 拿 zhang.wei@company.com 当昵称等于把半个邮箱发到广场上。
// 用邮箱哈希的 4 位数字，保持和原来「用户1234」一样的形状且不可逆。
function defaultNicknameSuffix(email: string): string {
  const digest = crypto.createHash("sha256").update(email).digest();
  return (digest.readUInt16BE(0) % 10000).toString().padStart(4, "0");
}

function sessionSecret() {
  const value = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!value || value.length < 32)) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production");
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

export async function clientIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "127.0.0.1";
}

export async function requestVerificationCode(
  rawEmail: string,
  t: ServerDict,
  locale: Locale,
): Promise<{ error?: string }> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return { error: t.auth.badEmail };
  }
  // 已注销的邮箱永久禁止登录，在发码前就拦下，不浪费一封邮件
  const [existing] = await db
    .select({ status: users.status })
    .from(users)
    .where(eq(users.loginEmail, email))
    .limit(1);
  if (existing?.status === "deleted") {
    return { error: t.auth.accountDeleted };
  }
  const now = Date.now();
  const [latest] = await db
    .select({ createdAt: verificationCodes.createdAt })
    .from(verificationCodes)
    .where(eq(verificationCodes.email, email))
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);
  if (latest && now - latest.createdAt.getTime() < CODE_RESEND_INTERVAL_MS) {
    return { error: t.auth.resendTooSoon };
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
    return { error: t.auth.tooManyRequests };
  }
  let code: string;
  if (isFixedCodeMode()) {
    warnFixedCodeOnce();
    code = FIXED_CODE;
  } else {
    code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  }
  const [inserted] = await db
    .insert(verificationCodes)
    .values({
      email,
      code,
      ip,
      expiresAt: new Date(now + CODE_TTL_MS),
    })
    .returning({ id: verificationCodes.id });
  try {
    await getMailProvider().send({
      to: email,
      subject: fmt(t.mail.verificationSubject, { code }),
      text: fmt(t.mail.verificationText, { code }),
    });
  } catch (error) {
    console.error("[MAIL] failed to send verification code:", error);
    // 发送失败就作废这条验证码，否则 60 秒重发间隔会卡住用户重试
    await db
      .delete(verificationCodes)
      .where(eq(verificationCodes.id, inserted.id));
    return { error: t.auth.mailFailed };
  }
  void locale; // 正文已按请求语言渲染，provider 不需要再判断
  return {};
}

/**
 * 校验验证码并拿到用户（首次出现的邮箱即注册）。不碰 cookie——
 * 网页登录再包一层 session，Agent 注册走 API Key，两条路共用这一段。
 */
export async function verifyCode(
  rawEmail: string,
  code: string,
  t: ServerDict,
): Promise<{ error: string } | { user: User; isNew: boolean }> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return { error: t.auth.badEmail };
  }
  if (!/^\d{6}$/.test(code)) {
    return { error: t.auth.badCode };
  }
  // BEGIN IMMEDIATE 在读验证码前就取得写锁：同一验证码的并发请求只能有
  // 一个进入校验与删除链路，避免“同时读到有效 → 同时签发”的重放窗口。
  return db.transaction(
    (tx) => {
      const record = tx
        .select()
        .from(verificationCodes)
        .where(
          and(
            eq(verificationCodes.email, email),
            gt(verificationCodes.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(verificationCodes.createdAt))
        .limit(1)
        .all()[0];
      if (!record || record.failCount >= CODE_MAX_FAILS) {
        return { error: t.auth.codeExpired };
      }
      const ok = crypto.timingSafeEqual(Buffer.from(record.code), Buffer.from(code));
      if (!ok) {
        tx.update(verificationCodes)
          .set({ failCount: record.failCount + 1 })
          .where(eq(verificationCodes.id, record.id))
          .run();
        return { error: t.auth.codeWrong };
      }
      tx.delete(verificationCodes)
        .where(eq(verificationCodes.email, email))
        .run();

      let user = tx
        .select()
        .from(users)
        .where(eq(users.loginEmail, email))
        .limit(1)
        .all()[0];
      const isNew = !user;
      if (user?.status === "deleted") {
        return { error: t.auth.accountDeleted };
      }
      if (user?.status === "suspended") {
        return { error: t.auth.accountSuspended };
      }
      if (!user) {
        // 注册即生成默认昵称，保证任何场景都有可显示的名字
        user = tx
          .insert(users)
          .values({
            loginEmail: email,
            nickname: fmt(t.auth.defaultNickname, {
              suffix: defaultNicknameSuffix(email),
            }),
          })
          .returning()
          .all()[0];
      }
      return { user, isNew };
    },
    { behavior: "immediate" },
  );
}

export async function startSession(userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    id: hashSessionToken(token),
    userId,
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
}

export async function verifyCodeAndLogin(
  email: string,
  code: string,
  t: ServerDict,
): Promise<{ error?: string; isNew?: boolean }> {
  const result = await verifyCode(email, code, t);
  if ("error" in result) return { error: result.error };
  await startSession(result.user.id);
  return { isNew: result.isNew };
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
