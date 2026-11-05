/** Client-side memory of the first-visit popup. localStorage can be blocked, so every access is wrapped. */
export const WELCOME_KEY = "nv_welcome_v1";
export const CLOSED_DAYS = 14;

export type WelcomeState = { state: "closed"; at: number } | { state: "done"; at: number; code: string; contact: string };

export function readWelcome(): WelcomeState | null {
  try {
    const v = JSON.parse(localStorage.getItem(WELCOME_KEY) ?? "null");
    if (v?.state === "closed" && typeof v.at === "number") return v;
    if (v?.state === "done" && typeof v.code === "string") return v;
  } catch {
    /* blocked or corrupt: behave as a first visit */
  }
  return null;
}

export function writeWelcome(v: WelcomeState) {
  try {
    localStorage.setItem(WELCOME_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

/** Closed hides the popup for 14 days; completed hides it for good. */
export function popupAllowed(now = Date.now()): boolean {
  const s = readWelcome();
  if (!s) return true;
  if (s.state === "done") return false;
  return now - s.at > CLOSED_DAYS * 86_400_000;
}

/** The saved welcome code and the contact it was issued to, for the bag and checkout. */
export function savedWelcome(): { code: string; contact: string } | null {
  const s = readWelcome();
  return s?.state === "done" ? { code: s.code, contact: s.contact } : null;
}
