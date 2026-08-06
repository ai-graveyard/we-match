import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { ThemeApplier } from "@/components/theme-toggle";
import { NavTracker } from "@/components/page-header";
import { BRAND_SLOGAN } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.SITE_ORIGIN ?? "https://wematch.v2ai.org",
  ),
  title: {
    default: "We Match",
    template: "%s · We Match",
  },
  description: `${BRAND_SLOGAN}。发布「我需要」或「我提供」，找到能互相帮上忙的人。`,
};

// 移动端浏览器地址栏 / 状态栏底色，取 --bg 而非焦橙——大面积橙底不做界面色。
// 用户手动切主题时由 ThemeApplier 覆盖这两条 media 规则
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F7F7" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className="h-full"
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        {/* 绘制前应用已保存的主题（无记录则跟随系统），避免暗色用户看到浅色闪烁 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="flex min-h-dvh flex-col">
        <ThemeApplier />
        <Suspense fallback={null}>
          <NavTracker />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
