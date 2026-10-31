import type { Metadata } from "next";
import { Monogram } from "@/components/brand/Brand";
import { adminCredentials } from "@/server/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Atelier sign-in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/admin" } = await searchParams;
  const creds = adminCredentials();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-5">
      <div className="w-full max-w-sm bg-ivory p-8 shadow-[0_20px_60px_-30px_rgba(58,50,46,0.5)]">
        <Monogram size={40} className="text-taupe" />
        <h1 className="display mt-6 text-[2rem]">Atelier control</h1>
        <p className="mb-8 mt-1 text-[13px] text-taupe-ink">Private. Authorised administrators only.</p>
        {creds ? <LoginForm next={next} /> : <p className="text-[13px] text-err">ADMIN_EMAIL and ADMIN_PASSWORD must be set in production.</p>}
        {creds?.isDevDefault && (
          <p className="mt-6 border border-dashed border-line p-3 text-[12px] text-taupe-ink">
            Development default: <span className="font-mono">{creds.email}</span> / <span className="font-mono">{creds.password}</span>. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local to change.
          </p>
        )}
      </div>
    </main>
  );
}
