// Shared constants + small helpers used across the map, badges, and the
// celebration layer so progress is computed identically everywhere.

import type { CSSProperties } from "react";

/** Places that don't count toward the "50 states" goal (bonus stops). */
export const EXCLUDED = [
  "District of Columbia",
  "Puerto Rico",
  "U.S. Virgin Islands",
];

export const TOTAL = 50;

/** Cooler emerald palette — kept in sync with the CSS custom properties. */
export const COLORS = {
  mint500: "#34d399",
  mint400: "#4ade80",
  mint300: "#6ee7b7",
  gold: "#fbbf24",
} as const;

/** A translucent variant of a palette hex (e.g. withAlpha(COLORS.gold, 0.55)). */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Shared glassmorphism base for the floating badges + celebration toast. */
export const glass: CSSProperties = {
  background: "rgba(0, 0, 0, 0.45)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  color: "#fff",
};

export type Milestone = "finale" | "half" | "minor" | null;

/** Which milestone (if any) a freshly-reached visited count represents. */
export function milestoneFor(count: number): Milestone {
  if (count >= TOTAL) return "finale";
  if (count === 25) return "half";
  if (count === 10 || count === 40) return "minor";
  return null;
}

/** Toast copy for a new visit — milestone-aware, gentle on bonus stops. */
export function celebrationCopy(
  name: string,
  count: number,
  milestone: Milestone
): string {
  if (EXCLUDED.includes(name)) return `${name} — a bonus stop ✦`;
  switch (milestone) {
    case "finale":
      return `${count} / ${TOTAL} — she did it!`;
    case "half":
      return `Halfway there — ${count} / ${TOTAL}`;
    case "minor":
      return count === 10
        ? `Double digits — ${count} states!`
        : `${count} down — so close now`;
    default:
      return `${name} — state #${count}`;
  }
}
