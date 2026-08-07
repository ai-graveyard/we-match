"use client";

import { useActionState, useState } from "react";
import { updateCardAction, type CardFormState } from "@/app/actions/card";
import {
  CONTACT_FIELDS,
  SOCIAL_FIELDS,
  LIMITS,
  fieldVisibility,
  type CardFieldVisibility,
  type CardFieldKey,
} from "@/lib/card";
import { TagInput } from "@/components/tag-input";
import { PhoneInput, normalizePhoneInput } from "@/components/phone-input";
import { useDict } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/fmt";
import { cardFieldLabel, cardVisibilityLabel } from "@/lib/i18n/labels";
import type { UiDict } from "@/lib/i18n/dict/types";

type Visibility = CardFieldVisibility;

export type CardFormUser = {
  nickname: string;
  bio: string;
  city: string;
  tags: string[];
  wechat: string;
  email: string;
  contactPhone: string;
  weixinMp: string;
  weixinChannels: string;
  xiaohongshu: string;
  weibo: string;
  fieldVisibility: Partial<Record<CardFieldKey, Visibility>>;
};

function VisibilitySegment({
  t,
  name,
  value,
  onChange,
  options,
}: {
  t: UiDict;
  name: string;
  value: Visibility;
  onChange: (v: Visibility) => void;
  options: Visibility[];
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-sm border border-line">
      {options.map((opt, i) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-2 py-1 text-2xs transition-colors duration-100 ${
            i > 0 ? "border-l border-line" : ""
          } ${value === opt ? "bg-ink font-semibold text-panel" : "text-gray hover:text-ink"}`}
        >
          {cardVisibilityLabel(t, opt)}
        </button>
      ))}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

export function CardForm({
  user,
  suggestions,
  welcome,
}: {
  user: CardFormUser;
  suggestions: string[];
  welcome: boolean;
}) {
  const t = useDict();
  const [state, formAction, pending] = useActionState<CardFormState, FormData>(
    updateCardAction,
    {},
  );
  // React 19 action 完成后会重置非受控表单，全部字段受控
  const [fields, setFields] = useState(() => ({
    ...user,
    // 历史数据可能带 +86/空格等格式，统一按 11 位纯数字展示
    contactPhone: normalizePhoneInput(user.contactPhone),
  }));
  const [vis, setVis] = useState<Partial<Record<CardFieldKey, Visibility>>>(
    user.fieldVisibility,
  );
  const setField = (key: keyof CardFormUser, value: string) =>
    setFields((f) => ({ ...f, [key]: value }));
  const visOf = (key: CardFieldKey): Visibility =>
    fieldVisibility(vis, key);
  const setVisOf = (key: CardFieldKey) => (v: Visibility) =>
    setVis((prev) => ({ ...prev, [key]: v }));

  const inputCls =
    "h-11 w-full rounded-sm border border-line bg-panel px-3 text-sm outline-none transition-colors duration-100 placeholder:text-gray focus:border-ink";
  const labelCls =
    "text-2xs font-semibold tracking-[0.08em] text-gray";
  const sectionCls = "rounded-md border border-line bg-panel p-4";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {welcome && (
        <p className="text-xs text-gray">{t.card.welcome}</p>
      )}

      <section className={sectionCls}>
        <h2 className={`${labelCls} mb-3 block`}>{t.card.groupBasic}</h2>
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="nickname" className={labelCls}>
                {t.card.nicknameLabel}
              </label>
              <span className="font-mono text-2xs text-gray">
                {t.card.nicknameAlwaysPublic}
              </span>
            </div>
            <input
              id="nickname"
              name="nickname"
              className={inputCls}
              maxLength={LIMITS.nickname}
              required
              value={fields.nickname}
              onChange={(e) => setField("nickname", e.target.value)}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="bio" className={labelCls}>
                {t.card.fieldBio}
              </label>
              <VisibilitySegment
                t={t}
                name="vis_bio"
                value={visOf("bio")}
                onChange={setVisOf("bio")}
                options={["public", "hidden"]}
              />
            </div>
            <input
              id="bio"
              name="bio"
              className={inputCls}
              maxLength={LIMITS.bio}
              value={fields.bio}
              onChange={(e) => setField("bio", e.target.value)}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className={labelCls}>{t.card.fieldTags}</span>
              <VisibilitySegment
                t={t}
                name="vis_tags"
                value={visOf("tags")}
                onChange={setVisOf("tags")}
                options={["public", "hidden"]}
              />
            </div>
            <TagInput
              value={fields.tags}
              onChange={(tags) => setFields((f) => ({ ...f, tags }))}
              suggestions={suggestions}
              maxCount={LIMITS.tagCount}
              maxLength={LIMITS.tagLength}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="city" className={labelCls}>
                {t.card.fieldCity}
              </label>
              <VisibilitySegment
                t={t}
                name="vis_city"
                value={visOf("city")}
                onChange={setVisOf("city")}
                options={["public", "hidden"]}
              />
            </div>
            <input
              id="city"
              name="city"
              className={inputCls}
              maxLength={LIMITS.city}
              value={fields.city}
              onChange={(e) => setField("city", e.target.value)}
            />
          </div>
        </div>
      </section>

      {(
        [
          { title: t.card.groupContact, fields: CONTACT_FIELDS },
          { title: t.card.groupSocial, fields: SOCIAL_FIELDS },
        ] as const
      ).map((group) => (
        <section key={group.title} className={sectionCls}>
          <h2 className={`${labelCls} mb-3 block`}>{group.title}</h2>
          <p className="mb-3 text-2xs leading-5 text-gray">
            {t.card.sensitiveHint}
          </p>
          <div className="flex flex-col gap-3">
            {group.fields.map((f) => (
              <div key={f.key}>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor={f.key} className={labelCls}>
                    {cardFieldLabel(t, f.key)}
                  </label>
                  <VisibilitySegment
                    t={t}
                    name={`vis_${f.key}`}
                    value={visOf(f.key)}
                    onChange={setVisOf(f.key)}
                    options={["authenticated", "orgs", "hidden"]}
                  />
                </div>
                {f.key === "contactPhone" ? (
                  <PhoneInput
                    id={f.key}
                    name={f.key}
                    value={fields.contactPhone}
                    onChange={(v) => setField("contactPhone", v)}
                  />
                ) : (
                  <input
                    id={f.key}
                    name={f.key}
                    type={f.key === "email" ? "email" : "text"}
                    inputMode={f.key === "email" ? "email" : undefined}
                    className={inputCls}
                    maxLength={LIMITS.value}
                    value={fields[f.key]}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {state.error && <p className="text-xs text-ink">{state.error}</p>}
      {state.saved && (
        <p className="text-xs text-gray">
          {state.warning
            ? fmt(t.card.savedWithWarning, { warning: state.warning })
            : t.common.saved}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-sm bg-accent text-sm font-semibold tracking-[0.06em] text-panel transition-opacity duration-100 active:translate-y-px disabled:opacity-60"
      >
        {pending ? t.common.saving : t.common.save}
      </button>
    </form>
  );
}
