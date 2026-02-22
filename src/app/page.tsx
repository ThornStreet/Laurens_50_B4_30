"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { StateRecord } from "@/lib/types";
import Map from "@/components/Map";
import StatePanel from "@/components/StatePanel";

export default function Home() {
  const [states, setStates] = useState<StateRecord[]>([]);
  const [selectedState, setSelectedState] = useState<string | null>(null);

  useEffect(() => {
    getSupabase()
      .from("states")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) setStates(data as StateRecord[]);
      });
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

  return (
    <>
      <Map states={states} onStateClick={handleStateClick} />
      {selected && (
        <StatePanel
          state={selected}
          onUpdate={handleUpdate}
          onClose={() => setSelectedState(null)}
        />
      )}
    </>
  );
}
