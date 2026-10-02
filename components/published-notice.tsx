"use client";

import { useEffect } from "react";
import { useDict } from "@/lib/i18n/client";
import { panel } from "@/lib/ui";
import { publishedDraftMatches } from "@/lib/need-draft";

export function PublishedNotice({ draftKey, token, updated = false }: { draftKey: string; token: string | null; updated?: boolean }) {
  const t = useDict();
  useEffect(() => { try { if (publishedDraftMatches(sessionStorage.getItem(draftKey), token)) sessionStorage.removeItem(draftKey); } catch { /* storage may be unavailable */ } }, [draftKey, token]);
  return <p role="status" className={`${panel} mb-4 p-4 text-sm`}>{updated ? t.common.saved : t.need.publishedHint}</p>;
}
