import type { ReactNode } from "react";
import { getDict } from "@/lib/i18n/server";
import { LocaleLink } from "@/lib/i18n/link";
import type { UiDict } from "@/lib/i18n/dict/types";

const CATEGORIES = [
  { id: "user", label: (t: UiDict) => t.me.catUser },
  { id: "organization", label: (t: UiDict) => t.me.catOrganization },
  { id: "need", label: (t: UiDict) => t.me.catNeed },
  { id: "agent", label: (t: UiDict) => t.me.catAgent },
  { id: "settings", label: (t: UiDict) => t.me.catSettings },
] as const;

type Category = (typeof CATEGORIES)[number]["id"];

const CATEGORY_HREFS: Record<Category, string> = {
  user: "/me",
  organization: "/me?section=organization",
  need: "/me?section=need",
  agent: "/me?section=agent",
  settings: "/me?section=settings",
};

export async function MeCategorySwitcher({
  user,
  organization,
  need,
  agent,
  settings,
  activeCategory,
}: {
  user: ReactNode;
  organization: ReactNode;
  need: ReactNode;
  agent: ReactNode;
  settings: ReactNode;
  activeCategory: Category;
}) {
  const t = await getDict();
  const panels = { user, organization, need, agent, settings };

  return (
    <>
      <nav
        aria-label={t.me.catNavLabel}
        className="flex w-full max-w-96 items-center gap-2"
      >
        {CATEGORIES.map((category) => {
          const isActive = category.id === activeCategory;

          return (
            <LocaleLink
              key={category.id}
              href={CATEGORY_HREFS[category.id]}
              aria-current={isActive ? "page" : undefined}
              scroll={false}
              className={`flex h-10 min-w-0 flex-1 items-center justify-center bg-transparent transition-[color,font-size] duration-150 ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                isActive
                  ? "text-xl font-semibold text-accent"
                  : "text-sm text-gray hover:text-ink"
              }`}
            >
              {category.label(t)}
            </LocaleLink>
          );
        })}
      </nav>

      <div className="mt-4">{panels[activeCategory]}</div>
    </>
  );
}
