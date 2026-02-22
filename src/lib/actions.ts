"use server";

import { getSupabase } from "@/lib/supabase";
import type { StateRecord } from "@/lib/types";

export async function fetchStates(): Promise<StateRecord[]> {
  const { data } = await getSupabase()
    .from("states")
    .select("*")
    .order("name");
  return (data as StateRecord[]) ?? [];
}

export async function updateVisited(name: string, visited: boolean) {
  await getSupabase()
    .from("states")
    .update({ visited })
    .eq("name", name);
}

export async function updateDateVisited(name: string, date_visited: string | null) {
  await getSupabase()
    .from("states")
    .update({ date_visited })
    .eq("name", name);
}

export async function updateNotes(name: string, notes: string | null) {
  await getSupabase()
    .from("states")
    .update({ notes })
    .eq("name", name);
}
