"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const GROUPS = [
  { title: "Operate", items: [["Overview", "/admin"], ["Orders", "/admin/orders"], ["Customers", "/admin/customers"], ["Inquiries", "/admin/inquiries"], ["Auctions", "/admin/auctions"], ["Analytics", "/admin/analytics"]] },
  { title: "Catalogue", items: [["Products", "/admin/products"], ["Components", "/admin/components"], ["Preview assets", "/admin/assets"], ["Compatibility", "/admin/compatibility"], ["Pricing", "/admin/pricing"]] },
  { title: "Website", items: [["Storefront & launch", "/admin/storefront"], ["Content", "/admin/content"], ["Settings", "/admin/settings"], ["Audit log", "/admin/audit"]] },
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="space-y-7">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="eyebrow mb-2 !text-mushroom">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map(([label, href]) => {
              const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
              return (
                <li key={href}>
                  <Link href={href} aria-current={active ? "page" : undefined} className={cn("block px-3 py-1.5 text-[13.5px] transition-colors", active ? "bg-cocoa text-ivory" : "text-stone hover:text-ivory")}>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
