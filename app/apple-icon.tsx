import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// iOS「添加到主屏幕」要求 PNG。直接复用 app/icon.svg，把它压在焦橙底上——
// icon.svg 的圆角是透明的，铺底后得到满幅方块，圆角交给 iOS 自己的遮罩
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const svg = await readFile(join(process.cwd(), "app", "icon.svg"), "utf8");
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#E8500A",
        }}
      >
        <img src={src} alt="" width={size.width} height={size.height} />
      </div>
    ),
    size,
  );
}
