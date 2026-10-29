/* Ledger notification actions (imported into the generated service worker). */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const params = new URLSearchParams();
  if (data.review) params.set("review", data.review);
  if (event.action && event.action.startsWith("apply:")) params.set("apply", event.action.slice(6));
  const url = new URL(`./?${params.toString()}`, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          c.postMessage({ type: "ledger:open", review: data.review || null, apply: params.get("apply") });
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
