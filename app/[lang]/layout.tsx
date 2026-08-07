import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { ThemeApplier } from "@/components/theme-toggle";
import { NavTracker } from "@/components/page-header";
import { BRAND_NAME } from "@/lib/brand";
import { DEFAULT_LOCALE, HTML_LANG, LOCALES, isLocale } from "@/lib/i18n/config";
import { I18nProvider } from "@/lib/i18n/client";
import { getDict, getLocale, uiDictFor } from "@/lib/i18n/server";
import "../globals.css";

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const dict = uiDictFor(isLocale(lang) ? lang : DEFAULT_LOCALE);
  return {
    metadataBase: new URL(
      process.env.SITE_ORIGIN ?? "https://wematch.v2ai.org",
    ),
    title: {
      default: BRAND_NAME,
      template: `%s · ${BRAND_NAME}`,
    },
    description: dict.brand.metaDescription,
  };
}

/** 两门语言都是同一套页面，先把语言段登记好 */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

// 移动端浏览器地址栏 / 状态栏底色，取 --bg 而非焦橙——大面积橙底不做界面色。
// 用户手动切主题时由 ThemeApplier 覆盖这两条 media 规则。
// viewportFit "cover" 是底部 Tab 栏能读到 env(safe-area-inset-bottom) 的前提，
// 缺了它微信里 iPhone 小黑条会压住 Tab 栏，见 globals.css 的 --safe-b。
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F7F7" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  const dict = await getDict();

  return (
    <html
      lang={HTML_LANG[locale]}
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
        <I18nProvider locale={locale} dict={dict}>
          <ThemeApplier />
          <Suspense fallback={null}>
            <NavTracker />
          </Suspense>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
