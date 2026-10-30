import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Actor } from "@/data/repositories";
import { ADMIN_COOKIE, ADMIN_SESSION_HOURS, safeEqual, signToken, verifyToken } from "./session";

/**
 * Admin authentication (development implementation).
 *
 * One administrator, configured with ADMIN_EMAIL / ADMIN_PASSWORD. In
 * development, if those are unset, a local-only default is used and shown on
 * the sign-in page. In production the variables are mandatory. Phase 6
 * replaces this with a managed identity provider and an AdminUser table with
 * roles (docs/PRODUCTION.md).
 */

const DEV_EMAIL = "atelier@nivore.local";
const DEV_PASSWORD = "atelier-dev";

export function adminCredentials(): { email: string; password: string; isDevDefault: boolean } | null {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password && password.length >= 10) return { email, password, isDevDefault: false };
  if (process.env.NODE_ENV === "production") return null;
  return { email: DEV_EMAIL, password: DEV_PASSWORD, isDevDefault: true };
}

export function checkCredentials(email: string, password: string): boolean {
  const creds = adminCredentials();
  if (!creds) return false;
  // Compare both fields even when the first fails, to keep timing flat.
  const a = safeEqual(email.trim().toLowerCase(), creds.email.toLowerCase());
  const b = safeEqual(password, creds.password);
  return a && b;
}

export async function startAdminSession(email: string) {
  const token = await signToken({ kind: "admin", sub: email, exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_HOURS * 3600 });
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_HOURS * 3600,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function currentAdmin(): Promise<Actor | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const payload = await verifyToken(token, "admin");
  return payload ? { id: payload.sub, label: payload.sub } : null;
}

/** Server-side authorisation for every admin page and action (defence in depth behind the proxy). */
export async function requireAdmin(): Promise<Actor> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** Mutations must originate from this site (in addition to SameSite=strict cookies). */
export async function assertSameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (origin && host && new URL(origin).host !== host) throw new Error("Cross-origin request refused.");
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
