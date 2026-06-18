"use client";

import { useEffect, useState } from "react";
import { fetchStates } from "@/lib/actions";
import type { StateRecord, Celebration, Anchor } from "@/lib/types";
import { EXCLUDED, milestoneFor } from "@/lib/constants";
import Map from "@/components/Map";
import StatePanel from "@/components/StatePanel";
import ProgressBadge from "@/components/ProgressBadge";
import CountdownBadge from "@/components/CountdownBadge";
import CelebrationLayer from "@/components/CelebrationLayer";

export default function Home() {
  const [states, setStates] = useState<StateRecord[]>([]);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  useEffect(() => {
    fetchStates().then(setStates);
  }, []);

  function handleStateClick(name: string) {
    setSelectedState(name);
  }

  function handleUpdate(updated: StateRecord) {
    setStates((prev) =>
      prev.map((s) => (s.name === updated.name ? updated : s))
    );
  }

  // Fired when a state flips to visited. `states` here is still pre-toggle,
  // so the target's count is the current total + 1 (unless it's a bonus stop).
  function handleCelebrate(name: string) {
    const base = states.filter(
      (s) => s.visited && !EXCLUDED.includes(s.name)
    ).length;
    const countable = !EXCLUDED.includes(name);
    const count = base + (countable ? 1 : 0);
    setCelebration({
      name,
      count,
      milestone: countable ? milestoneFor(count) : null,
      seq: Date.now(),
    });
  }

  const selected = states.find((s) => s.name === selectedState) ?? null;

  if (states.length === 0) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        <div
          className="loading-wordmark"
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "0.01em",
            animation: "brandPulse 1.6s ease-in-out infinite",
          }}
        >
          Lauren&apos;s 50 B4 30
        </div>
      </div>
    );
  }

  return (
    <>
      <Map
        states={states}
        onStateClick={handleStateClick}
        celebration={celebration}
        onAnchor={setAnchor}
      />
      <ProgressBadge states={states} />
      <CountdownBadge />
      <CelebrationLayer celebration={celebration} anchor={anchor} />
      {selected && (
        <StatePanel
          key={selected.name}
          state={selected}
          onUpdate={handleUpdate}
          onCelebrate={handleCelebrate}
          onClose={() => setSelectedState(null)}
        />
      )}
    </>
  );
}
