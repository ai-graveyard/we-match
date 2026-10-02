"use client";

import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import { needDraftKey, parseNeedDraft } from "@/lib/need-draft";
import { DRAFT_UNAVAILABLE, readDraft, writeDraft, subscribeDraft } from "@/lib/browser-draft";
import { PhoneInput } from "@/components/phone-input";
import {
  createNeedAction,
  updateNeedAction,
  type NeedFormState,
} from "@/app/actions/needs";
import {
  EXPIRY_PRESETS,
  NEED_LIMITS,
  expiryFromPreset,
  type ExpiryPreset,
} from "@/lib/needs";
import { TagInput } from "@/components/tag-input";
import { LIMITS, type ContactFieldKey } from "@/lib/card";
import { useDict } from "@/lib/i18n/client";
import { LocaleLink } from "@/lib/i18n/link";
import { fmt } from "@/lib/i18n/fmt";
import {
  cardFieldLabel,
  cardVisibilityLabel,
  expiryLabel,
  intentLabel,
} from "@/lib/i18n/labels";
import {
  chip,
  chipOff,
  chipOn,
  fieldError,
  input as sharedInput,
  panel,
  primaryBtn,
  sectionLabel,
  segmentGroup,
  segmentItem,
  textarea as textareaCls,
  textBtn,
} from "@/lib/ui";

