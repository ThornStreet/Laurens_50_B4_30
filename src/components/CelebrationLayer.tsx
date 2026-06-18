"use client";

import { useMemo } from "react";
import { celebrationCopy, COLORS } from "@/lib/constants";
import { useReducedMotion } from "@/lib/useReducedMotion";
import type { Celebration, Anchor } from "@/lib/types";

type Props = {
  celebration: Celebration | null;
  anchor: Anchor | null;
};

type Confetti = { left: number; tx: number; r: number; delay: number; color: string };

const CONFETTI_COLORS = [COLORS.mint500, COLORS.mint300, "#ffffff", COLORS.gold];

function makeConfetti(): Confetti[] {
  return Array.from({ length: 16 }, (_, i) => ({
    // Spread origins across the top, then drift down with a little sideways travel.
    left: (i / 15) * 100,
    tx: (Math.random() - 0.5) * 160,
    r: (Math.random() - 0.5) * 720,
    delay: Math.random() * 120,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  }));
}

export default function CelebrationLayer({ celebration, anchor }: Props) {
  const reduce = useReducedMotion();

  // The anchor carries the projected map position and shares the celebration's
  // seq, so position and content always land together.
  const active = !!(celebration && anchor && celebration.seq === anchor.seq);
  const seq = anchor?.seq ?? 0;
  const finale = celebration?.milestone === "finale";

  // Memoized per celebration so incidental re-renders don't reshuffle pieces.
  const confetti = useMemo(
    () => (active && finale && !reduce ? makeConfetti() : []),
    [active, finale, reduce]
  );

  const copy =
    active && celebration
      ? celebrationCopy(celebration.name, celebration.count, celebration.milestone)
      : "";

  return (
    <>
      {/* Always-mounted, visually-hidden live region. Only its text changes, so
          screen readers announce reliably (a keyed/remounted region does not). */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "fixed",
          width: 1,
          height: 1,
          overflow: "hidden",
          clipPath: "inset(50%)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        {copy}
      </div>
      {active && anchor && (
        <CelebrationVisual
          seq={seq}
          anchor={anchor}
          copy={copy}
          finale={finale}
          reduce={reduce}
          confetti={confetti}
        />
      )}
    </>
  );
}

function CelebrationVisual({
  seq,
  anchor,
  copy,
  finale,
  reduce,
  confetti,
}: {
  seq: number;
  anchor: Anchor;
  copy: string;
  finale: boolean;
  reduce: boolean;
  confetti: Confetti[];
}) {
  const toastBorder = finale ? "rgba(251,191,36,0.55)" : "rgba(74,222,128,0.35)";
  const dotColor = finale ? COLORS.gold : COLORS.mint400;
  const textColor = finale ? COLORS.gold : "#fff";

  return (
    // key restarts every CSS animation when a new celebration fires.
    <div
      key={seq}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* Expanding light rings radiating from the visited state */}
      {!reduce && (
        <>
          <span
            style={{
              position: "absolute",
              left: anchor.x,
              top: anchor.y,
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: `2px solid ${COLORS.mint400}`,
              boxShadow: `0 0 16px ${COLORS.mint300}`,
              transformOrigin: "center",
              animation: "ringExpand 0.9s cubic-bezier(0.16,1,0.3,1) forwards",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: anchor.x,
              top: anchor.y,
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: `1.5px solid ${COLORS.mint300}`,
              opacity: 0.6,
              transformOrigin: "center",
              animation:
                "ringExpand 0.9s cubic-bezier(0.16,1,0.3,1) 0.12s forwards",
            }}
          />
        </>
      )}

      {/* Glass toast — drops from the top, clear of the open sheet below */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "calc(env(safe-area-inset-top, 0px) + 68px)",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "9px 16px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: `1px solid ${toastBorder}`,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          color: textColor,
          fontSize: 15,
          fontWeight: 600,
          whiteSpace: "nowrap",
          maxWidth: "calc(100vw - 32px)",
          animation: reduce
            ? "toastFade 2.4s ease forwards"
            : "toastCycle 2.4s cubic-bezier(0.16,1,0.3,1) forwards",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor,
            boxShadow: `0 0 8px ${dotColor}`,
            flexShrink: 0,
          }}
        />
        {copy}
      </div>

      {/* Finale-only confetti */}
      {confetti.map((c, i) => (
        <span
          key={i}
          style={
            {
              position: "absolute",
              left: `${c.left}%`,
              top: "-6%",
              width: 8,
              height: 12,
              borderRadius: 2,
              background: c.color,
              "--tx": `${c.tx}px`,
              "--r": `${c.r}deg`,
              animation: `confettiFall 1.3s ${c.delay}ms ease-in forwards`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
