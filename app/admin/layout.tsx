import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Brand } from "@/components/brand";

export const metadata = { title: "管理后台" };

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 md:px-8">
          <Link
            href="/admin"
            aria-label="管理后台首页"
            className="flex min-w-0 items-center gap-2"
          >
            <Brand />
            <span className="h-4 w-px shrink-0 bg-line" aria-hidden />
            <span className="shrink-0 text-xs font-semibold">管理后台</span>
          </Link>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1 text-xs text-gray transition-colors duration-100 hover:text-ink"
          >
            <ChevronLeft size={13} aria-hidden />
            返回应用
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-6 md:px-8">
        {children}
      </main>
    </>
  );
}
