import "server-only";
import { NextResponse } from "next/server";
import { sha256Hex } from "./session";

/** Shared helpers for public API route handlers. */

export function json(data: unknown, init: number | ResponseInit = 200) {
  const res = NextResponse.json(data, typeof init === "number" ? { status: init } : init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function requestIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** Hash IPs before storing them (abuse investigation without keeping raw addresses). */
export async function ipHash(req: Request): Promise<string> {
  return (await sha256Hex(`${requestIp(req)}:${process.env.SESSION_SECRET ?? "dev"}`)).slice(0, 24);
}

/** Refuse cross-site mutations (CSRF defence for cookie-free public endpoints too). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson<T = unknown>(req: Request, maxBytes = 64_000): Promise<T | null> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
