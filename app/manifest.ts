import type { MetadataRoute } from "next";
import { BRAND_SLOGAN } from "@/lib/brand";

// 「添加到主屏幕」用的清单：图标沿用 app/icon.svg（焦橙圆角方块），
// 底色与 --bg 一致，不用焦橙——大面积橙底只允许出现在图标本身，见 docs/DESIGN.md
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "We Match",
    short_name: "We Match",
    description: `${BRAND_SLOGAN}。发布「我需要」或「我提供」，找到能互相帮上忙的人。`,
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
