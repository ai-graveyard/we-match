/* 品牌标识：W（墨）与 M（焦橙）两条波线拧一圈半，三处交叉上下交替穿插，整体 180° 旋转对称。
   规范见 docs/DESIGN.md「品牌标识」，路径数据不得改动。
   本文件保持服务端可渲染，带交互的 Brand 在 components/brand.tsx。 */

export const W_PATH =
  "M40 72C59 72 74.3 168 93.3 168C112.3 168 127.7 72 146.7 72C165.7 72 181 168 200 168";
export const M_PATH =
  "M40 168C59 168 74.3 72 93.3 72C112.3 72 127.7 168 146.7 168C165.7 168 181 72 200 72";
/* W 的中段最后重画一次，使三处交叉呈「橙上、墨上、橙上」交替，缺了它就退化成 M 整条压在 W 上 */
export const W_OVER_PATH = "M93.3 168C112.3 168 127.7 72 146.7 72";

export const VIEW_BOX = "32 64 176 112";
export const ASPECT = 176 / 112;

export function LogoMark({
  height = 16,
  muted = false,
  className,
}: {
  height?: number;
  /* 单色档：两股都走 currentColor。用于终点标记、空状态、页脚这类非品牌焦点的位置，
     避免焦橙散布到主控件之外，见 docs/DESIGN.md「焦橙纪律」。 */
  muted?: boolean;
  className?: string;
}) {
  const accent = muted ? "currentColor" : "var(--color-accent)";
  return (
    <svg
      width={height * ASPECT}
      height={height}
      viewBox={VIEW_BOX}
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d={W_PATH}
        stroke="currentColor"
        strokeWidth="15"
        strokeLinecap="round"
      />
      <path d={M_PATH} stroke={accent} strokeWidth="15" strokeLinecap="round" />
      <path
        d={W_OVER_PATH}
        stroke="currentColor"
        strokeWidth="15"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* 螺纹加载：编织图案画得比可视窗宽两个波长（波长 106，与 globals.css 的位移量一致），
   横移一个波长后与原图重合即无缝循环；窗口外的部分由 viewBox 裁掉，线头永不入画 */
export const THREAD_W =
  "M-13 168C6 168 21 72 40 72C59 72 74 168 93 168C112 168 127 72 146 72C165 72 180 168 199 168C218 168 233 72 252 72C271 72 286 168 305 168C324 168 339 72 358 72";
export const THREAD_M =
  "M-13 72C6 72 21 168 40 168C59 168 74 72 93 72C112 72 127 168 146 168C165 168 180 72 199 72C218 72 233 168 252 168C271 168 286 72 305 72C324 72 339 168 358 168";
export const THREAD_W_OVER =
  "M-13 168C6 168 21 72 40 72M93 168C112 168 127 72 146 72M199 168C218 168 233 72 252 72M305 168C324 168 339 72 358 72";

export function LogoSpinner({
  height = 22,
  label,
}: {
  height?: number;
  /* 文案由调用方给，本文件不含任何语言相关内容 */
  label?: string;
}) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <svg
        width={height * ASPECT}
        height={height}
        viewBox={VIEW_BOX}
        fill="none"
        aria-hidden
      >
        <g className="animate-logo-thread">
          <path
            d={THREAD_W}
            stroke="currentColor"
            strokeWidth="15"
            strokeLinecap="round"
          />
          <path
            d={THREAD_M}
            stroke="var(--color-accent)"
            strokeWidth="15"
            strokeLinecap="round"
          />
          <path
            d={THREAD_W_OVER}
            stroke="currentColor"
            strokeWidth="15"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </span>
  );
}

/* 标识的独立 SVG 文本，供 ImageResponse（OG 图）这类拿不到 DOM 的场合使用，
   颜色必须显式传入，因为那里没有 CSS 变量。 */
export function logoMarkSvg({
  height,
  ink,
  accent,
}: {
  height: number;
  ink: string;
  accent: string;
}) {
  const stroke = (d: string, color: string) =>
    `<path d="${d}" stroke="${color}" stroke-width="15" stroke-linecap="round"/>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${height * ASPECT}" height="${height}" viewBox="${VIEW_BOX}" fill="none">`,
    stroke(W_PATH, ink),
    stroke(M_PATH, accent),
    stroke(W_OVER_PATH, ink),
    `</svg>`,
  ].join("");
}
