import { z } from "zod";
import { repos } from "@/data/repositories";
import { json, readJson, requestIp, sameOrigin } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

const Body = z.object({ email: z.email().max(120), website: z.string().max(0).optional().or(z.literal("")) });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Refused." }, 403);
  if (!rateLimit(`waitlist:${requestIp(req)}`, 5, 10 * 60_000).ok) return json({ error: "Please try again later." }, 429);
  const settings = await repos().settings.get();
  if (!settings.storefront.waitlistEnabled) return json({ error: "The list is closed." }, 403);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "Please enter a valid email address." }, 422);
  if (parsed.data.website) return json({ ok: true });
  await repos().misc.addWaitlist(parsed.data.email, "coming-soon");
  return json({ ok: true });
}
