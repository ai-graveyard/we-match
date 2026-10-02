import { getMatchCandidates } from "@/lib/matches";
import { getDict } from "@/lib/i18n/server";
import { LocaleLink } from "@/lib/i18n/link";
import { NeedCard } from "@/components/need-card";
import { panel, sectionLabel } from "@/lib/ui";
import { fmt } from "@/lib/i18n/fmt";

export async function NeedCandidates({ userId, needId }: { userId: number; needId: number }) {
  const result = await getMatchCandidates(userId, needId, { limit: 3, uniqueAuthors: true });
  if ("error" in result) return null;
  const t = await getDict();
  const query = new URLSearchParams({ type: result.source.type === "need" ? "offer" : "need" });
  if (result.source.orgId != null) query.set("org", String(result.source.orgId));
  return (
    <section id="candidates" className="mt-6 scroll-mt-20">
      <h2 className={sectionLabel}>{t.need.candidatesTitle}</h2>
      <p className="mt-1 text-xs leading-relaxed text-gray">{t.need.candidatesHint}</p>
      {result.candidates.length > 0 ? (
        <div className={`mt-3 overflow-hidden ${panel}`}>
          {result.candidates.map((candidate, i) => (
            <div key={candidate.need.id} className={i ? "border-t border-line" : ""}>
              <NeedCard need={candidate.need} author={{ nickname: candidate.author.nickname, city: null }} first />
              <p className="px-4 pb-3 text-2xs text-gray">
                {candidate.matchedTags.length ? fmt(t.need.candidateTags, { tags: candidate.matchedTags.join(" · ") }) : t.need.candidateNoTags}
              </p>
            </div>
          ))}
        </div>
      ) : <p className={`mt-3 ${panel} p-4 text-xs text-gray`}>{t.need.candidatesEmpty}</p>}
      <LocaleLink href={`/?${query}`} className="mt-3 inline-flex text-xs text-ink underline">{t.need.candidatesBrowse}</LocaleLink>
    </section>
  );
}
