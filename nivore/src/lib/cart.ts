"use client";

import { create } from "zustand";
import type { Configuration } from "@/domain/configuration";
import { readLocal, writeLocal } from "./storage";

/**
 * Shopping bag, kept in this browser only. It stores choices, never trusted
 * prices: the server re-prices and re-validates every item (/api/quote and
 * /api/orders). `displayMinor` is only a hint shown until the quote returns.
 */
export interface BagItem {
  id: string;
  kind: "custom" | "catalog";
  configuration?: Configuration;
  productId?: string;
  name: string;
  detail: string;
  buildRef?: string;
  quantity: number;
  displayMinor: number;
  addedAt: string;
}

interface BagState {
  items: BagItem[];
  hydrated: boolean;
  hydrate(): void;
  add(item: Omit<BagItem, "id" | "addedAt">): BagItem;
  replace(id: string, item: Omit<BagItem, "id" | "addedAt">): void;
  setQuantity(id: string, quantity: number): void;
  remove(id: string): void;
  clear(): void;
}

const KEY = "nivore.bag.v1";
const persist = (items: BagItem[]) => writeLocal(KEY, items);
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random()));

export const useBag = create<BagState>((set, get) => ({
  items: [],
  hydrated: false,
  hydrate() {
    if (get().hydrated) return;
    const stored = readLocal<BagItem[]>(KEY);
    set({ items: Array.isArray(stored) ? stored.slice(0, 20) : [], hydrated: true });
  },
  add(item) {
    // Same catalog piece: increase quantity rather than duplicating the line.
    const existing = item.kind === "catalog" ? get().items.find((i) => i.kind === "catalog" && i.productId === item.productId) : undefined;
    if (existing) {
      const items = get().items.map((i) => (i.id === existing.id ? { ...i, quantity: i.quantity + item.quantity } : i));
      set({ items });
      persist(items);
      return existing;
    }
    const created: BagItem = { ...item, id: newId(), addedAt: new Date().toISOString() };
    const items = [...get().items, created];
    set({ items });
    persist(items);
    return created;
  },
  replace(id, item) {
    const items = get().items.map((i) => (i.id === id ? { ...item, id, addedAt: i.addedAt } : i));
    set({ items });
    persist(items);
  },
  setQuantity(id, quantity) {
    const items = get().items.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, Math.min(10, Math.round(quantity))) } : i));
    set({ items });
    persist(items);
  },
  remove(id) {
    const items = get().items.filter((i) => i.id !== id);
    set({ items });
    persist(items);
  },
  clear() {
    set({ items: [] });
    persist([]);
  },
}));

export const bagCount = (items: BagItem[]) => items.reduce((n, i) => n + i.quantity, 0);
