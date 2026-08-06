import { TabBar, TopNav } from "@/components/tab-bar";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-[640px] flex-1 px-4 pb-20 pt-4 md:px-8 md:pb-8 md:pt-6">
        {children}
      </main>
      <TabBar />
    </>
  );
}
