import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const THRESHOLD = 64;

/** Scroll container with a restrained pull-to-refresh: a thin progress rule, not a spinner bubble. */
export function PullToRefresh({ onRefresh, children, className }: { onRefresh?: () => Promise<unknown> | void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const [busy, setBusy] = useState(false);
  const progress = useTransform(y, [0, THRESHOLD], [0, 1]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onRefresh) return;
    let startY = 0;
    let pulling = false;
    let armed = false;
    let running = false;
    const start = (e: TouchEvent) => {
      if (running || el.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
      armed = false;
    };
    const move = (e: TouchEvent) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || el.scrollTop > 0) return y.set(0);
      e.preventDefault();
      const d = 96 * (1 - Math.exp(-dy / 160));
      y.set(d);
      if (!armed && d >= THRESHOLD) {
        armed = true;
        haptic("medium");
      } else if (armed && d < THRESHOLD) armed = false;
    };
    const end = async () => {
      if (!pulling) return;
      pulling = false;
      if (armed) {
        running = true;
        setBusy(true);
        animate(y, 40, { type: "spring", stiffness: 500, damping: 40 });
        await Promise.all([onRefresh(), new Promise((r) => setTimeout(r, 500))]);
        setBusy(false);
        running = false;
      }
      animate(y, 0, { type: "spring", stiffness: 500, damping: 38 });
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [onRefresh, y]);

  return (
    <div ref={ref} className={cn("scroll-area no-scrollbar relative h-full", className)}>
      {onRefresh && (
        <motion.div className="pointer-events-none absolute inset-x-0 top-[env(safe-area-inset-top)] z-20 h-0.5 origin-left bg-accent" style={{ scaleX: progress, opacity: progress }}>
          {busy && <div className="h-full w-full animate-pulse bg-accent" />}
        </motion.div>
      )}
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}
