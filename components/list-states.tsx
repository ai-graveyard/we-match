import type { ReactNode } from "react";
import { LogoMark } from "@/components/logo";

/* 列表为空与列表到底两处，本来就是留白，标识在这里同时承担「没内容」和「到底了」的告知，
   不算装饰。一律用单色档，橙色留给主控件，见 docs/DESIGN.md「焦橙纪律」。 */

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="mt-16 flex flex-col items-center gap-3 text-center text-gray">
      <LogoMark height={22} muted className="text-line" />
      <p className="text-sm">{children}</p>
    </div>
  );
}

/* desktopOnly 给广场用：那里移动端的末尾由品牌页脚兼任，桌面端仍需要一个终点标记 */
export function ListEnd({ desktopOnly = false }: { desktopOnly?: boolean }) {
  return (
    <div
      className={`${desktopOnly ? "hidden md:flex" : "flex"} justify-center py-8`}
    >
      <LogoMark height={12} muted className="text-line" />
    </div>
  );
}
