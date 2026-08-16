import "server-only";

import {
  and,
  desc,
  eq,
  gt,
  gte,
  isNull,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { blocks, needs, orgMembers, users, type Need } from "@/lib/db/schema";
import { notify } from "@/lib/activity";
import { getMembership } from "@/lib/queries";

const MATCH_NOTIFICATION_OWNER_LIMIT = 10;

export type MatchCandidate = {
  need: Need;
  author: { id: number; nickname: string };
  matchedTags: string[];
};

export type MatchCandidateResult =
  | { source: Need; candidates: MatchCandidate[] }
  | { error: "not_found" | "not_open" };

function sharedTags(source: Need, candidate: Need): string[] {
  const candidateTags = new Set(candidate.tags);
  return source.tags.filter((tag) => candidateTags.has(tag));
}

/**
 * 平台只做结构化召回，不做最终语义判断：方向、范围、状态、权限是硬条件；
 * 精确重合标签只影响排序。零重合候选仍返回给端侧 Agent 识别同义表达。
 */
export async function getMatchCandidates(
  userId: number,
  sourceNeedId: number,
  options: { since?: Date | null; limit?: number } = {},
): Promise<MatchCandidateResult> {
  const [source] = await db
    .select()
    .from(needs)
    .where(
      and(
        eq(needs.id, sourceNeedId),
        eq(needs.userId, userId),
        isNull(needs.deletedAt),
      ),
    )
    .limit(1);
  if (!source) return { error: "not_found" };
  if (source.orgId != null && !(await getMembership(source.orgId, userId))) {
    return { error: "not_found" };
  }
  if (
    source.status !== "open" ||
    source.moderationStatus !== "visible" ||
    (source.expiresAt != null && source.expiresAt.getTime() <= Date.now())
  ) {
    return { error: "not_open" };
  }

  const conds: SQL[] = [
    source.orgId == null ? isNull(needs.orgId) : eq(needs.orgId, source.orgId),
    eq(needs.type, source.type === "need" ? "offer" : "need"),
    ne(needs.userId, userId),
    eq(needs.status, "open"),
    eq(needs.moderationStatus, "visible"),
    isNull(needs.deletedAt),
    or(isNull(needs.expiresAt), gt(needs.expiresAt, new Date()))!,
    eq(users.status, "active"),
  ];
  if (source.orgId != null) {
    conds.push(
      sql`exists (
        select 1 from ${orgMembers}
        where ${orgMembers.orgId} = ${source.orgId}
          and ${orgMembers.userId} = ${needs.userId}
      )`,
    );
  }
  if (options.since) conds.push(gte(needs.updatedAt, options.since));

  const blockedRows = await db
    .select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
    .from(blocks)
    .where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));
  const hiddenUserIds = blockedRows.map((row) =>
    row.blockerId === userId ? row.blockedId : row.blockerId,
  );
  if (hiddenUserIds.length > 0) {
    conds.push(notInArray(needs.userId, hiddenUserIds));
  }

  const overlapCount =
    source.tags.length > 0
      ? sql<number>`(
          select count(1)
          from json_each(${needs.tags}) as candidate_tag
          where candidate_tag.value in (${sql.join(
            source.tags.map((tag) => sql`${tag}`),
            sql`, `,
          )})
        )`
      : sql<number>`0`;

  const rows = await db
    .select({
      need: needs,
      author: { id: users.id, nickname: users.nickname },
      overlapCount,
    })
    .from(needs)
    .innerJoin(users, eq(needs.userId, users.id))
    .where(and(...conds))
    .orderBy(desc(overlapCount), desc(needs.updatedAt), desc(needs.id))
    .limit(Math.min(Math.max(options.limit ?? 20, 1), 100));

  return {
    source,
    candidates: rows.map((row) => ({
      need: row.need,
      author: row.author,
      matchedTags: sharedTags(source, row.need),
    })),
  };
}

/**
 * 新帖子出现时只用精确标签触发通知，避免零标签/纯语义候选制造噪声。
 * 候选 API 仍返回零重合项，供 Agent 主动例程做更宽的语义判断。
 */
export async function notifyMatchesForNewNeed(need: Need): Promise<void> {
  if (need.tags.length === 0) return;
  const result = await getMatchCandidates(need.userId, need.id, { limit: 100 });
  if ("error" in result) return;
  const exact = result.candidates.filter((item) => item.matchedTags.length > 0);
  if (exact.length === 0) return;

  const oppositeType = need.type === "need" ? "offer" : "need";
  await notify({
    userId: need.userId,
    payload: { type: "matches_available", n: exact.length, need: need.title },
    href: `/?type=${oppositeType}&tag=${encodeURIComponent(exact[0].matchedTags[0])}`,
  });

  // 同一个已有用户可能有多条需求命中新帖子；只发一次，避免通知轰炸。
  const bestByOwner = new Map<number, MatchCandidate>();
  for (const item of exact) {
    if (!bestByOwner.has(item.author.id)) bestByOwner.set(item.author.id, item);
  }
  await Promise.all(
    [...bestByOwner.values()]
      .slice(0, MATCH_NOTIFICATION_OWNER_LIMIT)
      .map((item) =>
        notify({
          userId: item.author.id,
          payload: {
            type: "matching_need_added",
            need: item.need.title,
            candidate: need.title,
            candidateId: need.id,
          },
          href: `/needs/${need.id}`,
        }),
      ),
  );
}
