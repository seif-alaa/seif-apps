"use client";

import { create } from "zustand";
import type { Configuration } from "@/domain/configuration";
import { readLocal, writeLocal } from "./storage";

/**
 * Saved compositions, stored anonymously on this device. Account-linked
 * saving arrives with the durable backend (docs/PRODUCTION.md).
 */
export interface SavedDesign {
  ref: string;
  name: string;
  configuration: Configuration;
  query: string;
  savedAt: string;
  totalMinorAtSave: number;
}

interface SavedState {
  designs: SavedDesign[];
  hydrated: boolean;
  hydrate(): void;
  save(d: SavedDesign): void;
  remove(ref: string): void;
}

const KEY = "nivore.saved.v1";

export const useSaved = create<SavedState>((set, get) => ({
  designs: [],
  hydrated: false,
  hydrate() {
    if (get().hydrated) return;
    const stored = readLocal<SavedDesign[]>(KEY);
    set({ designs: Array.isArray(stored) ? stored.slice(0, 30) : [], hydrated: true });
  },
  save(d) {
    const designs = [d, ...get().designs.filter((x) => x.ref !== d.ref)].slice(0, 30);
    set({ designs });
    writeLocal(KEY, designs);
  },
  remove(ref) {
    const designs = get().designs.filter((x) => x.ref !== ref);
    set({ designs });
    writeLocal(KEY, designs);
  },
}));
