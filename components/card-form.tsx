"use client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { FormSelect } from "@/components/ui/form-select";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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
import {
  fieldError,
  input as sharedInput,
  panel,
  primaryBtn,
  sectionLabel,
} from "@/lib/ui";
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
  fieldLabel,
  value,
  onChange,
  options,
}: {
  t: UiDict;
  name: string;
  fieldLabel: string;
  value: Visibility;
  onChange: (v: Visibility) => void;
  options: Visibility[];
}) {
  if (options.length > 2) {
    return (
      <FormSelect
        name={name} label={`${fieldLabel} · ${t.card.visibilityLabel}`}
        value={value} onValueChange={(value) => onChange(value as Visibility)}
        className="w-full sm:w-auto"
        options={options.map((opt) => ({ value: opt, label: cardVisibilityLabel(t, opt) }))}
      />
    );
  }
  return (
    <>
      <ToggleGroup type="single" value={value} onValueChange={(v) => { if (v) onChange(v as Visibility); }}
        aria-label={`${fieldLabel} · ${t.card.visibilityLabel}`}>
        {options.map((opt) => <ToggleGroupItem key={opt} value={opt}>{cardVisibilityLabel(t, opt)}</ToggleGroupItem>)}
      </ToggleGroup>
      <input type="hidden" name={name} value={value} />
    </>
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
  // React 19 action 完成后会重置表单；Radix Select 也监听原生 reset。
  // 全部字段受控，并在 form 的捕获阶段阻止 reset，避免保存后显示旧值。
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

  const inputCls = sharedInput;
  const labelCls = sectionLabel;
  const sectionCls = `${panel} p-4`;

  return (
    <form onResetCapture={(event) => { event.preventDefault(); event.stopPropagation(); }} action={formAction} className="flex flex-col gap-4">
      {welcome && (
        <p className="text-xs text-gray">{t.card.welcome}</p>
      )}

      <Card as="section" className={sectionCls}>
        <h2 className={`${labelCls} mb-3 block`}>{t.card.groupBasic}</h2>
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label htmlFor="nickname" className={labelCls}>
                {t.card.nicknameLabel}
              </Label>
              <span className="font-mono text-2xs text-gray">
                {t.card.nicknameAlwaysPublic}
              </span>
            </div>
            <Input
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
              <Label htmlFor="bio" className={labelCls}>
                {t.card.fieldBio}
              </Label>
              <VisibilitySegment
                t={t}
                name="vis_bio"
                fieldLabel={t.card.fieldBio}
                value={visOf("bio")}
                onChange={setVisOf("bio")}
                options={["public", "hidden"]}
              />
            </div>
            <Input
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
                fieldLabel={t.card.fieldTags}
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
              <Label htmlFor="city" className={labelCls}>
                {t.card.fieldCity}
              </Label>
              <VisibilitySegment
                t={t}
                name="vis_city"
                fieldLabel={t.card.fieldCity}
                value={visOf("city")}
                onChange={setVisOf("city")}
                options={["public", "hidden"]}
              />
            </div>
            <Input
              id="city"
              name="city"
              className={inputCls}
              maxLength={LIMITS.city}
              value={fields.city}
              onChange={(e) => setField("city", e.target.value)}
            />
          </div>
        </div>
      </Card>

      {(
        [
          { title: t.card.groupContact, fields: CONTACT_FIELDS },
          { title: t.card.groupSocial, fields: SOCIAL_FIELDS },
        ] as const
      ).map((group) => (
        <Card as="section" key={group.title} className={sectionCls}>
          <h2 className={`${labelCls} mb-3 block`}>{group.title}</h2>
          <p className="mb-3 text-2xs leading-5 text-gray">
            {group.fields === CONTACT_FIELDS
              ? t.card.contactHint
              : t.card.socialHint}
          </p>
          <div className="flex flex-col gap-3">
            {group.fields.map((f) => (
              <div key={f.key}>
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label htmlFor={f.key} className={labelCls}>
                    {cardFieldLabel(t, f.key)}
                  </Label>
                  <VisibilitySegment
                    t={t}
                    name={`vis_${f.key}`}
                    fieldLabel={cardFieldLabel(t, f.key)}
                    value={visOf(f.key)}
                    onChange={setVisOf(f.key)}
                    options={
                      group.fields === CONTACT_FIELDS
                        ? ["connected", "authenticated", "orgs", "hidden"]
                        : ["authenticated", "orgs", "hidden"]
                    }
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
                  <Input
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
        </Card>
      ))}

      {state.error && <p className={fieldError}>{state.error}</p>}
      {state.saved && (
        <p className="text-xs text-gray">
          {state.warning
            ? fmt(t.card.savedWithWarning, { warning: state.warning })
            : t.common.saved}
        </p>
      )}
      <Button variant="plain" size="plain"
        type="submit"
        disabled={pending}
        className={primaryBtn}
      >
        {pending ? t.common.saving : t.common.save}
      </Button>
    </form>
  );
}
