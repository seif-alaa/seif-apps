"use server";

import { redirect } from "next/navigation";
import { repos } from "@/data/repositories";
import { assertSameOrigin, checkCredentials, clientIp, endAdminSession, startAdminSession } from "@/server/auth";
import { hit, peek } from "@/server/rate-limit";

export async function signIn(_prev: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  await assertSameOrigin();
  const ip = await clientIp();
  // Only failed attempts count towards the lockout.
  const limit = peek(`login:${ip}`, 5, 15 * 60_000);
  if (!limit.ok) return { error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterS / 60)} minutes.` };
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!checkCredentials(email, password)) {
    hit(`login:${ip}`);
    await repos().misc.log({ actor: email.slice(0, 80) || "unknown", action: "admin.login.failed", entity: "admin", entityId: "-", summary: "Failed sign-in attempt" });
    return { error: "Those details are not recognised." };
  }
  await startAdminSession(email.trim().toLowerCase());
  await repos().misc.log({ actor: email, action: "admin.login", entity: "admin", entityId: "-", summary: "Signed in" });
  const next = String(form.get("next") ?? "/admin");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function signOut() {
  await endAdminSession();
  redirect("/admin/login");
}
