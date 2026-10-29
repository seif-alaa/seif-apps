import { animate, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { haptic } from "@/lib/haptics";

const REVEAL = 84;

/** Swipe toward the leading edge to delete (with undo handled by the caller). */
export function SwipeableRow({ children, onDelete, label }: { children: ReactNode; onDelete: () => void; label: string }) {
  const x = useMotionValue(0);
  const armed = useRef(false);
  const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
  const sign = rtl ? 1 : -1;
  const reveal = useTransform(x, (v) => Math.min(1, Math.abs(v) / REVEAL));

  const onDrag = (_: unknown, info: PanInfo) => {
    const past = info.offset.x * sign > REVEAL * 1.5;
    if (past !== armed.current) {
      armed.current = past;
      if (past) haptic("medium");
    }
  };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const go = info.offset.x * sign > REVEAL * 1.5 || (info.velocity.x * sign > 800 && info.offset.x * sign > 40);
    armed.current = false;
    if (go) {
      haptic("warning");
      animate(x, sign * window.innerWidth, { duration: 0.18, ease: "easeIn" }).then(onDelete);
    } else animate(x, 0, { type: "spring", stiffness: 700, damping: 45 });
  };

  return (
    <div className="relative overflow-hidden">
      <motion.div style={{ opacity: reveal }} className="absolute inset-0 flex items-center justify-end bg-neg px-6 text-white rtl:justify-start">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Trash2 className="size-4" /> {label}
        </span>
      </motion.div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={rtl ? { left: 0, right: 480 } : { left: -480, right: 0 }}
        dragElastic={0.12}
        dragMomentum={false}
        style={{ x }}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  );
}
