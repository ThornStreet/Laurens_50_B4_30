"use client";

const BIRTHDAY = new Date(2028, 6, 9); // July 9, 2028

export default function CountdownBadge() {
  const now = new Date();
  const diff = BIRTHDAY.getTime() - now.getTime();
  const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 900,
        padding: "8px 14px",
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
      {days} days left
    </div>
  );
}
