"use client";

import { useState } from "react";
import { X } from "lucide-react";

// 标签输入：Enter/逗号添加，联想已有标签优先复用（与需求标签共用词库）
export function TagInput({
  value,
  onChange,
  suggestions,
  maxCount,
  maxLength,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  maxCount: number;
  maxLength: number;
}) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);

  const add = (raw: string) => {
    const tag = raw.trim().slice(0, maxLength);
    if (!tag || value.includes(tag) || value.length >= maxCount) return;
    onChange([...value, tag]);
    setDraft("");
  };
  const matched = draft
    ? suggestions.filter((s) => s.includes(draft) && !value.includes(s)).slice(0, 6)
    : [];

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-sm border border-line px-1.5 py-0.5 font-mono text-[11px] text-gray"
            >
              {tag}
              <button
                type="button"
                aria-label={`删除标签 ${tag}`}
                className="flex items-center justify-center text-gray hover:text-ink"
                onClick={() => onChange(value.filter((t) => t !== tag))}
              >
                <X size={10} strokeWidth={2} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          className="h-10 w-full rounded-sm border border-line bg-panel px-3 text-sm outline-none transition-colors duration-100 placeholder:text-gray focus:border-ink"
          value={draft}
          placeholder={
            value.length >= maxCount ? `最多 ${maxCount} 个` : "输入后回车添加"
          }
          disabled={value.length >= maxCount}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
        />
        {focused && matched.length > 0 && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-sm border border-line bg-panel">
            {matched.map((s) => (
              <button
                key={s}
                type="button"
                className="block w-full px-3 py-2 text-left font-mono text-xs transition-colors duration-100 hover:bg-bg-3"
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(s);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <input type="hidden" name="tags" value={JSON.stringify(value)} />
    </div>
  );
}
