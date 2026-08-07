import "server-only";
import crypto from "node:crypto";

// 短信通道可插拔：SMS_PROVIDER 选择实现，默认 log（开发/演示打日志）。
// 生产设 SMS_PROVIDER=aliyun 并配好密钥，否则验证码只会出现在服务端日志里。
export interface SmsProvider {
  sendVerificationCode(phone: string, code: string): Promise<void>;
}

let warnedProductionLog = false;

class LogSmsProvider implements SmsProvider {
  async sendVerificationCode(phone: string, code: string) {
    if (process.env.NODE_ENV === "production" && !warnedProductionLog) {
      warnedProductionLog = true;
      console.warn(
        "[SMS] 警告：生产环境未配置真实短信通道（SMS_PROVIDER=aliyun），验证码只打印在日志，用户收不到短信",
      );
    }
    console.log(`[SMS] 验证码 ${code} → ${phone}（5 分钟内有效）`);
  }
}

// RFC 3986 百分号编码；encodeURIComponent 会放过 !'()*，需补编
function percentEncode(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

interface AliyunConfig {
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
  endpoint: string;
}

// 阿里云短信 SendSms，ACS3-HMAC-SHA256 签名直调 OpenAPI，不引 SDK。
// 文档：https://help.aliyun.com/zh/sdk/product-overview/v3-request-structure-and-signature
class AliyunSmsProvider implements SmsProvider {
  constructor(private readonly config: AliyunConfig) {}

  async sendVerificationCode(phone: string, code: string) {
    const { accessKeyId, accessKeySecret, signName, templateCode, endpoint } =
      this.config;
    const query: Record<string, string> = {
      PhoneNumbers: phone,
      SignName: signName,
      TemplateCode: templateCode,
      TemplateParam: JSON.stringify({ code }),
    };
    const canonicalQuery = Object.keys(query)
      .sort()
      .map((k) => `${percentEncode(k)}=${percentEncode(query[k])}`)
      .join("&");

    const headers: Record<string, string> = {
      host: endpoint,
      "x-acs-action": "SendSms",
      "x-acs-content-sha256": sha256Hex(""),
      "x-acs-date": new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      "x-acs-signature-nonce": crypto.randomUUID(),
      "x-acs-version": "2017-05-25",
    };
    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames
      .map((name) => `${name}:${headers[name].trim()}\n`)
      .join("");
    const signedHeaders = signedHeaderNames.join(";");
    const canonicalRequest = [
      "POST",
      "/",
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      headers["x-acs-content-sha256"],
    ].join("\n");
    const stringToSign = `ACS3-HMAC-SHA256\n${sha256Hex(canonicalRequest)}`;
    const signature = crypto
      .createHmac("sha256", accessKeySecret)
      .update(stringToSign)
      .digest("hex");

    const response = await fetch(`https://${endpoint}/?${canonicalQuery}`, {
      method: "POST",
      headers: {
        ...headers,
        Authorization: `ACS3-HMAC-SHA256 Credential=${accessKeyId},SignedHeaders=${signedHeaders},Signature=${signature}`,
      },
      signal: AbortSignal.timeout(10_000),
    });
    const result = (await response.json().catch(() => ({}))) as {
      Code?: string;
      Message?: string;
    };
    if (!response.ok || result.Code !== "OK") {
      // 手机号打码进日志，避免明文个人信息落盘
      console.error(
        `[SMS] 阿里云发送失败 → ${phone.slice(0, 3)}****${phone.slice(-4)}：${result.Code ?? response.status} ${result.Message ?? ""}`,
      );
      throw new Error("短信发送失败，请稍后再试");
    }
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`SMS_PROVIDER=aliyun 需要配置环境变量 ${name}`);
  }
  return value;
}

function createProvider(): SmsProvider {
  const name = process.env.SMS_PROVIDER ?? "log";
  if (name === "aliyun") {
    return new AliyunSmsProvider({
      accessKeyId: requireEnv("ALIBABA_CLOUD_ACCESS_KEY_ID"),
      accessKeySecret: requireEnv("ALIBABA_CLOUD_ACCESS_KEY_SECRET"),
      signName: requireEnv("ALIYUN_SMS_SIGN_NAME"),
      templateCode: requireEnv("ALIYUN_SMS_TEMPLATE_CODE"),
      endpoint: process.env.ALIYUN_SMS_ENDPOINT ?? "dysmsapi.aliyuncs.com",
    });
  }
  if (name === "log") return new LogSmsProvider();
  throw new Error(`未知的 SMS_PROVIDER：${name}（可选 aliyun / log）`);
}

// 延迟到首次发送才读环境变量，避免 next build 阶段因缺密钥而失败
let cached: SmsProvider | undefined;
export function getSmsProvider(): SmsProvider {
  return (cached ??= createProvider());
}

// 短信是否真的会到用户手机上。log 通道只写日志和后台，得引导用户去要验证码。
export function isSmsDeliveryEnabled() {
  return (process.env.SMS_PROVIDER ?? "log") !== "log";
}
