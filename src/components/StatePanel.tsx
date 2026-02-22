"use client";

import { useEffect, useRef, useState } from "react";
import { updateVisited, updateDateVisited, updateNotes } from "@/lib/actions";
import type { StateRecord } from "@/lib/types";

type Props = {
  state: StateRecord;
  onUpdate: (updated: StateRecord) => void;
  onClose: () => void;
};

export default function StatePanel({ state, onUpdate, onClose }: Props) {
  const [notes, setNotes] = useState(state.notes ?? "");
  const [dateVisited, setDateVisited] = useState(state.date_visited ?? "");
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        backdropRef.current &&
        e.target === backdropRef.current
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  async function toggleVisited() {
    const updated = { ...state, visited: !state.visited };
    onUpdate(updated);
    await updateVisited(state.name, updated.visited);
  }

  async function saveNotes() {
    if (notes === (state.notes ?? "")) return;
    const updatedNotes = notes || null;
    onUpdate({ ...state, notes: updatedNotes });
    await updateNotes(state.name, updatedNotes);
  }

  return (
    <div
      ref={backdropRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        ref={panelRef}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#1a1a2e",
          borderRadius: "16px 16px 0 0",
          padding: "20px 24px 32px",
          color: "#fff",
          animation: "slideUp 0.25s ease-out",
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: "rgba(255,255,255,0.3)",
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
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            {state.name}
          </h2>
          <span
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.5)",
              fontWeight: 500,
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
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            fontSize: 16,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: state.visited
              ? "rgba(34,197,94,0.15)"
              : "rgba(255,255,255,0.08)",
            color: state.visited ? "#22c55e" : "rgba(255,255,255,0.6)",
            transition: "all 0.15s ease",
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 20 }}>{state.visited ? "✓" : "○"}</span>
          {state.visited ? "Visited" : "Not visited"}
        </button>

        {/* Date visited */}
        {state.visited && (
          <>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(255,255,255,0.5)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Date visited
            </label>
            <input
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
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff",
                fontSize: 15,
                outline: "none",
                fontFamily: "inherit",
                marginBottom: 16,
                colorScheme: "dark",
              }}
            />
          </>
        )}

        {/* Notes */}
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
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
