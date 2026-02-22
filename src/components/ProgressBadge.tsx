"use client";

import type { StateRecord } from "@/lib/types";

type Props = {
  states: StateRecord[];
};

export default function ProgressBadge({ states }: Props) {
  const visited = states.filter((s) => s.visited && s.name !== "District of Columbia").length;
  const total = 50;
  const pct = visited / total;

  const radius = 14;
  const stroke = 3;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        left: 16,
        zIndex: 900,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px 8px 10px",
        borderRadius: 999,
        background: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        color: "#fff",
        fontSize: 15,
        fontWeight: 600,
        pointerEvents: "none",
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
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={stroke}
        />
        {/* Progress ring */}
        <circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          fill="none"
          stroke="#22c55e"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${radius + stroke} ${radius + stroke})`}
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>
      <span>
        {visited} / {total}
      </span>
    </div>
  );
}
