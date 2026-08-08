import { afterEach, describe, expect, test, vi } from "vitest";
import { isFixedCodeMode } from "@/lib/auth";

// 内测固定码（README「内测模式」/ lib/auth.ts isFixedCodeMode）：
// 开着等于任何人可以登录成任何人，所以每个分支都要钉死，不能靠读代码推断。

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

describe("生产环境的自动判定", () => {
  test("没配邮件通道 = 还在内测，开", () => {
    env({ NODE_ENV: "production", MAIL_PROVIDER: undefined, BETA_MODE: undefined });
    expect(isFixedCodeMode()).toBe(true);
  });

  test("MAIL_PROVIDER=log 同样视为没配", () => {
    env({ NODE_ENV: "production", MAIL_PROVIDER: "log", BETA_MODE: undefined });
    expect(isFixedCodeMode()).toBe(true);
  });

  test("配好 Resend 即自动关闭——正式上线的默认路径", () => {
    env({ NODE_ENV: "production", MAIL_PROVIDER: "resend", BETA_MODE: undefined });
    expect(isFixedCodeMode()).toBe(false);
  });
});

describe("BETA_MODE 覆盖自动判定", () => {
  test("=1 时即使配了 Resend 也开", () => {
    env({ NODE_ENV: "production", MAIL_PROVIDER: "resend", BETA_MODE: "1" });
    expect(isFixedCodeMode()).toBe(true);
  });

  test("=0 时即使没配邮件也关——宁可谁都登不进去", () => {
    env({ NODE_ENV: "production", MAIL_PROVIDER: "log", BETA_MODE: "0" });
    expect(isFixedCodeMode()).toBe(false);
  });

  test("其他值不生效，回落到自动判定", () => {
    env({ NODE_ENV: "production", MAIL_PROVIDER: "resend", BETA_MODE: "true" });
    expect(isFixedCodeMode()).toBe(false);
  });
});
