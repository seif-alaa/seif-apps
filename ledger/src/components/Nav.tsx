import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ChartColumn, Home, ListChecks, Plus, Target } from "lucide-react";
import { useI18n } from "@/i18n";
import { useSheets } from "@/store/ui";
import { useReviewCount } from "@/db/hooks";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", key: "nav.home", icon: Home },
  { to: "/activity", key: "nav.activity", icon: ListChecks },
  null,
  { to: "/budgets", key: "nav.budgets", icon: Target },
  { to: "/insights", key: "nav.insights", icon: ChartColumn },
] as const;

/** Flat, full-width bar. "Add" sits in-line with the tabs at the same geometry — no floating button. */
export function Nav() {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const openAdd = useSheets((s) => s.openAdd);
  const reviews = useReviewCount();
  const hidden = pathname.startsWith("/settings") || pathname.startsWith("/sources") || pathname.startsWith("/accounts");
  return (
    <motion.nav
      initial={false}
      animate={{ y: hidden ? 100 : 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 45 }}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper/95 pb-[max(6px,env(safe-area-inset-bottom))] backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[560px] items-stretch px-2">
        {TABS.map((tab) => {
          if (!tab)
            return (
              <button
                key="add"
                aria-label={t("nav.add")}
                onClick={() => {
                  haptic("medium");
                  openAdd();
                }}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5"
              >
                <span className="flex h-8 w-11 items-center justify-center rounded bg-ink text-paper transition-transform active:scale-95">
                  <Plus className="size-5" strokeWidth={2} />
                </span>
              </button>
            );
          const active = tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to);
          const Icon = tab.icon;
          return (
            <NavLink key={tab.to} to={tab.to} onClick={() => !active && haptic("light")} className={cn("relative flex flex-1 flex-col items-center gap-0.5 pb-1 pt-2 text-2xs font-medium", active ? "text-ink" : "text-ink-3")}>
              <span className="relative">
                <Icon className="size-[21px]" strokeWidth={active ? 2 : 1.6} />
                {tab.to === "/activity" && reviews > 0 && <span className="absolute -end-1.5 -top-1 size-2 rounded-full bg-accent ring-2 ring-paper" />}
              </span>
              {t(tab.key)}
              {active && <motion.span layoutId="nav-mark" className="absolute top-0 h-0.5 w-6 rounded-full bg-accent" transition={{ type: "spring", stiffness: 600, damping: 45 }} />}
            </NavLink>
          );
        })}
      </div>
    </motion.nav>
  );
}
