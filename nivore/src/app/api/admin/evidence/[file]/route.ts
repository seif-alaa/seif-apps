import { DATA_DIR } from "@/data/repositories/dev-store";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { currentAdmin } from "@/server/auth";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

/** Payment evidence is private: served only to signed-in admins, never from /public. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  if (!(await currentAdmin())) return new Response("Unauthorised", { status: 401 });
  const { file } = await params;
  const m = /^([0-9a-f-]{36})\.(jpg|png|webp|pdf)$/.exec(file);
  if (!m) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(DATA_DIR, "evidence", file));
    return new Response(data, { headers: { "Content-Type": TYPES[m[2]], "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
