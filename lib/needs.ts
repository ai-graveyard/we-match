import type { Need } from "@/lib/db/schema";

export const NEED_LIMITS = {
  title: 50,
  description: 2000,
  tagCount: 10,
  tagLength: 20,
  dailyPublish: 10,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export const EXPIRY_PRESETS = [
  { value: "day", label: "1 天", days: 1 },
  { value: "three-days", label: "3 天", days: 3 },
  { value: "week", label: "7 天", days: 7 },
  { value: "month", label: "1 个月", days: 30 },
  { value: "permanent", label: "永久", days: null },
] as const;

export type ExpiryPreset = (typeof EXPIRY_PRESETS)[number]["value"];

export const TYPE_LABELS = { need: "需要", offer: "提供" } as const;
export const STATUS_LABELS = {
  open: "开放",
  done: "已完成",
  closed: "已关闭",
} as const;

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
