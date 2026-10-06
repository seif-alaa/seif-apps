import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const THRESHOLD = 72;
const HOLD = 56;

/**
 * A scroll container with a rubber-band pull-to-refresh. Pulling past the
 * threshold ticks a haptic, holds the spinner while `onRefresh` runs, then
 * springs back with a little overshoot.
 */
export function PullToRefresh({ onRefresh, children, className }: { onRefresh?: () => Promise<unknown> | void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const [refreshing, setRefreshing] = useState(false);
  const progress = useTransform(y, [0, THRESHOLD], [0, 1]);
  const rotate = useTransform(y, [0, THRESHOLD * 1.6], [0, 300]);
  const indicatorY = useTransform(y, (v) => Math.min(v, THRESHOLD) / 2 - 20);
  const scale = useTransform(progress, [0, 1], [0.5, 1]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onRefresh) return;
    let startY = 0;
    let pulling = false;
    let armed = false;
    let busy = false;

    const start = (e: TouchEvent) => {
      if (busy || el.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
      armed = false;
    };
    const move = (e: TouchEvent) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || el.scrollTop > 0) {
        y.set(0);
        return;
      }
      e.preventDefault();
      // Rubber band: resistance grows the further you pull.
      const damped = 110 * (1 - Math.exp(-dy / 170));
      y.set(damped);
      if (!armed && damped >= THRESHOLD) {
        armed = true;
        haptic("medium");
      } else if (armed && damped < THRESHOLD) {
        armed = false;
      }
    };
    const end = async () => {
      if (!pulling) return;
      pulling = false;
      if (armed) {
        busy = true;
        setRefreshing(true);
        animate(y, HOLD, { type: "spring", stiffness: 400, damping: 30 });
        await Promise.all([onRefresh(), new Promise((r) => setTimeout(r, 900))]);
        haptic("success");
        setRefreshing(false);
        busy = false;
      }
      animate(y, 0, { type: "spring", stiffness: 380, damping: 18, mass: 0.9 });
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
        <motion.div style={{ y: indicatorY, opacity: progress, scale }} className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+8px)] z-20 flex justify-center">
          <div className="glass flex size-10 items-center justify-center rounded-full shadow-soft">
            <motion.div style={refreshing ? undefined : { rotate }} className={cn("text-emerald", refreshing && "animate-spin")}>
              <RefreshCw className="size-[18px]" strokeWidth={2.5} />
            </motion.div>
          </div>
        </motion.div>
      )}
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}
