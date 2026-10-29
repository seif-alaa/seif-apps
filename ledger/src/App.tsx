import { useEffect } from "react";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { Toaster, toast } from "sonner";
import Home from "@/pages/Home";
import Activity from "@/pages/Activity";
import Budgets from "@/pages/Budgets";
import Insights from "@/pages/Insights";
import Settings from "@/pages/Settings";
import Sources from "@/pages/Sources";
import Onboarding from "@/pages/Onboarding";
import { AccountDetail, AccountsList } from "@/pages/Accounts";
import { Nav } from "@/components/Nav";
import { AddSheet } from "@/components/AddSheet";
import { ReviewSheet } from "@/components/ReviewSheet";
import { DetailSheet } from "@/components/DetailSheet";
import { db } from "@/db/db";
import { ensureBasics } from "@/db/seed";
import { readCaptureParams } from "@/engine/bridge";
import { confirmClassification } from "@/engine/actions";
import { captureText, installNativeBridge } from "@/lib/capture";
import { useApplyAppearance } from "@/lib/theme";
import { translate } from "@/i18n";
import { engineConfig, usePrefs, useSheets } from "@/store/ui";

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
        <Route path="/sources" element={<Sources />} />
        <Route path="/accounts" element={<AccountsList />} />
        <Route path="/accounts/:id" element={<AccountDetail />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </AnimatePresence>
  );
}

/**
 * Entry points from outside the app:
 *  - ?capture=…&via=shortcut   iOS Shortcut automation
 *  - ?text=… / ?share_text=…   Android share sheet (Web Share Target)
 *  - ?review=<id>&apply=<cat>  tapping a review notification or its action
 */
async function handleLaunchParams(search: string) {
  const t = (k: string, v?: Record<string, string | number>) => translate(usePrefs.getState().language, k, v);
  const params = new URLSearchParams(search);
  const capture = readCaptureParams(search);
  if (capture) {
    const conn = await db.sources.where("kind").equals(capture.via).first();
    if (conn?.status === "disconnected") {
      toast(t("capture.disconnected"));
    } else {
      const s = await captureText(capture.text, capture.via);
      const first = s.results.find((r) => r.needsReview);
      if (first) useSheets.getState().openReview(first.transactionId);
      else if (s.results.length) toast.success(t("capture.saved", { count: s.results.length }));
      else toast(t(s.sensitive ? "capture.sensitive" : "capture.unreadable"));
    }
  }
  const review = params.get("review");
  const apply = params.get("apply");
  if (review) await openFromNotification(review, apply);
  if (capture || review) history.replaceState(null, "", location.pathname + location.hash);
}

async function openFromNotification(review: string, apply: string | null) {
  const t = (k: string, v?: Record<string, string | number>) => translate(usePrefs.getState().language, k, v);
  if (review === "queue") return useSheets.getState().openReview();
  const txn = await db.transactions.get(review);
  if (!txn) return;
  if (apply && txn.review === "needs_review") {
    const cat = await db.categories.get(apply);
    if (cat) {
      await confirmClassification(txn.id, { kind: cat.kind === "income" ? "income" : txn.direction === "in" ? "refund" : "expense", categoryId: cat.id }, engineConfig());
      toast.success(t("review.filed", { label: cat.key ? t(`cat.${cat.key}`) : cat.name }), { action: { label: t("common.change"), onClick: () => useSheets.getState().openDetail(txn.id) } });
      return;
    }
  }
  useSheets.getState().openReview(txn.id);
}

export default function App() {
  const theme = useApplyAppearance();
  const onboarded = usePrefs((s) => s.onboarded);

  useEffect(() => {
    void ensureBasics().then(() => handleLaunchParams(location.search));
    installNativeBridge();
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "ledger:open" && e.data.review) void openFromNotification(e.data.review, e.data.apply);
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <HashRouter>
        <div data-vaul-drawer-wrapper="" className="relative h-full overflow-hidden bg-paper">
          {onboarded ? (
            <>
              <AnimatedRoutes />
              <Nav />
            </>
          ) : (
            <Onboarding />
          )}
        </div>
        <ReviewSheet />
        <AddSheet />
        <DetailSheet />
        <Toaster
          theme={theme}
          position="top-center"
          offset="calc(env(safe-area-inset-top) + 10px)"
          toastOptions={{
            classNames: {
              toast: "!rounded !border-rule !bg-raised !shadow-pop !text-ink !font-sans !text-sm",
              description: "!text-ink-3",
              actionButton: "!rounded-sm !bg-ink !text-paper !font-medium",
            },
          }}
        />
      </HashRouter>
    </MotionConfig>
  );
}
