import { z } from "zod";
import { repos } from "@/data/repositories";
import { json, readJson, requestIp, sameOrigin } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { PASS_COOKIE, sha256Hex, signToken } from "@/server/session";

const Body = z.object({ code: z.string().trim().min(1).max(64) });

/** Password-access mode: exchange a valid access code for a signed pass cookie. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Refused." }, 403);
  const limit = rateLimit(`gate:${requestIp(req)}`, 8, 15 * 60_000);
  if (!limit.ok) return json({ error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterS / 60)} minutes.` }, 429);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "Enter your access code." }, 400);
  const settings = await repos().settings.get();
  const hash = await sha256Hex(parsed.data.code.trim().toUpperCase());
  const match = settings.storefront.accessCodes.find((c) => c.active && c.codeHash === hash);
  if (!match) return json({ error: "That code is not recognised." }, 401);
  const token = await signToken({ kind: "pass", sub: match.id, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14 });
  const res = json({ ok: true });
  res.cookies.set(PASS_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 });
  return res;
}
