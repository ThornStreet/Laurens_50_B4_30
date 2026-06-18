"use client";

import { useCallback, useRef, useState } from "react";
import { updateVisited, updateDateVisited, updateNotes } from "@/lib/actions";
import type { StateRecord } from "@/lib/types";
import { COLORS } from "@/lib/constants";
import { useReducedMotion } from "@/lib/useReducedMotion";

type Props = {
  state: StateRecord;
  onUpdate: (updated: StateRecord) => void;
  onCelebrate: (name: string) => void;
  onClose: () => void;
};

function VisitIcon({ visited, animate }: { visited: boolean; animate: boolean }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="63"
        strokeDashoffset={animate ? 63 : 0}
        style={animate ? { animation: "drawStroke 0.4s ease forwards" } : undefined}
      />
      {visited && (
        <path
          d="M7 12.5l3.2 3.2L17 8.8"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="16"
          strokeDashoffset={animate ? 16 : 0}
          style={
            animate ? { animation: "drawStroke 0.35s ease 0.25s forwards" } : undefined
          }
        />
      )}
    </svg>
  );
}

export default function StatePanel({ state, onUpdate, onCelebrate, onClose }: Props) {
  const [notes, setNotes] = useState(state.notes ?? "");
  const [dateVisited, setDateVisited] = useState(state.date_visited ?? "");
  const [justVisited, setJustVisited] = useState(false);
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  function toggleVisited() {
    const becomingVisited = !state.visited;

    // Auto-stamp today's date the first time a state is marked visited.
    // Build it from local date parts (not UTC) to match the native date input
    // and avoid landing on tomorrow for US users in the evening.
    let nextDate = state.date_visited;
    if (becomingVisited && !state.date_visited) {
      const d = new Date();
      nextDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
      setDateVisited(nextDate);
    }

    const updated = { ...state, visited: becomingVisited, date_visited: nextDate };
    onUpdate(updated);

    // Fire the celebration before the DB round-trip so the reward feels instant.
    if (becomingVisited) {
      setJustVisited(true);
      if (!reduce) navigator.vibrate?.(12);
      onCelebrate(state.name);
      setTimeout(() => setJustVisited(false), 800);
    }

    updateVisited(state.name, becomingVisited);
    if (nextDate !== state.date_visited) updateDateVisited(state.name, nextDate);
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSaveNotes = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const updatedNotes = value || null;
        onUpdate({ ...state, notes: updatedNotes });
        updateNotes(state.name, updatedNotes);
      }, 300);
    },
    [state, onUpdate]
  );

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(0,0,0,0.4)",
      }}
    >
      <div
        ref={panelRef}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "linear-gradient(180deg, #1f1f3a 0%, #15152b 100%)",
          borderRadius: "18px 18px 0 0",
          padding: "10px 24px calc(32px + env(safe-area-inset-bottom, 0px))",
          color: "#fff",
          animation: reduce ? undefined : "slideUp 0.25s ease-out",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Grabber handle */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 999,
            background: "rgba(255,255,255,0.2)",
            margin: "0 auto 16px",
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
            {state.name}
          </h2>
          <span
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.45)",
              fontWeight: 600,
              letterSpacing: "0.08em",
            }}
          >
            {state.abbr}
          </span>
        </div>

        {/* Visited toggle */}
        <button
          onClick={toggleVisited}
          style={{
            width: "100%",
            padding: "13px 16px",
            borderRadius: 12,
            border: state.visited
              ? "1px solid transparent"
              : `1px solid ${COLORS.mint400}`,
            cursor: "pointer",
            fontSize: 16,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            background: state.visited
              ? "linear-gradient(135deg, rgba(52,211,153,0.22), rgba(74,222,128,0.14))"
              : "rgba(255,255,255,0.04)",
            color: state.visited ? COLORS.mint300 : COLORS.mint400,
            transition: "all 0.18s ease",
            marginBottom: 16,
          }}
        >
          <VisitIcon visited={state.visited} animate={justVisited && !reduce} />
          {state.visited ? "Visited" : "Mark as visited"}
        </button>

        {/* Date visited */}
        {state.visited && (
          <>
            <label style={labelStyle}>Date visited</label>
            <input
              className="sheet-input"
              type="date"
              value={dateVisited}
              onChange={(e) => {
                const val = e.target.value || null;
                setDateVisited(val ?? "");
                onUpdate({ ...state, date_visited: val });
                updateDateVisited(state.name, val);
              }}
              style={{
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff",
                fontSize: 14,
                outline: "none",
                fontFamily: "inherit",
                marginBottom: 16,
                colorScheme: "dark",
                WebkitAppearance: "none",
                appearance: "none",
              }}
            />
          </>
        )}

        {/* Notes */}
        <label style={labelStyle}>Notes</label>
        <textarea
          className="sheet-input"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            debouncedSaveNotes(e.target.value);
          }}
          placeholder="Add notes about this state..."
          rows={3}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)",
            color: "#fff",
            fontSize: 15,
            resize: "vertical",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
      </div>
    </div>
  );
}
