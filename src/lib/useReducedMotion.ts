import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/** Reactive prefers-reduced-motion — hydration-safe, no setState-in-effect. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * One-shot imperative read of the same preference, for use inside rAF loops and
 * MapLibre event callbacks where a hook can't be called. React components should
 * prefer the reactive useReducedMotion() hook above.
 */
export function prefersReducedMotion(): boolean {
  return getSnapshot();
}
