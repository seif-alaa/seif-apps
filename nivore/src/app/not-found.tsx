import Link from "next/link";
import { MinuteTrack } from "@/components/brand/Brand";

export const metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-center justify-center px-5 text-center">
      <p className="eyebrow">Error 404</p>
      <h1 className="display mt-4 text-[2.8rem] leading-tight md:text-[3.6rem]">This page is not on the dial.</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-taupe-ink">The address may have changed, or the piece is no longer available.</p>
      <MinuteTrack className="mt-8 h-3 w-48 text-taupe/60" count={40} />
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">Back to the home page</Link>
        <Link href="/timepieces" className="btn btn-outline">See the timepieces</Link>
      </div>
    </main>
  );
}
