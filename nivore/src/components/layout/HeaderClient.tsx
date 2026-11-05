"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { bagCount, useBag } from "@/lib/cart";
import { cn } from "@/lib/cn";

export function BagLink({ className }: { className?: string }) {
  const items = useBag((s) => s.items);
  const hydrated = useBag((s) => s.hydrated);
  const hydrate = useBag((s) => s.hydrate);
  useEffect(() => hydrate(), [hydrate]);
  const n = hydrated ? bagCount(items) : 0;
  return (
    <Link href="/bag" className={cn("eyebrow !text-espresso hover:!text-taupe", className)} aria-label={`Shopping bag, ${n} ${n === 1 ? "item" : "items"}`}>
      Bag <span className="tabular">({n})</span>
    </Link>
  );
}

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = path === href || (href !== "/" && path.startsWith(href));
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn("eyebrow !text-espresso transition-colors hover:!text-taupe", active && "underline decoration-1 underline-offset-[6px]")}>
      {children}
    </Link>
  );
}

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      buttonRef.current?.focus();
    };
  }, [open]);
  return (
    <>
      <button ref={buttonRef} type="button" className="eyebrow -ml-2 min-h-11 px-2 !text-espresso lg:hidden" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)}>
        Menu
      </button>
      {open && (
        <div id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 bg-ivory lg:hidden" style={{ animation: "scrim-in 200ms ease both" }}>
          <div className="flex h-16 items-center justify-between px-5">
            <span className="eyebrow">Menu</span>
            <button type="button" className="eyebrow min-h-11 px-2 !text-espresso" onClick={() => setOpen(false)} autoFocus>
              Close
            </button>
          </div>
          <nav className="px-5 pt-6" aria-label="Main">
            <ul className="divide-y divide-line border-y border-line">
              {links.map((l, i) => (
                <li key={l.href} style={{ animation: `fade-up 420ms var(--ease-settle) ${60 + i * 40}ms both` }}>
                  <Link href={l.href} className="flex min-h-16 items-center justify-between py-3">
                    <span className="display text-[2rem]">{l.label}</span>
                    <span className="eyebrow">{String(i + 1).padStart(2, "0")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
