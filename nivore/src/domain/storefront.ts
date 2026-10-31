import { z } from "zod";

/**
 * Storefront modes. Resolved on the server (proxy + API guards), never by a
 * client-side overlay. The admin area is always reachable.
 */
export const StorefrontModeSchema = z.enum(["live", "coming_soon", "password", "maintenance", "browse_only", "scheduled"]);
export type StorefrontMode = z.infer<typeof StorefrontModeSchema>;

export const STOREFRONT_MODE_LABEL: Record<StorefrontMode, { title: string; detail: string }> = {
  live: { title: "Live", detail: "The website is fully open." },
  coming_soon: { title: "Coming soon", detail: "Visitors see the launch page, with an optional countdown." },
  password: { title: "Password access", detail: "Only visitors with an approved access code can enter." },
  maintenance: { title: "Maintenance", detail: "A calm, branded maintenance page is shown." },
  browse_only: { title: "Browsing only", detail: "Everything can be viewed; checkout and bidding are closed." },
  scheduled: { title: "Scheduled launch", detail: "Coming-soon page until the launch time, then live automatically." },
};

export const StorefrontSettingsSchema = z.object({
  mode: StorefrontModeSchema,
  /** ISO timestamp (UTC). Entered and displayed in Africa/Cairo in the admin. */
  launchAt: z.string().nullable(),
  countdownVisible: z.boolean(),
  headline: z.string().max(120),
  subheadline: z.string().max(280),
  announcement: z.string().max(280),
  backgroundImage: z.string().nullable(),
  waitlistEnabled: z.boolean(),
  maintenanceMessage: z.string().max(280),
  /** Independent switches that work in any open mode. */
  checkoutLocked: z.boolean(),
  checkoutLockedMessage: z.string().max(200),
  biddingLocked: z.boolean(),
  accessCodes: z.array(
    z.object({
      id: z.string(),
      label: z.string().max(60),
      /** SHA-256 hex of the code; plain codes are never stored. */
      codeHash: z.string(),
      active: z.boolean(),
      createdAt: z.string(),
    }),
  ),
});
export type StorefrontSettings = z.infer<typeof StorefrontSettingsSchema>;

export type Gate = "none" | "coming_soon" | "password" | "maintenance";

export interface ResolvedStorefront {
  gate: Gate;
  effectiveMode: StorefrontMode;
  checkoutOpen: boolean;
  biddingOpen: boolean;
  countdownTo: string | null;
}

export function resolveStorefront(
  s: Pick<StorefrontSettings, "mode" | "launchAt" | "countdownVisible" | "checkoutLocked" | "biddingLocked">,
  now: Date,
  opts: { hasAccessPass?: boolean } = {},
): ResolvedStorefront {
  let mode = s.mode;
  if (mode === "scheduled") {
    // Without a valid launch time the site stays closed rather than opening by accident.
    const launch = s.launchAt ? Date.parse(s.launchAt) : NaN;
    mode = Number.isFinite(launch) && now.getTime() >= launch ? "live" : "coming_soon";
  }
  const countdownTo =
    (s.mode === "scheduled" || s.mode === "coming_soon") && s.countdownVisible && s.launchAt && Date.parse(s.launchAt) > now.getTime()
      ? s.launchAt
      : null;

  const gate: Gate =
    mode === "coming_soon" ? "coming_soon" : mode === "maintenance" ? "maintenance" : mode === "password" && !opts.hasAccessPass ? "password" : "none";
  const open = gate === "none";
  const transacting = open && mode !== "browse_only";
  return {
    gate,
    effectiveMode: mode,
    checkoutOpen: transacting && !s.checkoutLocked,
    biddingOpen: transacting && !s.biddingLocked,
    countdownTo,
  };
}

/** Paths that bypass the storefront gate (admin, gate pages, assets, health). */
export function isGateExempt(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/gate") ||
    pathname.startsWith("/api/gate") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname === "/robots.txt"
  );
}

/** Format a UTC instant for the admin in Africa/Cairo. */
export function formatCairo(iso: string | null, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    dateStyle: "medium",
    timeStyle: "short",
    ...opts,
  }).format(new Date(iso));
}

/** Convert a `datetime-local` value typed in Cairo time to a UTC ISO string. */
export function cairoLocalToUtc(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new RangeError("Expected YYYY-MM-DDTHH:mm");
  const [, y, mo, d, h, mi] = m.map(Number);
  // Guess the instant as if UTC, then correct by Cairo's offset at that instant (handles DST).
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offset = cairoOffsetMinutes(new Date(guess));
  let utc = guess - offset * 60_000;
  const offset2 = cairoOffsetMinutes(new Date(utc));
  if (offset2 !== offset) utc = guess - offset2 * 60_000;
  return new Date(utc).toISOString();
}

export function utcToCairoLocal(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "00";
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
}

function cairoOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const p = (t: string) => Number(parts.find((x) => x.type === t)?.value);
  const asUtc = Date.UTC(p("year"), p("month") - 1, p("day"), p("hour"), p("minute"));
  return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}
