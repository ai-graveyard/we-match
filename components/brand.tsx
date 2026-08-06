"use client";

import { useEffect, useRef, useState } from "react";
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

/* 悬停旋转参数：巡航速度与 loading 螺纹一致（一个波长 / 1.6s）；
   加减速度取「约 1.2s 从静止到巡航」，先慢慢加速、移开后慢慢减速 */
const PERIOD = 106;
const CRUISE = PERIOD / 1.6;
const ACCEL = 55;

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
  const g = useRef<SVGGElement | null>(null);
  const raf = useRef(0);
  const last = useRef(0);
  const phase = useRef(0);
  const speed = useRef(0);
  const mode = useRef<"idle" | "accel" | "cruise" | "decel" | "settle">(
    "idle",
  );
  const settle = useRef({ from: 0, dist: 0, start: 0, dur: 1 });
  const [spinning, setSpinning] = useState(false);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function step(now: number) {
    const t = now / 1000;
    const dt = Math.min(t - last.current, 0.05);
    last.current = t;
    if (mode.current === "accel") {
      speed.current = Math.min(speed.current + ACCEL * dt, CRUISE);
      if (speed.current === CRUISE) mode.current = "cruise";
      phase.current += speed.current * dt;
    } else if (mode.current === "cruise") {
      phase.current += CRUISE * dt;
    } else if (mode.current === "decel") {
      speed.current -= ACCEL * dt;
      if (speed.current <= 0) {
        /* 停稳后只向前补到下一个标准相位，避免就近归位时反向倒退 */
        const target = Math.ceil(phase.current / PERIOD) * PERIOD;
        settle.current = {
          from: phase.current,
          dist: target - phase.current,
          start: t,
          dur: Math.max(0.35, (Math.abs(target - phase.current) * 1.5) / CRUISE),
        };
        speed.current = 0;
        mode.current = "settle";
      } else {
        phase.current += speed.current * dt;
      }
    } else if (mode.current === "settle") {
      const { from, dist, start, dur } = settle.current;
      const p = Math.min((t - start) / dur, 1);
      const e = p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
      phase.current = from + dist * e;
      if (p === 1) {
        phase.current = 0;
        mode.current = "idle";
        setSpinning(false);
        return;
      }
    } else {
      return;
    }
    if (g.current) {
      g.current.style.transform = `translateX(${-(phase.current % PERIOD)}px)`;
    }
    raf.current = requestAnimationFrame(step);
  }

  function enter() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    cancelAnimationFrame(raf.current);
    mode.current = "accel";
    last.current = performance.now() / 1000;
    setSpinning(true);
    raf.current = requestAnimationFrame(step);
  }

  function leave() {
    if (mode.current === "accel" || mode.current === "cruise") {
      mode.current = "decel";
    }
  }

  return (
    <span
      onMouseEnter={enter}
      onMouseLeave={leave}
      className={`flex items-center gap-2 ${className}`}
    >
      <svg
        width={mark * ASPECT}
        height={mark}
        viewBox={VIEW_BOX}
        fill="none"
        aria-hidden
      >
        {spinning ? (
          <g ref={g}>
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
