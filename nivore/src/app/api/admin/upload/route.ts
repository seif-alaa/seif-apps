import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { repos } from "@/data/repositories";
import { currentAdmin } from "@/server/auth";
import { sameOrigin } from "@/server/http";
import { imageMeta } from "@/server/image-meta";

const MAX = 12 * 1024 * 1024;

/**
 * Admin image upload (development storage: public/uploads/dev). Files are
 * identified by their bytes, renamed to random ids, and size-limited.
 * Production replaces this with object storage (docs/PRODUCTION.md).
 */
export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return Response.json({ error: "Not signed in." }, { status: 401 });
  if (!sameOrigin(req)) return Response.json({ error: "Refused." }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return Response.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: "Images must be under 12 MB." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const meta = imageMeta(bytes);
  if (!meta || meta.width < 1 || meta.height < 1 || meta.width > 8000 || meta.height > 8000) {
    return Response.json({ error: "Upload a PNG, WebP or JPEG up to 8000 px." }, { status: 415 });
  }
  const name = `${randomUUID()}.${meta.ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "dev");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  await repos().misc.log({ actor: admin.label, action: "upload", entity: "asset", entityId: name, summary: `Uploaded ${file.name.slice(0, 60)} (${meta.width}×${meta.height})` });
  return Response.json({ src: `/uploads/dev/${name}`, width: meta.width, height: meta.height, type: meta.type });
}
