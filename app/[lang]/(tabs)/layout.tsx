import { TabBar, TopNav } from "@/components/tab-bar";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {/* 底部留白 = Tab 栏（含安全区）+ 32px 净空，微信里内容不会顶到小黑条上 */}
      <main className="mx-auto w-full max-w-[640px] flex-1 px-4 pb-[calc(var(--tabbar-h)+32px)] pt-4 md:px-8 md:pb-8 md:pt-6">
        {children}
      </main>
      <TabBar />
    </>
  );
}
