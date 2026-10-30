/**
 * HMAC-signed tokens (Web Crypto, so it runs in the proxy and in route
 * handlers alike). Used for the admin session and storefront access passes.
 * Tokens are stateless; rotate SESSION_SECRET to revoke all sessions.
 */

export const ADMIN_COOKIE = "nv_admin";
export const PASS_COOKIE = "nv_pass";
export const ADMIN_SESSION_HOURS = 12;

const DEV_FALLBACK_SECRET = "nivore-development-secret-do-not-use-in-production";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET (32+ characters) must be set in production.");
  }
  return DEV_FALLBACK_SECRET;
}

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

let keyPromise: Promise<CryptoKey> | null = null;
function key(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return keyPromise;
}

export interface TokenPayload {
  kind: "admin" | "pass";
  sub: string;
  exp: number; // epoch seconds
  iat: number;
}

export async function signToken(payload: Omit<TokenPayload, "iat">): Promise<string> {
  const full: TokenPayload = { ...payload, iat: Math.floor(Date.now() / 1000) };
  const body = b64url(enc.encode(JSON.stringify(full)));
  const sig = await crypto.subtle.sign("HMAC", await key(), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifyToken(token: string | undefined | null, kind: TokenPayload["kind"]): Promise<TokenPayload | null> {
  if (!token || token.length > 2048) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), unb64url(sig) as BufferSource, enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(unb64url(body))) as TokenPayload;
    if (payload.kind !== kind || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison for secrets of equal length. */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
