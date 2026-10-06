import { AnimatePresence, motion } from "framer-motion";
import { Share, X } from "lucide-react";
import { useState } from "react";
import { isIOS, isStandalone } from "@/lib/pwa";
import { usePrefs } from "@/store/ui";

/** Gentle nudge for Safari users: Share → Add to Home Screen. */
export function InstallHint() {
  const dismissed = usePrefs((s) => s.installHintDismissed);
  const setPrefs = usePrefs((s) => s.setPrefs);
  const [show] = useState(() => isIOS() && !isStandalone());
  return (
    <AnimatePresence>
      {show && !dismissed && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="px-5">
          <div className="surface-card mb-4 flex items-start gap-3 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-soft text-xl">📲</div>
            <div className="flex-1 text-sm">
              <div className="font-semibold">Make Ledger feel native</div>
              <div className="mt-0.5 text-muted-foreground">
                Tap <Share className="inline size-4 -translate-y-px text-emerald" /> then <b className="text-foreground">Add to Home Screen</b>. It works offline too.
              </div>
            </div>
            <button aria-label="Dismiss" onClick={() => setPrefs({ installHintDismissed: true })} className="text-muted-foreground">
              <X className="size-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
