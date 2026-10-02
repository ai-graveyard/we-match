import { describe, expect, test } from "vitest";
import { fieldVisibility, canSee, visibleCard } from "@/lib/card";
import type { User } from "@/lib/db/schema";

function user(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    loginEmail: "a@test.local",
    nickname: "甲",
    bio: "介绍",
    tags: ["前端"],
    city: "杭州",
    wechat: "wx_a",
    email: "a@test.local",
    contactPhone: null,
    weixinMp: "mp",
    weixinChannels: null,
    xiaohongshu: null,
    weibo: null,
    fieldVisibility: {},
    connectionEmailEnabled: true,
    status: "active",
    suspendedAt: null,
    deletedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("联系方式默认 connected", () => {
  test("未记录的联系方式按连接后可见；社媒仍是登录可见", () => {
    expect(fieldVisibility({}, "email")).toBe("connected");
    expect(fieldVisibility({}, "wechat")).toBe("connected");
    expect(fieldVisibility({}, "weixinMp")).toBe("authenticated");
    expect(fieldVisibility({}, "bio")).toBe("public");
  });

  test("用户主动写成 authenticated 的联系方式予以保留", () => {
    expect(fieldVisibility({ email: "authenticated" }, "email")).toBe(
      "authenticated",
    );
  });

  test("历史 public 联系方式收紧为 connected", () => {
    expect(fieldVisibility({ email: "public" }, "email")).toBe("connected");
  });
});

describe("canSee / visibleCard", () => {
  test("未连接的登录用户拿不到联系方式原值", () => {
    const card = visibleCard(user(), { loggedIn: true, sharesOrg: false });
    expect(card.contacts).toEqual([]);
    expect(card.socials.map((item) => item.key)).toEqual(["weixinMp"]);
  });

  test("只下发揭示过的那一项", () => {
    const card = visibleCard(user(), {
      loggedIn: true,
      sharesOrg: false,
      revealedFields: new Set(["wechat"]),
    });
    expect(card.contacts.map((item) => item.key)).toEqual(["wechat"]);
    expect(card.contacts[0].value).toBe("wx_a");
  });

  test("共同组织可见不穿透 connected 档", () => {
    expect(
      canSee({}, "email", { loggedIn: true, sharesOrg: true }),
    ).toBe(false);
    expect(
      canSee({ email: "orgs" }, "email", { loggedIn: true, sharesOrg: true }),
    ).toBe(true);
  });
});
