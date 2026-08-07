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
}: {
  initial: NeedFormInitial;
  orgs: { id: number; name: string }[];
  suggestions: string[];
  contactOptions: {
    key: ContactFieldKey;
    visibility: "authenticated" | "orgs";
  }[];
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

  const labelCls = "text-2xs font-semibold tracking-[0.08em] text-gray";
  const inputCls =
    "w-full rounded-sm border border-line bg-panel px-3 text-sm outline-none transition-colors duration-100 placeholder:text-gray focus:border-ink";
  const eligibleContacts = contactOptions.filter(
    (option) => scope !== "plaza" || option.visibility === "authenticated",
  );
  const selectedContact =
    eligibleContacts.find((option) => option.key === preferredContact)?.key ??
    eligibleContacts[0]?.key ??
    "";

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-md border border-line bg-panel p-4"
    >
      {editing && <input type="hidden" name="id" value={initial.id} />}

      <div>
        <span className={`${labelCls} mb-1 block`}>{t.need.formType}</span>
        <div className="inline-flex overflow-hidden rounded-sm border border-line">
          {(["need", "offer"] as const).map((opt, i) => (
            <button
              key={opt}
              type="button"
              onClick={() => setType(opt)}
              className={`px-3 py-1.5 text-xs transition-colors duration-100 ${
                i > 0 ? "border-l border-line" : ""
              } ${type === opt ? "bg-ink font-semibold text-panel" : "text-gray hover:text-ink"}`}
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
          className={`${inputCls} h-11`}
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
          className={`${inputCls} resize-y py-2`}
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
              className={`rounded-sm border px-2.5 py-1 text-xs transition-colors duration-100 ${
                expiryPreset === option.value
                  ? "border-ink bg-ink font-semibold text-panel"
                  : "border-line text-gray hover:text-ink"
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
            className={`${inputCls} mt-2 h-11 font-mono text-xs`}
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
                    className={`rounded-sm border px-2.5 py-1 text-xs transition-colors duration-100 ${
                      scope === opt.id
                        ? "border-ink bg-ink font-semibold text-panel"
                        : "border-line text-gray hover:text-ink"
                    }`}
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
                  className={`rounded-sm border px-2.5 py-1 text-xs transition-colors duration-100 ${
                    selectedContact === option.key
                      ? "border-ink bg-ink font-semibold text-panel"
                      : "border-line text-gray hover:text-ink"
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

      {state.error && <p className="text-xs text-ink">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-sm bg-accent text-sm font-semibold tracking-[0.06em] text-panel transition-opacity duration-100 active:translate-y-px disabled:opacity-60"
      >
        {pending
          ? t.common.submitting
          : editing
            ? t.need.formSubmitEdit
            : t.need.formSubmitCreate}
      </button>
    </form>
  );
}
