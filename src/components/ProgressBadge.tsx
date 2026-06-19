"use client";

import { useEffect, useRef, useState } from "react";
import type { StateRecord } from "@/lib/types";
import { EXCLUDED, TOTAL, COLORS, glass } from "@/lib/constants";
import { prefersReducedMotion } from "@/lib/useReducedMotion";

type Props = {
  states: StateRecord[];
};

export default function ProgressBadge({ states }: Props) {
  const visited = states.filter(
    (s) => s.visited && !EXCLUDED.includes(s.name)
  ).length;

  const [display, setDisplay] = useState(visited);
  const [pop, setPop] = useState(0); // bump to retrigger the pop + flash animations
  const prevRef = useRef(visited);
  const rafRef = useRef<number | null>(null);

  // Count up (and pop) only on a single new visit; snap on bulk load / un-visit.
  useEffect(() => {
    const from = prevRef.current;
    const to = visited;
    prevRef.current = visited;
    if (from === to) return;

    if (to === from + 1 && !prefersReducedMotion()) {
      setPop((p) => p + 1);
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 600);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(Math.round(from + (to - from) * eased));
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setDisplay(to);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visited]);

  const radius = 14;
  const stroke = 3;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - display / TOTAL);

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        left: 16,
        zIndex: 1050,
        pointerEvents: "none",
      }}
    >
      <div
        key={pop}
        style={{
          ...glass,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px 8px 10px",
          borderRadius: 999,
          animation: pop ? "badgePop 0.4s ease" : undefined,
        }}
      >
        <svg
          width={(radius + stroke) * 2}
          height={(radius + stroke) * 2}
          style={{ display: "block" }}
        >
          {/* Background ring */}
          <circle
            cx={radius + stroke}
            cy={radius + stroke}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={stroke}
          />
          {/* Progress ring */}
          <circle
            cx={radius + stroke}
            cy={radius + stroke}
            r={radius}
            fill="none"
            stroke={COLORS.mint500}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${radius + stroke} ${radius + stroke})`}
            style={{ animation: pop ? "ringFlash 0.6s ease" : undefined }}
          />
        </svg>
        <span
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 3,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700 }}>{display}</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.55)" }}>
            / {TOTAL}
          </span>
        </span>
      </div>
    </div>
  );
}
