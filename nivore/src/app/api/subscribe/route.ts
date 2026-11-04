import { z } from "zod";
import { parseContact, WELCOME_CODE } from "@/domain/contact";
import { json, readJson, requestIp, sameOrigin } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { addSubscriber } from "@/server/subscribers";

const Body = z.object({
  contact: z.string().max(120),
  consent: z.boolean().optional().default(false),
  /** Honeypot: real visitors never see or fill this. */
  website: z.string().max(200).optional().or(z.literal("")),
});

/** First-visit popup: stores an email or Egyptian mobile number (with consent flag) and returns the welcome code. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Refused." }, 403);
  if (!rateLimit(`subscribe:${requestIp(req)}`, 5, 60 * 60_000).ok) return json({ error: "Too many attempts. Please try again later." }, 429);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "Please check what you entered." }, 422);
  if (parsed.data.website) return json({ ok: true, code: WELCOME_CODE }); // honeypot: pretend, store nothing
  const contact = parseContact(parsed.data.contact);
  if (!contact) return json({ error: "Enter a valid email address or an Egyptian mobile number (e.g. 010 1234 5678)." }, 422);
  await addSubscriber(contact, parsed.data.consent);
  return json({ ok: true, code: WELCOME_CODE, contact: contact.value, type: contact.type });
}
