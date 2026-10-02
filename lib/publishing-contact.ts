import { LIMITS, PHONE_RE, type ContactFieldKey } from "@/lib/card";
import type { ServerDict } from "@/lib/i18n/dict/types";
import { fmt } from "@/lib/i18n/fmt";

export type PublishingContact = { nickname: string; field: ContactFieldKey; value: string };

export function validatePublishingContact(input: { nickname: unknown; field: unknown; value: unknown }, t: ServerDict): { contact: PublishingContact } | { error: string } {
  const nickname = String(input.nickname ?? "").trim();
  const value = String(input.value ?? "").trim();
  const field = input.field;
  if (!nickname) return { error: t.card.emptyNickname };
  if (nickname.length > LIMITS.nickname) return { error: fmt(t.card.nicknameTooLong, { max: LIMITS.nickname }) };
  if (field !== "email" && field !== "wechat" && field !== "contactPhone") return { error: t.need.badPreferredContact };
  if (!value || value.length > LIMITS.value) return { error: t.need.inlineContactInvalid };
  if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { error: t.auth.badEmail };
  if (field === "contactPhone" && !PHONE_RE.test(value)) return { error: t.card.badContactPhone };
  return { contact: { nickname, field, value } };
}
