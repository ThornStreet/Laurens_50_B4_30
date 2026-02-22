"use client";

import { useEffect, useState } from "react";
import { fetchStates } from "@/lib/actions";
import type { StateRecord } from "@/lib/types";
import Map from "@/components/Map";
import StatePanel from "@/components/StatePanel";

export default function Home() {
  const [states, setStates] = useState<StateRecord[]>([]);
  const [selectedState, setSelectedState] = useState<string | null>(null);

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

  const selected = states.find((s) => s.name === selectedState) ?? null;

  if (states.length === 0) {
    return null;
  }

  return (
    <>
      <Map states={states} onStateClick={handleStateClick} />
      {selected && (
        <StatePanel
          key={selected.name}
          state={selected}
          onUpdate={handleUpdate}
          onClose={() => setSelectedState(null)}
        />
      )}
    </>
  );
}
