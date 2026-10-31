import Link from "next/link";
import { MinuteTrack, Monogram, Wordmark } from "@/components/brand/Brand";
import type { Content, Settings } from "@/domain/settings";

const COLUMNS = [
  { title: "Atelier", links: [["Timepieces", "/timepieces"], ["Build your watch", "/build"], ["Rare pieces", "/rare-pieces"], ["The Atelier", "/atelier"], ["Saved compositions", "/saved"]] },
  { title: "Ordering", links: [["Order status", "/order-status"], ["Shipping", "/info/shipping"], ["Returns & cancellations", "/info/returns"], ["Questions", "/faq"]] },
  { title: "Care & terms", links: [["Care guide", "/info/care"], ["Privacy", "/info/privacy"], ["Terms & conditions", "/info/terms"], ["Contact & bespoke", "/contact"]] },
] as const;

export function Footer({ content, settings }: { content: Content; settings: Settings }) {
  const b = settings.business;
  return (
    <footer className="mt-24 bg-cream text-espresso">
      <div className="mx-auto max-w-[1440px] px-5 pt-14 md:px-10">
        <MinuteTrack className="h-4 w-full text-taupe" count={96} />
        <div className="grid gap-12 py-14 md:grid-cols-[1.3fr_repeat(3,1fr)]">
          <div className="space-y-6">
            <Wordmark className="h-14 w-auto" />
            <p className="serif text-2xl font-light italic">{content.footer.tagline}</p>
            <p className="max-w-xs text-sm text-taupe-ink">
              {b.city}
              {b.email && (
                <>
                  <br />
                  <a className="link-underline" href={`mailto:${b.email}`}>
                    {b.email}
                  </a>
                </>
              )}
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="eyebrow mb-4">{col.title}</h2>
              <ul className="space-y-2.5 text-sm">
                {col.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="hover:text-taupe">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-6 border-t border-line py-8 md:flex-row md:items-end md:justify-between">
          <p className="max-w-3xl text-xs leading-relaxed text-taupe-ink">{content.footer.disclosure}</p>
          <div className="flex items-center gap-4 text-taupe">
            <span className="text-xs text-taupe-ink">© {new Date().getFullYear()} {b.displayName}</span>
            <Monogram size={34} />
          </div>
        </div>
      </div>
    </footer>
  );
}
