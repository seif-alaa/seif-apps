import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EngineConfig } from "@/engine/config";

export type ThemePref = "dark" | "light" | "system";
export type Language = "en" | "ar";
export type NotifyPref = "off" | "review" | "all";

interface Prefs {
  name: string;
  /** Display / default currency for new accounts. Existing data is never converted. */
  currency: string;
  theme: ThemePref;
  language: Language;
  /** Arabic UI: show ٠١٢ (arab) or 012 (latn) digits. */
  digits: "arab" | "latn";
  hideAmounts: boolean;
  onboarded: boolean;
  installHintDismissed: boolean;
  /** True while the app shows labelled sample data. */
  sampleMode: boolean;
  devMode: boolean;
  autoCategorize: boolean;
  cautious: boolean;
  autoMatchTransfers: boolean;
  keepEvidence: boolean;
  notify: NotifyPref;
  aiConsent: boolean;
  aiShareMerchants: boolean;
  setPrefs: (p: Partial<Omit<Prefs, "setPrefs">>) => void;
}

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      name: "",
      currency: "EGP",
      theme: "system",
      language: "en",
      digits: "arab",
      hideAmounts: false,
      onboarded: false,
      installHintDismissed: false,
      sampleMode: false,
      devMode: false,
      autoCategorize: true,
      cautious: false,
      autoMatchTransfers: true,
      keepEvidence: false,
      notify: "review",
      aiConsent: false,
      aiShareMerchants: false,
      setPrefs: (p) => set(p),
    }),
    {
      name: "ledger-prefs",
      version: 2,
      // v1 → v2: keep everything the user chose; new fields take defaults.
      migrate: (state) => state as Prefs,
    },
  ),
);

export function engineConfig(): EngineConfig {
  const p = usePrefs.getState();
  return {
    autoCategorize: p.autoCategorize,
    autoThreshold: p.cautious ? 0.95 : 0.85,
    autoMatchTransfers: p.autoMatchTransfers,
    keepEvidence: p.keepEvidence,
    baseCurrency: p.currency,
  };
}

/** Transient UI: which sheet is open. */
interface Sheets {
  add: boolean;
  /** Review queue. `focus` jumps to a specific transaction first. */
  review: { open: boolean; focus: string | null };
  detail: string | null;
  openAdd: () => void;
  openReview: (focus?: string | null) => void;
  openDetail: (id: string) => void;
  closeAll: () => void;
  set: (p: Partial<Pick<Sheets, "add" | "review" | "detail">>) => void;
}

export const useSheets = create<Sheets>()((set) => ({
  add: false,
  review: { open: false, focus: null },
  detail: null,
  openAdd: () => set({ add: true }),
  openReview: (focus = null) => set({ review: { open: true, focus } }),
  openDetail: (id) => set({ detail: id }),
  closeAll: () => set({ add: false, review: { open: false, focus: null }, detail: null }),
  set: (p) => set(p),
}));
