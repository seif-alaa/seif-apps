import Link from "next/link";
import { Wordmark } from "@/components/brand/Brand";
import { BagLink } from "@/components/layout/HeaderClient";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-ivory">
      <header className="flex h-[3.25rem] shrink-0 items-center justify-between border-b border-line px-5 md:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Leave the builder and return to NIVORÉ">
          <span aria-hidden="true" className="text-taupe">
            ←
          </span>
          <Wordmark secondary className="h-4 w-auto" />
        </Link>
        <p className="eyebrow hidden md:block">Build your watch</p>
        <div className="flex items-center gap-6">
          <Link href="/saved" className="eyebrow !text-espresso hover:!text-taupe">
            Saved
          </Link>
          <BagLink />
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
