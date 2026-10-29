import type { SourceKind } from "./model";

/**
 * Every way money facts can reach Ledger, described honestly. `availability`
 * reflects what THIS build can actually do on the device it's running on —
 * not what's on the roadmap.
 */
export type Availability = "available" | "needs_native_app" | "needs_partner" | "planned" | "dev_only";
export type Automation = "automatic" | "semi_automatic" | "import" | "manual";

export interface SourceInfo {
  kind: SourceKind;
  titleKey: string;
  bodyKey: string;
  /** What the source can read — shown before the user enables it. */
  accessKey: string;
  automation: Automation;
  platforms: ("web" | "android" | "ios")[];
  availability: Availability;
}

export const SOURCES: SourceInfo[] = [
  { kind: "sms_paste", titleKey: "src.paste.title", bodyKey: "src.paste.body", accessKey: "src.paste.access", automation: "semi_automatic", platforms: ["web", "android", "ios"], availability: "available" },
  { kind: "share_target", titleKey: "src.share.title", bodyKey: "src.share.body", accessKey: "src.share.access", automation: "semi_automatic", platforms: ["android"], availability: "available" },
  { kind: "ios_shortcut", titleKey: "src.shortcut.title", bodyKey: "src.shortcut.body", accessKey: "src.shortcut.access", automation: "semi_automatic", platforms: ["ios"], availability: "available" },
  { kind: "statement_csv", titleKey: "src.csv.title", bodyKey: "src.csv.body", accessKey: "src.csv.access", automation: "import", platforms: ["web", "android", "ios"], availability: "available" },
  { kind: "manual", titleKey: "src.manual.title", bodyKey: "src.manual.body", accessKey: "src.manual.access", automation: "manual", platforms: ["web", "android", "ios"], availability: "available" },
  { kind: "android_sms", titleKey: "src.androidSms.title", bodyKey: "src.androidSms.body", accessKey: "src.androidSms.access", automation: "automatic", platforms: ["android"], availability: "needs_native_app" },
  { kind: "android_notification", titleKey: "src.androidNotif.title", bodyKey: "src.androidNotif.body", accessKey: "src.androidNotif.access", automation: "automatic", platforms: ["android"], availability: "needs_native_app" },
  { kind: "open_banking", titleKey: "src.openBanking.title", bodyKey: "src.openBanking.body", accessKey: "src.openBanking.access", automation: "automatic", platforms: ["web", "android", "ios"], availability: "needs_partner" },
  { kind: "email", titleKey: "src.email.title", bodyKey: "src.email.body", accessKey: "src.email.access", automation: "automatic", platforms: ["web", "android", "ios"], availability: "planned" },
  { kind: "simulator", titleKey: "src.sim.title", bodyKey: "src.sim.body", accessKey: "src.sim.access", automation: "automatic", platforms: ["web", "android", "ios"], availability: "dev_only" },
];

export const sourceInfo = (k: SourceKind) => SOURCES.find((s) => s.kind === k);

/** Coarse platform detection for showing the right setup instructions. */
export function currentPlatform(): "ios" | "android" | "web" {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return "web";
}

/** How an account is kept up to date, derived from where its transactions actually came from. */
export type TrackingMode = "automatic" | "partial" | "import" | "manual" | "disconnected";

export function trackingMode(sourceKinds: Set<SourceKind>, disconnected: boolean): TrackingMode {
  if (disconnected) return "disconnected";
  if (sourceKinds.has("android_sms") || sourceKinds.has("android_notification") || sourceKinds.has("open_banking") || sourceKinds.has("native_bridge")) return "automatic";
  if (sourceKinds.has("sms_paste") || sourceKinds.has("share_target") || sourceKinds.has("ios_shortcut")) return "partial";
  if (sourceKinds.has("statement_csv")) return "import";
  return "manual";
}
