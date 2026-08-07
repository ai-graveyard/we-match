import { Brand } from "@/components/brand";
import { getDict } from "@/lib/i18n/server";

/* 移动端专用：桌面端顶部导航条已经有字标了，再来一个页脚就是重复。
   只在两处露出——广场范围的列表末尾（访问量最大的一屏），以及「我的 → 用户」最底部
   （用户找「这是什么应用」时习惯滑到这里）。
   组织范围的广场、「我的」下的组织 / 需求 / Agent / 设置都是干活的页面，不放品牌。
   只放标识和标语；协议、版本号在「我的 → 设置」。见 docs/DESIGN.md「品牌标识」。 */
export async function BrandFooter() {
  const t = await getDict();
  return (
    <footer className="mt-10 flex flex-col items-center gap-2 border-t border-line pt-6 md:hidden">
      <Brand />
      <p className="text-xs text-gray">{t.brand.slogan}</p>
    </footer>
  );
}
