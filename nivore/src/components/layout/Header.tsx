import Link from "next/link";
import { Wordmark } from "@/components/brand/Brand";
import { BagLink, MobileMenu, NavLink } from "./HeaderClient";

export const NAV = [
  { href: "/timepieces", label: "Timepieces" },
  { href: "/build", label: "Build your watch" },
  { href: "/rare-pieces", label: "Rare pieces" },
  { href: "/atelier", label: "The Atelier" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ivory/92 backdrop-blur-md supports-[backdrop-filter]:bg-ivory/80">
      <div className="mx-auto grid h-16 max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-5 md:px-10">
        <div className="flex items-center gap-7">
          <MobileMenu links={NAV} />
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
            {NAV.slice(0, 4).map((l) => (
              <NavLink key={l.href} href={l.href}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <Link href="/" aria-label="NIVORÉ Timepieces — home" className="block">
          <Wordmark secondary className="h-[18px] w-auto md:h-5" />
        </Link>
        <div className="flex items-center justify-end gap-7">
          <span className="hidden lg:inline">
            <NavLink href="/contact">Contact</NavLink>
          </span>
          <BagLink />
        </div>
      </div>
    </header>
  );
}