export type NeedFormInitial = {
  id?: number;
  type: "need" | "offer";
  title: string;
  description: string;
  tags: string[];
  scope: string; // "plaza" 或组织 id 字符串
  preferredContact: ContactFieldKey | null;
  expiresAt: string | null;
  expiryPreset?: ExpiryPreset;
};

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(local: string): string {
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function NeedForm({
  userId,
  nickname,
  filledContactFields,
  initial,
  orgs,
  suggestions,
  contactOptions,
  publishHint,
}: {
  userId: number;
  nickname: string;
  filledContactFields: ContactFieldKey[];
  initial: NeedFormInitial;
  orgs: { id: number; name: string }[];
  suggestions: string[];
  contactOptions: {
    key: ContactFieldKey;
    visibility: "connected" | "authenticated" | "orgs";
  }[];
  /** 剩余发布额度，只在快用完时由页面传下来（QUOTA.md 11.1） */
  publishHint?: { remaining: number; limit: number } | null;
}) {
  const t = useDict();
  const draftKey = needDraftKey(userId, initial.id);
  const rawDraft = useSyncExternalStore(subscribeDraft, () => readDraft(draftKey), () => null);
  const [dirty, setDirty] = useState(false);
  const [draftToken, setDraftToken] = useState("");
  function markDirty() {
    setDirty(true);
    if (!draftToken) setDraftToken(crypto.randomUUID());
  }
  const [displayName, setDisplayName] = useState(nickname);
  const emptyContactFields = (["wechat", "email", "contactPhone"] as ContactFieldKey[]).filter((field) => !filledContactFields.includes(field));
  const [inlineContactField, setInlineContactField] = useState<ContactFieldKey>(emptyContactFields[0] ?? "wechat");
  const [inlineContactValue, setInlineContactValue] = useState("");
  const editing = initial.id != null;
  const [state, formAction, pending] = useActionState<NeedFormState, FormData>(
    editing ? updateNeedAction : createNeedAction,
    {},
  );
  const [type, setType] = useState(initial.type);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [tags, setTags] = useState(initial.tags);
  const [scope, setScope] = useState(initial.scope);
  const [preferredContact, setPreferredContact] =
    useState<ContactFieldKey | null>(initial.preferredContact);
  const [deadline, setDeadline] = useState(
    initial.expiresAt ? toLocalInput(initial.expiresAt) : "",
  );
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset | "custom">(
    initial.expiryPreset ?? (initial.expiresAt == null ? "permanent" : "custom"),
  );

  const chooseExpiry = (preset: ExpiryPreset) => {
    markDirty();
    setExpiryPreset(preset);
    if (preset === "permanent") {
      setDeadline("");
      return;
    }
    setDeadline(toLocalInput(expiryFromPreset(preset).toISOString()));
  };

  const labelCls = sectionLabel;
  const eligibleContacts = contactOptions.filter(
    (option) =>
      scope !== "plaza" ||
      option.visibility === "connected" ||
      option.visibility === "authenticated",
  );
  const selectedContact =
    eligibleContacts.find((option) => option.key === preferredContact)?.key ??
    eligibleContacts[0]?.key ??
    "";
  const inlineContact = !editing && eligibleContacts.length === 0 && emptyContactFields.length > 0;
  const recovered = parseNeedDraft(rawDraft, initial, ["plaza", ...orgs.map((org) => String(org.id))]);
  useEffect(() => {
    if (!dirty || pending) return;
    writeDraft(draftKey, title.trim() || description.trim() || tags.length ? JSON.stringify({ version: 1, token: draftToken, fields: { id: initial.id, type, title, description, tags, scope, expiresAt: expiryPreset === "permanent" ? null : toIso(deadline), expiryPreset } }) : null);
  }, [dirty, pending, draftKey, draftToken, initial.id, type, title, description, tags, scope, deadline, expiryPreset]);

  function restoreDraft() {
    if (!recovered) return;
    setType(recovered.type); setTitle(recovered.title); setDescription(recovered.description);
    setTags(recovered.tags); setScope(recovered.scope);
    setDeadline(recovered.expiresAt ? toLocalInput(recovered.expiresAt) : "");
    setExpiryPreset(recovered.expiryPreset ?? (recovered.expiresAt == null ? "permanent" : "custom"));
    const storedToken = rawDraft ? JSON.parse(rawDraft).token : null;
    setDraftToken(typeof storedToken === "string" && /^[\da-f-]{36}$/i.test(storedToken) ? storedToken : crypto.randomUUID());
    setDirty(true);
  }

  return (
    <form
      action={formAction}
      onChangeCapture={markDirty}
      className={`flex flex-col gap-4 ${panel} p-4`}
    >
      {editing && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="draftToken" value={draftToken} />
      {!dirty && recovered && <div className="border-b border-line pb-4">
        <p className="text-xs text-gray">{t.need.formDraftAvailable}</p>
        <div className="mt-2 flex gap-4">
          <button type="button" className={textBtn} onClick={restoreDraft}>{t.need.formDraftRestore}</button>
          <button type="button" className={textBtn} onClick={() => writeDraft(draftKey, null)}>{t.need.formDraftDiscard}</button>
        </div>
      </div>}

      <div>
        <span className={`${labelCls} mb-1 block`}>{t.need.formType}</span>
        <div className={segmentGroup}>
          {(["need", "offer"] as const).map((opt, i) => (
            <button
              key={opt}
              type="button"
              onClick={() => { markDirty(); setType(opt); }}
              className={segmentItem(type === opt, i === 0)}
            >
              {intentLabel(t, opt)}
            </button>
          ))}
        </div>
        <input type="hidden" name="type" value={type} />
      </div>

      <div>
        <label htmlFor="title" className={`${labelCls} mb-1 block`}>
          {fmt(t.need.formTitle, { max: NEED_LIMITS.title })}
        </label>
        <input
          id="title"
          name="title"
          className={sharedInput}
          maxLength={NEED_LIMITS.title}
          required
          placeholder={type === "need" ? t.need.formTitlePlaceholderNeed : t.need.formTitlePlaceholderOffer}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="description" className={`${labelCls} mb-1 block`}>
          {t.need.formDescription}
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          className={textareaCls}
          maxLength={NEED_LIMITS.description}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p className="mt-1 text-2xs leading-relaxed text-gray">{t.need.formDescriptionHint}</p>
        {!description && <button type="button" className={`${textBtn} mt-2`} onClick={() => { markDirty(); setDescription(type === "need" ? t.need.formTemplateNeed : t.need.formTemplateOffer); }}>{t.need.formUseTemplate}</button>}
      </div>

      <div>
        <span className={`${labelCls} mb-1 block`}>{t.need.formTags}</span>
        <TagInput
          value={tags}
          onChange={(value) => { markDirty(); setTags(value); }}
          suggestions={suggestions}
          maxCount={NEED_LIMITS.tagCount}
          maxLength={NEED_LIMITS.tagLength}
        />
      </div>

      <div>
        <span className={`${labelCls} mb-1 block`}>{t.need.formDeadline}</span>
        <div className="flex flex-wrap gap-1.5">
          {EXPIRY_PRESETS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => chooseExpiry(option.value)}
              className={`${chip} ${
                expiryPreset === option.value ? chipOn : chipOff
              }`}
            >
              {expiryLabel(t, option.value)}
            </button>
          ))}
        </div>
        {expiryPreset === "permanent" ? (
          <p className="mt-2 text-2xs text-gray">{t.need.formPermanentHint}</p>
        ) : (
          <input
            type="datetime-local"
            aria-label={t.need.formDeadlineCustom}
            className={`${sharedInput} mt-2 font-mono text-xs`}
            required
            value={deadline}
            onChange={(event) => {
              setDeadline(event.target.value);
              setExpiryPreset("custom");
            }}
          />
        )}
        <input
          type="hidden"
          name="expiresAt"
          value={expiryPreset === "permanent" ? "" : toIso(deadline)}
        />
        <input
          type="hidden"
          name="permanent"
          value={expiryPreset === "permanent" ? "1" : "0"}
        />
      </div>

      <div>
        <span className={`${labelCls} mb-1 block`}>{t.need.formScope}</span>
        {editing ? (
          <p className="text-xs text-gray">
            {fmt(t.need.formScopeLocked, {
              scope:
                initial.scope === "plaza"
                  ? t.need.formScopePlaza
                  : (orgs.find((o) => String(o.id) === initial.scope)?.name ??
                    t.need.formScopeOrg),
            })}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {[{ id: "plaza", name: t.need.formScopePlaza }, ...orgs.map((o) => ({ id: String(o.id), name: o.name }))].map(
                (opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { markDirty(); setScope(opt.id); }}
                    className={`${chip} ${scope === opt.id ? chipOn : chipOff}`}
                  >
                    {opt.name}
                  </button>
                ),
              )}
            </div>
            {orgs.length === 0 && (
              <p className="mt-1 text-2xs text-gray">
                {t.need.formScopeEmptyHint}
              </p>
            )}
          </>
        )}
        <input type="hidden" name="scope" value={scope} />
      </div>

      <div>
        <span className={`${labelCls} mb-1 block`}>
          {t.need.formPreferredContact}
        </span>
        {eligibleContacts.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {eligibleContacts.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setPreferredContact(option.key)}
                  className={`${chip} ${
                    selectedContact === option.key ? chipOn : chipOff
                  }`}
                >
                  {cardFieldLabel(t, option.key)}
                  {option.visibility === "orgs" && (
                    <span className="ml-1 font-mono text-3xs opacity-70">
                      {cardVisibilityLabel(t, "orgs")}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-2 text-2xs leading-5 text-gray">
              {t.need.formPreferredContactHint}
            </p>
          </>
        ) : inlineContact ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold">{t.need.formInlineContactTitle}</p>
            <div><label htmlFor="publish-nickname" className={`${labelCls} mb-1 block`}>{t.need.formNickname}</label>
              <input id="publish-nickname" name="nickname" className={sharedInput} required maxLength={LIMITS.nickname} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {emptyContactFields.map((field) => <button key={field} type="button" className={`${chip} ${inlineContactField === field ? chipOn : chipOff}`} onClick={() => { setInlineContactField(field); setInlineContactValue(""); }}>{cardFieldLabel(t, field)}</button>)}
            </div>
            <label htmlFor="publish-contact" className={labelCls}>{cardFieldLabel(t, inlineContactField)}</label>
            {inlineContactField === "contactPhone" ? <PhoneInput id="publish-contact" name="inlineContactValue" required value={inlineContactValue} onChange={setInlineContactValue} /> : <input id="publish-contact" name="inlineContactValue" type={inlineContactField === "email" ? "email" : "text"} className={sharedInput} required maxLength={LIMITS.value} value={inlineContactValue} onChange={(event) => setInlineContactValue(event.target.value)} />}
            <input type="hidden" name="inlineContactField" value={inlineContactField} />
            <p className="text-2xs leading-relaxed text-gray">{t.need.formInlineContactHint}</p>
          </div>
        ) : (
          <p className="text-2xs leading-5 text-gray">
            {t.need.formNoContactPrefix}
            <LocaleLink href="/me/card" className="ml-1 text-ink underline">
              {t.need.formNoContactLink}
            </LocaleLink>
          </p>
        )}
        <input
          type="hidden"
          name="preferredContact"
          value={inlineContact ? inlineContactField : selectedContact}
        />
      </div>

      {state.error && <p className={fieldError}>{state.error}</p>}
      {rawDraft === DRAFT_UNAVAILABLE ? <p role="status" className="text-2xs text-gray">{t.need.formDraftUnavailable}</p> : dirty && rawDraft && <p role="status" className="text-2xs text-gray">{t.need.formDraftSaved}</p>}
      <button
        type="submit"
        disabled={pending}
        className={primaryBtn}
      >
        {pending
          ? t.common.submitting
          : editing
            ? t.need.formSubmitEdit
            : t.need.formSubmitCreate}
      </button>
      {!editing && publishHint && (
        <p className="-mt-2 text-center font-mono text-3xs text-gray">
          {fmt(t.quota.remaining, {
            n: publishHint.remaining,
            max: publishHint.limit,
          })}
        </p>
      )}
    </form>
  );
}
