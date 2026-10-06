import { registerSW } from "virtual:pwa-register";

let registration: ServiceWorkerRegistration | undefined;

export function setupPWA() {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      registration = reg;
    },
  });
}

/** Used by pull-to-refresh: ask the service worker to look for a new build. */
export async function checkForUpdate() {
  try {
    await registration?.update();
  } catch {
    /* offline — that's fine, everything is local */
  }
}

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
