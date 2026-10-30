import { NextResponse, type NextRequest } from "next/server";
import { repos } from "@/data/repositories";
import { isGateExempt, resolveStorefront } from "@/domain/storefront";
import { ADMIN_COOKIE, PASS_COOKIE, verifyToken } from "@/server/session";

/**
 * Server-side enforcement (runs before any route renders):
 *  1. /admin requires a valid signed admin session.
 *  2. Storefront modes: coming soon, password, maintenance and scheduled
 *     launch rewrite every public page to the matching gate page, and public
 *     APIs answer 503. Admin access always remains available.
 * Checkout/bidding locks (browse-only, checkout lock) are enforced again in
 * the API routes themselves.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const admin = await verifyToken(request.cookies.get(ADMIN_COOKIE)?.value, "admin");

  if ((pathname.startsWith("/admin") && pathname !== "/admin/login") || pathname.startsWith("/api/admin")) {
    if (!admin) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return withNoIndex(NextResponse.next());
  }

  if (isGateExempt(pathname)) return NextResponse.next();

  // Admins preview the full site in every mode.
  if (admin) return NextResponse.next({ headers: { "x-nivore-admin-preview": "1" } });

  const settings = await repos().settings.get();
  const pass = await verifyToken(request.cookies.get(PASS_COOKIE)?.value, "pass");
  const passValid = Boolean(pass && settings.storefront.accessCodes.some((c) => c.id === pass.sub && c.active));
  const resolved = resolveStorefront(settings.storefront, new Date(), { hasAccessPass: passValid });

  if (resolved.gate === "none") return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "The storefront is currently closed." }, { status: 503 });
  }
  const target = new URL(`/gate/${resolved.gate.replace("_", "-")}`, request.url);
  if (resolved.gate === "password") target.searchParams.set("next", pathname);
  return NextResponse.rewrite(target, { headers: { "Cache-Control": "no-store" } });
}

function withNoIndex(res: NextResponse) {
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|uploads|favicon.ico|icon.svg|robots.txt).*)"],
};
