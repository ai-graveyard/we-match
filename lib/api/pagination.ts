export type ApiCursor = { at: Date; id: number };

export function parseSince(value: string | null): Date | null | "invalid" {
  if (value == null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

export function encodeCursor(at: Date, id: number): string {
  return Buffer.from(JSON.stringify([at.getTime(), id])).toString("base64url");
}

export function decodeCursor(value: string | null): ApiCursor | null | "invalid" {
  if (value == null) return null;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 2 ||
      !Number.isSafeInteger(parsed[0]) ||
      !Number.isSafeInteger(parsed[1]) ||
      parsed[0] <= 0 ||
      parsed[1] <= 0
    ) {
      return "invalid";
    }
    return { at: new Date(parsed[0]), id: parsed[1] };
  } catch {
    return "invalid";
  }
}

export function apiLimit(value: string | null, defaultValue = 50): number {
  const parsed = Number(value);
  const normalized = Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
  return Math.min(Math.max(Math.floor(normalized), 1), 100);
}
