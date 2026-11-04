import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { repos } from "@/data/repositories";
import { DATA_DIR } from "@/data/repositories/dev-store";
import { parseContact, type Contact } from "@/domain/contact";

/**
 * Popup subscribers, kept in a JSON file in the dev data folder (git-ignored). Development only:
 * production replaces this with a table (see docs/PRODUCTION.md). Writes are serialised and atomic.
 */
export interface Subscriber {
  id: string;
  contact: string;
  type: "email" | "phone";
  consent: boolean;
  createdAt: string;
  source: "popup";
  /** Set when the first-order welcome discount was used. */
  welcomeUsedAt: string | null;
}

const FILE = path.join(DATA_DIR, "subscribers.json");
let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}
async function read(): Promise<Subscriber[]> {
  try {
    const list = JSON.parse(await readFile(FILE, "utf8"));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
async function write(list: Subscriber[]) {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(list, null, 1));
  await rename(tmp, FILE);
}

export const addSubscriber = (c: Contact, consent: boolean) =>
  locked(async () => {
    const list = await read();
    const existing = list.find((s) => s.contact === c.value);
    if (existing) {
      if (consent && !existing.consent) {
        existing.consent = true;
        await write(list);
      }
      return { added: false };
    }
    list.push({ id: randomUUID(), contact: c.value, type: c.type, consent, createdAt: new Date().toISOString(), source: "popup", welcomeUsedAt: null });
    await write(list);
    return { added: true };
  });

/**
 * The welcome discount is valid only for a contact that is on the subscriber list, has no previous
 * order, and has not used it before. `contacts` are the identifiers of the order (email, mobile).
 * Decided on the server; the client only ever sends the identifiers.
 */
export async function welcomeEligibility(rawContacts: (string | null | undefined)[]): Promise<{ ok: boolean; subscriberId: string | null }> {
  const set = new Set(rawContacts.flatMap((c) => (c ? [parseContact(c)?.value] : [])).filter((v): v is string => Boolean(v)));
  if (!set.size) return { ok: false, subscriberId: null };
  const sub = (await read()).find((s) => set.has(s.contact) && !s.welcomeUsedAt);
  if (!sub) return { ok: false, subscriberId: null };
  const orders = await repos().orders.list();
  const hadOrder = orders.some((o) => (o.status as string) !== "cancelled" && (set.has(o.customer.email.toLowerCase()) || (o.customer.phone != null && set.has(o.customer.phone))));
  return hadOrder ? { ok: false, subscriberId: null } : { ok: true, subscriberId: sub.id };
}

export const markWelcomeUsed = (id: string) =>
  locked(async () => {
    const list = await read();
    const s = list.find((x) => x.id === id);
    if (s && !s.welcomeUsedAt) {
      s.welcomeUsedAt = new Date().toISOString();
      await write(list);
    }
  });
