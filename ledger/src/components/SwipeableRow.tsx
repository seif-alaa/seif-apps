import { animate, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { haptic } from "@/lib/haptics";

const REVEAL = 88;

/** Swipe left to delete. Past the threshold the row flies off and `onDelete` fires. */
export function SwipeableRow({ children, onDelete, onTap }: { children: ReactNode; onDelete: () => void; onTap?: () => void }) {
  const x = useMotionValue(0);
  const dragged = useRef(false);
  const armed = useRef(false);
  const iconScale = useTransform(x, [-REVEAL * 1.4, -REVEAL, -24, 0], [1.25, 1, 0.6, 0.4]);
  const bgOpacity = useTransform(x, [-REVEAL, -10, 0], [1, 0.4, 0]);

  const onDrag = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 6) dragged.current = true;
    const past = info.offset.x < -REVEAL * 1.4;
    if (past !== armed.current) {
      armed.current = past;
      if (past) haptic("medium");
    }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const shouldDelete = info.offset.x < -REVEAL * 1.4 || (info.velocity.x < -700 && info.offset.x < -40);
    if (shouldDelete) {
      haptic("warning");
      animate(x, -window.innerWidth, { type: "spring", stiffness: 300, damping: 34 }).then(onDelete);
    } else {
      animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
    }
    armed.current = false;
    setTimeout(() => (dragged.current = false), 0);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <motion.div style={{ opacity: bgOpacity }} className="absolute inset-0 flex items-center justify-end rounded-2xl bg-coral pr-6 text-white">
        <motion.div style={{ scale: iconScale }} className="flex flex-col items-center gap-0.5">
          <Trash2 className="size-5" />
          <span className="text-[11px] font-semibold">Delete</span>
        </motion.div>
      </motion.div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -480, right: 0 }}
        dragElastic={{ left: 0.2, right: 0.04 }}
        dragMomentum={false}
        style={{ x }}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        onClick={() => !dragged.current && onTap?.()}
        className="relative bg-card"
      >
        {children}
      </motion.div>
    </div>
  );
}
