import type { MetadataRoute } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { uiDict } from "@/lib/i18n/dict";

// 「添加到主屏幕」用的清单：图标沿用 app/icon.svg（焦橙圆角方块），
// 底色与 --bg 一致，不用焦橙——大面积橙底只允许出现在图标本身，见 docs/DESIGN.md
// 清单是站点级的，URL 上没有 [lang] 段，只能按默认语言给一份
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: uiDict(DEFAULT_LOCALE).brand.metaDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#F7F7F7",
    theme_color: "#F7F7F7",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
