"use client";

import { useRef, useState } from "react";
import {
  ASPECT,
  M_PATH,
  THREAD_M,
  THREAD_W,
  THREAD_W_OVER,
  VIEW_BOX,
  W_OVER_PATH,
  W_PATH,
} from "@/components/logo";

/* 字标与标识的尺寸配比固定成两档，避免在页面上随手缩放，见 docs/DESIGN.md「品牌标识」 */
const SIZES = {
  sm: { mark: 16, text: 15 },
  lg: { mark: 28, text: 26 },
} as const;

export function Brand({
  size = "sm",
  className = "",
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { mark, text } = SIZES[size];
  /* 鼠标是否还在标识上。只读不渲染，所以用 ref：animationiteration 回调里
     要拿到最新值，走 state 会读到闭包里的旧值 */
  const hovering = useRef(false);
  const [spinning, setSpinning] = useState(false);

  /* 悬停就播 loading 那条螺纹动画（匀速、无限循环、横移一个波长后与自身重合），
     移开不立刻掐断，而是等这一圈跑完——循环边界正好是相位对齐点，
     此刻换回静态标识不会跳。整套动效交给 CSS，这边只留一个开关，
     不再手算相位和加减速：先前那版要靠 rAF 逐帧积分、还要在停下时补一段
     归位，快速划过标识时相位补偿容易出岔子 */
  function enter() {
    hovering.current = true;
    /* 关掉动效的偏好，以及触屏——触屏上 mouseenter 会触发但 mouseleave 常常不来，
       放进去就一直转下去了 */
    if (
      window.matchMedia("(prefers-reduced-motion: reduce), (hover: none)")
        .matches
    ) {
      return;
    }
    setSpinning(true);
  }

  return (
    <span className={`flex items-center gap-2 ${className}`}>
      {/* 悬停只认标识本身：动的是这块 svg，触发区就限定在这块，
          挂到外层 span 会把字标也算进热区，鼠标扫过「We Match」就莫名转起来。
          p-1 把热区往外撑 4px（sm 档 25×16 太细，指不准），box-content 保证
          撑的是 padding 而不是压缩标识本身，-m-1 抵消掉占位——视觉尺寸和
          「与字标间距 8px」（见 docs/DESIGN.md「品牌标识」）都保持不变 */}
      <svg
        onMouseEnter={enter}
        onMouseLeave={() => {
          hovering.current = false;
        }}
        width={mark * ASPECT}
        height={mark}
        viewBox={VIEW_BOX}
        fill="none"
        aria-hidden
        className="-m-1 box-content p-1"
      >
        {spinning ? (
          <g
            className="animate-logo-thread"
            onAnimationIteration={() => {
              if (!hovering.current) setSpinning(false);
            }}
          >
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
        ) : (
          <>
            <path
              d={W_PATH}
              stroke="currentColor"
              strokeWidth="15"
              strokeLinecap="round"
            />
            <path
              d={M_PATH}
              stroke="var(--color-accent)"
              strokeWidth="15"
              strokeLinecap="round"
            />
            <path
              d={W_OVER_PATH}
              stroke="currentColor"
              strokeWidth="15"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
      <b style={{ fontSize: text }} className="font-bold tracking-[-0.02em]">
        We Match
      </b>
    </span>
  );
}
