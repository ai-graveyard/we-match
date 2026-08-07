// 与语言无关的时间格式化。带词的相对时间在 lib/i18n/labels.ts，那边要字典。

export function shortDateTime(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}
