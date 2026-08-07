"use client";

import { useLayoutEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useDict } from "@/lib/i18n/client";

type Theme = "light" | "dark";

/** 与 globals.css 的 --bg 一致，浏览器地址栏 / 状态栏跟着主题走 */
const THEME_COLORS: Record<Theme, string> = {
  light: "#F7F7F7",
  dark: "#121212",
};

function preferredTheme(): Theme {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// 根布局输出的是两条按 prefers-color-scheme 分流的 theme-color，手动切主题后就不准了。
// 这里把它们统一改写成无 media 的同一个值，避免多条规则谁先匹配的歧义
function applyThemeColor(theme: Theme) {
  const metas = document.head.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = THEME_COLORS[theme];
    document.head.appendChild(meta);
    return;
  }
  metas.forEach((meta) => {
    meta.removeAttribute("media");
    meta.content = THEME_COLORS[theme];
  });
}

function toggleTheme() {
  const next: Theme =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "light"
      : "dark";
  localStorage.setItem("theme", next);
  document.documentElement.setAttribute("data-theme", next);
  applyThemeColor(next);
}

/** 开发模式 Strict Mode 重挂载会把 <html> 重置为 JSX 里的属性，绘制前补回主题；生产环境等效空操作 */
export function ThemeApplier() {
  useLayoutEffect(() => {
    const theme = preferredTheme();
    document.documentElement.setAttribute("data-theme", theme);
    applyThemeColor(theme);
  }, []);
  return null;
}

export function ThemeToggle() {
  const t = useDict();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={t.theme.toggleLabel}
      className="flex size-8 items-center justify-center rounded-sm text-gray transition-colors duration-100 hover:bg-bg-3 hover:text-ink"
    >
      <Moon size={15} className="dark:hidden" aria-hidden />
      <Sun size={15} className="hidden dark:block" aria-hidden />
    </button>
  );
}

export function ThemeToggleRow() {
  const t = useDict();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={t.theme.toggleLabel}
      className="flex min-h-16 w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-100 hover:bg-bg-3 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-ink"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{t.theme.title}</span>
        <span className="mt-0.5 block text-xs text-gray">
          <span className="dark:hidden">{t.theme.currentLight}</span>
          <span className="hidden dark:inline">{t.theme.currentDark}</span>
        </span>
      </span>
      <span
        className="grid shrink-0 grid-cols-2 rounded-sm border border-line bg-bg-2 p-0.5"
        aria-hidden
      >
        <span className="flex h-6 items-center justify-center rounded-[5px] bg-ink px-2 font-mono text-3xs text-panel dark:bg-transparent dark:text-gray">
          {t.theme.light}
        </span>
        <span className="flex h-6 items-center justify-center rounded-[5px] px-2 font-mono text-3xs text-gray dark:bg-ink dark:text-panel">
          {t.theme.dark}
        </span>
      </span>
    </button>
  );
}
