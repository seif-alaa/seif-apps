import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Brand";
import { AdminNav } from "@/components/admin/AdminNav";
import { repos } from "@/data/repositories";
import { requireAdmin } from "@/server/auth";
import { signOut } from "../login/actions";

export const metadata: Metadata = { title: { default: "Atelier control", template: "%s · Atelier control" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const dev = repos().driver === "dev";
  return (
    <div className="min-h-dvh bg-ivory lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="bg-espresso px-4 py-5 text-ivory lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:py-7">
        <div className="flex items-center justify-between lg:block">
          <Link href="/admin" className="block px-3"><Wordmark secondary tone="reversed" className="h-4 w-auto" /></Link>
          <details className="lg:hidden">
            <summary className="eyebrow list-none !text-stone">Menu</summary>
            <div className="absolute inset-x-0 z-50 mt-4 bg-espresso px-4 pb-6"><AdminNav /></div>
          </details>
        </div>
        <div className="mt-8 hidden lg:block"><AdminNav /></div>
        <div className="mt-10 hidden space-y-3 px-3 text-[12px] text-mushroom lg:block">
          <p className="truncate">{admin.label}</p>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-ivory">View site</Link>
            <form action={signOut}><button className="hover:text-ivory">Sign out</button></form>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        {dev && (
          <div className="border-b border-warn/30 bg-cream px-6 py-2 text-[12px] text-taupe-ink">
            Development data store (<span className="font-mono">.data/dev-db.json</span>). Edits persist locally only. Not suitable for real orders, payments or bidding.
          </div>
        )}
        <div className="mx-auto max-w-[1280px] px-5 py-8 md:px-8">{children}</div>
      </div>
    </div>
  );
}
