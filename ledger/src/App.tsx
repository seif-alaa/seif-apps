import { useEffect } from "react";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import Activity from "@/pages/Activity";
import Budgets from "@/pages/Budgets";
import Insights from "@/pages/Insights";
import Settings from "@/pages/Settings";
import Onboarding from "@/pages/Onboarding";
import { TabBar } from "@/components/TabBar";
import { ComposerSheet } from "@/components/ComposerSheet";
import { ensureBasics } from "@/db/seed";
import { useApplyTheme } from "@/lib/theme";
import { usePrefs } from "@/store/ui";

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  const theme = useApplyTheme();
  const onboarded = usePrefs((s) => s.onboarded);

  useEffect(() => {
    ensureBasics();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <HashRouter>
        {/* data-vaul-drawer-wrapper lets the page scale back when a sheet opens */}
        <div data-vaul-drawer-wrapper="" className="relative h-full overflow-hidden bg-background">
          {onboarded ? (
            <>
              <AnimatedRoutes />
              <TabBar />
            </>
          ) : (
            <Onboarding />
          )}
        </div>
        <ComposerSheet />
        <Toaster
          theme={theme}
          position="top-center"
          offset="calc(env(safe-area-inset-top) + 12px)"
          toastOptions={{
            classNames: {
              toast: "!rounded-2xl !border-border/70 !bg-popover/90 !backdrop-blur-xl !shadow-lift !text-foreground !font-sans",
              description: "!text-muted-foreground",
              actionButton: "!rounded-xl !bg-primary !text-primary-foreground !font-semibold",
            },
          }}
        />
      </HashRouter>
    </MotionConfig>
  );
}
