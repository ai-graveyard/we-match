import { afterEach, describe, expect, test, vi } from "vitest";
import { isFixedCodeMode } from "@/lib/auth";

// 内测固定码（README「内测模式」/ lib/auth.ts isFixedCodeMode）：
// 生产必须失败关闭，只有显式 BETA_MODE=1 才能打开万能码。

function env(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    vi.stubEnv(key, value as string);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("开发环境", () => {
  test("一直开，免去翻日志", () => {
    env({ NODE_ENV: "development", MAIL_PROVIDER: "resend", BETA_MODE: undefined });
    expect(isFixedCodeMode()).toBe(true);
  });
});

describe("生产环境默认失败关闭", () => {
  test("没配邮件通道也不会自动打开万能码", () => {
    env({ NODE_ENV: "production", MAIL_PROVIDER: undefined, BETA_MODE: undefined });
    expect(isFixedCodeMode()).toBe(false);
  });

  test("MAIL_PROVIDER=log 同样保持关闭", () => {
    env({ NODE_ENV: "production", MAIL_PROVIDER: "log", BETA_MODE: undefined });
    expect(isFixedCodeMode()).toBe(false);
  });

  test("配好 Resend 也默认关闭", () => {
    env({ NODE_ENV: "production", MAIL_PROVIDER: "resend", BETA_MODE: undefined });
    expect(isFixedCodeMode()).toBe(false);
  });
});

describe("BETA_MODE 显式开关", () => {
  test("=1 时即使配了 Resend 也开", () => {
    env({ NODE_ENV: "production", MAIL_PROVIDER: "resend", BETA_MODE: "1" });
    expect(isFixedCodeMode()).toBe(true);
  });

  test("=0 时保持关闭", () => {
    env({ NODE_ENV: "production", MAIL_PROVIDER: "log", BETA_MODE: "0" });
    expect(isFixedCodeMode()).toBe(false);
  });

  test("其他值不生效", () => {
    env({ NODE_ENV: "production", MAIL_PROVIDER: "log", BETA_MODE: "true" });
    expect(isFixedCodeMode()).toBe(false);
  });
});
