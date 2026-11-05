import { z } from "zod";
import { repos } from "@/data/repositories";
import { json, readJson, requestIp, sameOrigin } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

const Body = z.object({
  kind: z.enum(["contact", "commission"]),
  name: z.string().trim().min(2, "Please enter your name.").max(80),
  email: z.email("Please enter a valid email address.").max(120),
  phone: z.string().trim().max(24).optional().or(z.literal("")),
  message: z.string().trim().min(10, "A few more words, please.").max(3000),
  details: z.record(z.string().max(40), z.string().max(200)).optional(),
  website: z.string().max(0).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Refused." }, 403);
  if (!rateLimit(`contact:${requestIp(req)}`, 4, 30 * 60_000).ok) return json({ error: "You have sent several messages. Please try again later." }, 429);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "Please check the highlighted fields.", fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) }, 422);
  if (parsed.data.website) return json({ ok: true }); // honeypot: pretend success
  const { website: _w, ...data } = parsed.data;
  await repos().misc.addInquiry({ ...data, phone: data.phone || null, details: data.details ?? {} });
  const settings = await repos().settings.get();
  return json({ ok: true, notified: settings.notifications.emailProvider !== "none" });
}
