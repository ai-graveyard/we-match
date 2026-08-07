import type { Need } from "@/lib/db/schema";

export const NEED_LIMITS = {
  title: 50,
  description: 2000,
  tagCount: 10,
  tagLength: 20,
  dailyPublish: 10,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

// 展示文案在 lib/i18n/labels.ts 的 expiryLabel()，这里只留取值与天数
export const EXPIRY_PRESETS = [
  { value: "day", days: 1 },
  { value: "three-days", days: 3 },
  { value: "week", days: 7 },
  { value: "month", days: 30 },
  { value: "permanent", days: null },
] as const;

export type ExpiryPreset = (typeof EXPIRY_PRESETS)[number]["value"];

export function expiryFromPreset(
  preset: Exclude<ExpiryPreset, "permanent">,
  from = new Date(),
): Date {
  const result = new Date(from);
  result.setSeconds(0, 0);
  const days = EXPIRY_PRESETS.find((item) => item.value === preset)?.days;
  result.setTime(result.getTime() + (days ?? 0) * DAY_MS);
  return result;
}

export function hasDeadlinePassed(
  need: Pick<Need, "expiresAt">,
  now = Date.now(),
): boolean {
  return need.expiresAt != null && need.expiresAt.getTime() <= now;
}

export function isExpired(
  need: Pick<Need, "status" | "expiresAt">,
  now = Date.now(),
): boolean {
  return need.status === "open" && hasDeadlinePassed(need, now);
}
