"use client";

import { useActionState, useState } from "react";
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
import type { ContactFieldKey } from "@/lib/card";
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
  initial,
  orgs,
  suggestions,
  contactOptions,
  publishHint,
}: {
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

  return (
    <form
      action={formAction}
      className={`flex flex-col gap-4 ${panel} p-4`}
    >
      {editing && <input type="hidden" name="id" value={initial.id} />}

      <div>
        <span className={`${labelCls} mb-1 block`}>{t.need.formType}</span>
        <div className={segmentGroup}>
          {(["need", "offer"] as const).map((opt, i) => (
            <button
              key={opt}
              type="button"
              onClick={() => setType(opt)}
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
      </div>

      <div>
        <span className={`${labelCls} mb-1 block`}>{t.need.formTags}</span>
        <TagInput
          value={tags}
          onChange={setTags}
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
                    onClick={() => setScope(opt.id)}
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
          value={selectedContact}
        />
      </div>

      {state.error && <p className={fieldError}>{state.error}</p>}
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
