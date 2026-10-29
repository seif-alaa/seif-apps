import { db } from "@/db/db";
import type { IngestResult } from "@/engine/pipeline";
import { translate, formatMoneyString, numberLocale } from "@/i18n";
import { usePrefs } from "@/store/ui";

/**
 * Review notifications.
 *  - Foreground: the app shows its own in-page prompt (the review banner / toast), no system notification.
 *  - Background: one system notification via the service worker. Where the browser supports
 *    notification actions (Chrome on Android), the top suggestion is a one-tap action; iOS web
 *    notifications have no actions, so a tap opens the Quick Capture sheet directly.
 *  - Several items at once collapse into a single summary to avoid notification fatigue.
 */
export async function notifyResults(results: IngestResult[]) {
  const { notify, language, digits } = usePrefs.getState();
  if (notify === "off" || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;
  const reg = await navigator.serviceWorker?.getRegistration();
  if (!reg) return;
  const t = (k: string, v?: Record<string, string | number>) => translate(language, k, v);
  const review = results.filter((r) => r.needsReview && r.transactionId);
  const auto = results.filter((r) => r.autoAccepted);

  if (review.length === 1) {
    const txn = await db.transactions.get(review[0].transactionId!);
    if (!txn) return;
    const amount = formatMoneyString(txn.amount, txn.currency, numberLocale(language, digits));
    const cat = txn.classification === "suggested" && txn.categoryId ? await db.categories.get(txn.categoryId) : null;
    const catLabel = cat ? (cat.key ? t(`cat.${cat.key}`) : cat.name) : null;
    await reg.showNotification(t(txn.direction === "in" ? "notify.received" : "notify.paid", { amount, party: txn.merchant ?? "" }).trim(), {
      body: txn.direction === "in" ? t("notify.whatSource") : t("notify.whatFor"),
      tag: `review-${txn.id}`,
      data: { review: txn.id },
      // @ts-expect-error — `actions` is supported by Chromium; ignored elsewhere.
      actions: cat ? [{ action: `apply:${cat.id}`, title: catLabel }, { action: "review", title: t("notify.other") }] : [{ action: "review", title: t("notify.review") }],
    });
  } else if (review.length > 1) {
    await reg.showNotification(t("notify.many", { count: review.length }), { body: t("notify.manyBody"), tag: "review-summary", data: { review: "queue" } });
  } else if (auto.length && notify === "all") {
    await reg.showNotification(t("notify.auto", { count: auto.length }), { body: t("notify.autoBody"), tag: "auto-summary", silent: true, data: {} });
  }
}

export async function requestNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  return Notification.requestPermission();
}
