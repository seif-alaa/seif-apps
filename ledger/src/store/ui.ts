import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Transaction, TxnType } from "@/db/db";

export type ThemePref = "dark" | "light" | "system";

interface Prefs {
  name: string;
  currency: string;
  theme: ThemePref;
  hideAmounts: boolean;
  onboarded: boolean;
  installHintDismissed: boolean;
  setPrefs: (p: Partial<Omit<Prefs, "setPrefs">>) => void;
}

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      name: "",
      currency: "USD",
      theme: "dark",
      hideAmounts: false,
      onboarded: false,
      installHintDismissed: false,
      setPrefs: (p) => set(p),
    }),
    { name: "ledger-prefs" },
  ),
);

interface Composer {
  open: boolean;
  /** When set, the sheet edits this transaction instead of creating one. */
  editing: Transaction | null;
  defaultType: TxnType;
  openNew: (type?: TxnType) => void;
  openEdit: (t: Transaction) => void;
  close: () => void;
}

export const useComposer = create<Composer>()((set) => ({
  open: false,
  editing: null,
  defaultType: "expense",
  openNew: (type = "expense") => set({ open: true, editing: null, defaultType: type }),
  openEdit: (t) => set({ open: true, editing: t, defaultType: t.type }),
  close: () => set({ open: false }),
}));
