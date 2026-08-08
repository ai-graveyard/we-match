import "server-only";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { SERVER_DICTS } from "@/lib/i18n/dict";

// 邮件通道可插拔：MAIL_PROVIDER 选择实现，默认 log（开发/演示打日志）。
// 生产设 MAIL_PROVIDER=resend 并配好密钥，否则验证码只会出现在服务端日志里。
//
// 正文由调用方按语言渲染好再传进来（见 lib/i18n/dict/*.server.ts 的 mail 段），
// provider 只负责投递——和短信不同，邮件正文在我们自己手里，不受服务商模板限制。
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}

let warnedProductionLog = false;

class LogMailProvider implements MailProvider {
  async send({ to, subject, text }: MailMessage) {
    if (process.env.NODE_ENV === "production" && !warnedProductionLog) {
      warnedProductionLog = true;
      // 服务端日志固定英文，运维读的不是产品界面
      console.warn(
        "[MAIL] MAIL_PROVIDER is not set to a real provider in production; messages are only printed here and never delivered",
      );
    }
    console.log(`[MAIL] ${to} | ${subject}\n${text}`);
  }
}

// Resend HTTP API，一个 fetch 搞定，不引 SDK。
// 文档：https://resend.com/docs/api-reference/emails/send-email
class ResendMailProvider implements MailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send({ to, subject, text }: MailMessage) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: this.from, to: [to], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => ({}))) as {
        name?: string;
        message?: string;
      };
      // 邮箱打码进日志，避免明文个人信息落盘
      console.error(
        `[MAIL] resend send failed → ${maskEmail(to)}: ${response.status} ${detail.name ?? ""} ${detail.message ?? ""}`,
      );
      throw new Error(SERVER_DICTS[DEFAULT_LOCALE].auth.mailFailed);
    }
  }
}

export function maskEmail(email: string) {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***${email.slice(at)}`;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`MAIL_PROVIDER=resend requires env var ${name}`);
  }
  return value;
}

function createProvider(): MailProvider {
  const name = process.env.MAIL_PROVIDER ?? "log";
  if (name === "resend") {
    return new ResendMailProvider(
      requireEnv("RESEND_API_KEY"),
      // 发信人须是已在 Resend 验证过的域名，如 "We Match <noreply@wematch.v2ai.org>"
      requireEnv("MAIL_FROM"),
    );
  }
  if (name === "log") return new LogMailProvider();
  throw new Error(`Unknown MAIL_PROVIDER: ${name} (expected resend or log)`);
}

// 延迟到首次发送才读环境变量，避免 next build 阶段因缺密钥而失败
let cached: MailProvider | undefined;
export function getMailProvider(): MailProvider {
  return (cached ??= createProvider());
}

// 邮件是否真的会到用户信箱。log 通道只写日志和后台，得引导用户去要验证码。
export function isMailDeliveryEnabled() {
  return (process.env.MAIL_PROVIDER ?? "log") !== "log";
}
