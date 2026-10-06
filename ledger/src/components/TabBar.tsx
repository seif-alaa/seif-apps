import { motion } from "framer-motion";
import { NavLink, useLocation } from "react-router-dom";
import { BarChart3, Home, Plus, Receipt, Target } from "lucide-react";
import { useComposer } from "@/store/ui";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/activity", label: "Activity", icon: Receipt },
  null,
  { to: "/budgets", label: "Budgets", icon: Target },
  { to: "/insights", label: "Insights", icon: BarChart3 },
] as const;

export function TabBar() {
  const { pathname } = useLocation();
  const openNew = useComposer((s) => s.openNew);
  const hidden = pathname.startsWith("/settings");
  return (
    <motion.nav
      initial={false}
      animate={{ y: hidden ? 140 : 0, opacity: hidden ? 0 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 36 }}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="glass pointer-events-auto flex w-full max-w-md items-center justify-between rounded-[1.6rem] px-2 py-1.5 shadow-lift">
        {tabs.map((t) => {
          if (!t)
            return (
              <motion.button
                key="add"
                aria-label="Add transaction"
                whileTap={{ scale: 0.86, rotate: 90 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                onClick={() => {
                  haptic("medium");
                  openNew();
                }}
                className="mx-1 flex size-14 -translate-y-3 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-emerald to-[hsl(178_55%_38%)] text-primary-foreground shadow-glow ring-4 ring-background"
              >
                <Plus className="size-7" strokeWidth={2.6} />
              </motion.button>
            );
          const active = t.to === "/" ? pathname === "/" : pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <NavLink
              key={t.to}
              to={t.to}
              onClick={() => !active && haptic("light")}
              className={cn("relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-medium transition-colors", active ? "text-foreground" : "text-muted-foreground")}
            >
              {active && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-2xl bg-accent" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <motion.span className="relative" animate={{ scale: active ? 1.08 : 1, y: active ? -1 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
                <Icon className={cn("size-[22px]", active && "text-emerald")} strokeWidth={active ? 2.4 : 2} />
              </motion.span>
              <span className="relative">{t.label}</span>
            </NavLink>
          );
        })}
      </div>
    </motion.nav>
  );
}
