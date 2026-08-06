import Link from "next/link";
import type { ReactNode } from "react";

const CATEGORIES = [
  { id: "user", label: "用户" },
  { id: "organization", label: "组织" },
  { id: "need", label: "需求" },
  { id: "agent", label: "Agent" },
  { id: "settings", label: "设置" },
] as const;

type Category = (typeof CATEGORIES)[number]["id"];

const CATEGORY_HREFS: Record<Category, string> = {
  user: "/me",
  organization: "/me?section=organization",
  need: "/me?section=need",
  agent: "/me?section=agent",
  settings: "/me?section=settings",
};

export function MeCategorySwitcher({
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
  const panels = { user, organization, need, agent, settings };

  return (
    <>
      <nav
        aria-label="我的内容"
        className="flex w-full max-w-96 items-center gap-2"
      >
        {CATEGORIES.map((category) => {
          const isActive = category.id === activeCategory;

          return (
            <Link
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
              {category.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4">{panels[activeCategory]}</div>
    </>
  );
}
