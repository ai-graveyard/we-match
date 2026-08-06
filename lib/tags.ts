// 标签规范化：去重、裁剪长度与数量。名片标签与需求标签共用（上限值恰好一致）
export function normalizeTags(
  input: unknown,
  limits: { count: number; length: number },
): string[] | null {
  if (!Array.isArray(input)) return null;
  return [
    ...new Set(
      input
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().slice(0, limits.length))
        .filter(Boolean),
    ),
  ].slice(0, limits.count);
}
