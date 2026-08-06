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

const VIS_LABELS: Record<Visibility, string> = {
  public: "公开",
  authenticated: "登录可见",
  orgs: "共同组织可见",
  hidden: "隐藏",
};

function VisibilitySegment({
  name,
  value,
  onChange,
  options,
}: {
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
          className={`px-2 py-1 text-[11px] transition-colors duration-100 ${
            i > 0 ? "border-l border-line" : ""
          } ${value === opt ? "bg-ink font-semibold text-panel" : "text-gray hover:text-ink"}`}
        >
          {VIS_LABELS[opt]}
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
    "h-10 w-full rounded-sm border border-line bg-panel px-3 text-sm outline-none transition-colors duration-100 placeholder:text-gray focus:border-ink";
  const labelCls =
    "text-[11px] font-semibold tracking-[0.08em] text-gray";
  const sectionCls = "rounded-md border border-line bg-panel p-4";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {welcome && (
        <p className="text-xs text-gray">
          给自己起个名字吧——其余字段都可以以后再填。
        </p>
      )}

      <section className={sectionCls}>
        <h2 className={`${labelCls} mb-3 block`}>基本信息</h2>
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="nickname" className={labelCls}>
                昵称（必填）
              </label>
              <span className="font-mono text-[11px] text-gray">始终公开</span>
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
                一句话介绍
              </label>
              <VisibilitySegment
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
              <span className={labelCls}>技能/兴趣标签</span>
              <VisibilitySegment
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
                所在城市
              </label>
              <VisibilitySegment
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
          { title: "联系方式", fields: CONTACT_FIELDS },
          { title: "社媒账号", fields: SOCIAL_FIELDS },
        ] as const
      ).map((group) => (
        <section key={group.title} className={sectionCls}>
          <h2 className={`${labelCls} mb-3 block`}>{group.title}</h2>
          <p className="mb-3 text-[11px] leading-5 text-gray">
            不向未登录访客展示；“登录可见”表示任意已登录用户可查看。
          </p>
          <div className="flex flex-col gap-3">
            {group.fields.map((f) => (
              <div key={f.key}>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor={f.key} className={labelCls}>
                    {f.label}
                  </label>
                  <VisibilitySegment
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
          已保存
          {state.warning ? `。注意：${state.warning}` : ""}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-sm bg-accent text-xs font-semibold tracking-[0.08em] text-panel transition-opacity duration-100 active:translate-y-px disabled:opacity-60"
      >
        {pending ? "保存中" : "保存"}
      </button>
    </form>
  );
}
