import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";
import { needs } from "@/lib/db/schema";

export const PLAZA_SORTS = ["updated", "newest", "expiring"] as const;
export type PlazaSort = (typeof PLAZA_SORTS)[number];

export function normalizePlazaSort(value: string | undefined): PlazaSort {
  return PLAZA_SORTS.includes(value as PlazaSort)
    ? (value as PlazaSort)
    : "updated";
}

export function plazaOrderBy(sort: PlazaSort, now = new Date()): SQL[] {
  if (sort === "newest") {
    return [desc(needs.createdAt), desc(needs.id)];
  }

  if (sort === "expiring") {
    const ongoingWithDeadline = and(
      eq(needs.status, "open"),
      isNotNull(needs.expiresAt),
      gt(needs.expiresAt, now),
    );

    return [
      sql`CASE
        WHEN ${ongoingWithDeadline} THEN 0
        WHEN ${isNull(needs.expiresAt)} THEN 2
        ELSE 1
      END`,
      asc(needs.expiresAt),
      desc(needs.updatedAt),
      desc(needs.id),
    ];
  }

  return [desc(needs.updatedAt), desc(needs.id)];
}
