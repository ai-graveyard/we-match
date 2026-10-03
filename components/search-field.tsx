
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { Search } from "lucide-react";

/* 广场、组织广场、组织成员三处搜索共用一个形态：右侧内嵌带分隔线的放大镜提交按钮，
   同时支持 Enter 提交。放大镜不能只当装饰摆在左边——那样点了没反应，
   而移动端很多人就是奔着那个图标去点的（见 docs/DESIGN.md「广场搜索」）。

   高 40px：它是输入，不是承载动作的按钮，按 DESIGN.md 走 h-10 那一档。 */
export function SearchField({
  action,
  name,
  defaultValue,
  placeholder,
  label,
  hidden,
  className = "",
}: {
  action: string;
  name: string;
  defaultValue?: string;
  placeholder: string;
  /** 提交按钮的无障碍名称，图标按钮必须有 */
  label: string;
  /** 需要一起带上的筛选参数（当前范围、标签等） */
  hidden?: ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={`relative flex h-10 min-h-10 min-w-0 overflow-hidden rounded-sm border border-line bg-panel transition-colors duration-100 focus-within:border-ink ${className}`}
    >
      {hidden}
      <Input variant="bare"
        type="search"
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-gray"
      />
      <Button variant="plain" size="plain"
        type="submit"
        aria-label={label}
        title={label}
        className="flex w-10 shrink-0 items-center justify-center border-l border-line text-gray transition-colors duration-100 hover:text-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
      >
        <Search size={16} aria-hidden />
      </Button>
    </form>
  );
}
