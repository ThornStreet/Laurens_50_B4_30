"use client";

import { COLORS, glass, withAlpha } from "@/lib/constants";

const BIRTHDAY = new Date(2028, 6, 9); // July 9, 2028

export default function CountdownBadge() {
  const now = new Date();
  const diff = BIRTHDAY.getTime() - now.getTime();
  const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  const urgent = days <= 180;

  return (
    <div
      style={{
        ...glass,
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 1050,
        padding: "6px 16px",
        borderRadius: 16,
        border: urgent ? `1px solid ${withAlpha(COLORS.gold, 0.4)}` : glass.border,
        textAlign: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          lineHeight: 1,
          color: urgent ? COLORS.gold : "#fff",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {days}
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
          marginTop: 2,
        }}
      >
        days left
      </div>
    </div>
  );
}
