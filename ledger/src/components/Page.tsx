import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { PullToRefresh } from "./PullToRefresh";
import { checkForUpdate } from "@/lib/pwa";

/** Route wrapper: page transition + scroll container + pull-to-refresh. */
export function Page({ children, onRefresh = checkForUpdate }: { children: ReactNode; onRefresh?: () => Promise<unknown> | void }) {
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0, y: 10, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
    >
      <PullToRefresh onRefresh={onRefresh}>
        <div className="mx-auto max-w-lg pb-36">{children}</div>
      </PullToRefresh>
    </motion.div>
  );
}

/** Staggered entrance for stacked sections. */
export function Reveal({ children, i = 0, className }: { children: ReactNode; i?: number; className?: string }) {
  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28, delay: 0.04 + i * 0.06 }}
    >
      {children}
    </motion.section>
  );
}
