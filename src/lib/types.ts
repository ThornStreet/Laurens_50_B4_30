import type { Milestone } from "@/lib/constants";

export type StateRecord = {
  name: string;
  abbr: string;
  visited: boolean;
  date_visited: string | null;
  notes: string | null;
};

/** A freshly-marked visit, broadcast from the panel to the map + overlay. */
export type Celebration = {
  name: string;
  count: number;
  milestone: Milestone;
  seq: number;
};

/** Screen-space position (projected from the map) where the celebration anchors. */
export type Anchor = { x: number; y: number; seq: number };
