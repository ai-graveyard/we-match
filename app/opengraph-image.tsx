import { ImageResponse } from "next/og";
import { ASPECT, logoMarkSvg } from "@/components/logo";
import { BRAND_NAME, BRAND_SLOGAN } from "@/lib/brand";

// 链接分享卡片。ImageResponse 只带拉丁字体，中文会渲染成豆腐块，
// 所以卡面使用品牌口号的英文对应文案，中文原文由 alt 与 og:description 提供。
export const alt = `${BRAND_NAME} — ${BRAND_SLOGAN}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MARK_HEIGHT = 88;

export default function OpengraphImage() {
  const svg = logoMarkSvg({
    height: MARK_HEIGHT,
    ink: "#1A1A1A",
    accent: "#E8500A",
  });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: 80,
          background: "#F7F7F7",
          color: "#1A1A1A",
        }}
      >
        <img
          src={src}
          alt=""
          width={MARK_HEIGHT * ASPECT}
          height={MARK_HEIGHT}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{ fontSize: 104, fontWeight: 700, letterSpacing: "-0.03em" }}
          >
            {BRAND_NAME}
          </div>
          <div
            style={{
              marginTop: 20,
              fontSize: 30,
              letterSpacing: "0.08em",
              color: "#808080",
            }}
          >
            LET THE RIGHT PEOPLE MEET
          </div>
        </div>
        <div
          style={{
            display: "flex",
            paddingTop: 28,
            borderTop: "1px solid #C9C9C9",
            fontSize: 24,
            letterSpacing: "0.12em",
            color: "#808080",
          }}
        >
          POST WHAT YOU NEED / OFFER WHAT YOU HAVE
        </div>
      </div>
    ),
    size,
  );
}
