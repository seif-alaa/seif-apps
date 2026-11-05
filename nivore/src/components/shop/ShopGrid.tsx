"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ProductGrid } from "./ProductCard";

export interface ShopItem {
  id: string;
  node: ReactNode;
  name: string;
  priceMinor: number;
  featured: boolean;
  sortOrder: number;
  fn: string;
  available: boolean;
}

type Sort = "featured" | "price-asc" | "price-desc";

export function ShopGrid({ items }: { items: ShopItem[] }) {
  const [q, setQ] = useState("");
  const [fn, setFn] = useState("all");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sort, setSort] = useState<Sort>("featured");
  const functions = useMemo(() => [...new Set(items.map((i) => i.fn))], [items]);

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items
      .filter((i) => !query || i.name.toLowerCase().includes(query))
      .filter((i) => fn === "all" || i.fn === fn)
      .filter((i) => !onlyAvailable || i.available)
      .sort((a, b) => (sort === "price-asc" ? a.priceMinor - b.priceMinor : sort === "price-desc" ? b.priceMinor - a.priceMinor : Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder));
  }, [items, q, fn, onlyAvailable, sort]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 border-y border-line py-5 md:grid-cols-4">
        <label className="col-span-2 block">
          <span className="field-label">Search</span>
          <input className="field !min-h-10 !py-2 text-sm" type="search" placeholder="Name" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="block min-w-0">
          <span className="field-label">Function</span>
          <select className="field !min-h-10 !py-2 text-sm" value={fn} onChange={(e) => setFn(e.target.value)}>
            <option value="all">All</option>
            {functions.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="field-label">Sort</span>
          <select className="field !min-h-10 !py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="featured">Featured</option>
            <option value="price-asc">Price, low to high</option>
            <option value="price-desc">Price, high to low</option>
          </select>
        </label>
      </div>
      <div className="flex items-center justify-between py-4 text-[12px] text-taupe-ink">
        <span role="status">
          {shown.length} {shown.length === 1 ? "piece" : "pieces"}
        </span>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-espresso)]" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
          Available now
        </label>
      </div>
      {shown.length ? (
        <ProductGrid>{shown.map((i) => i.node)}</ProductGrid>
      ) : (
        <div className="py-20 text-center">
          <p className="display text-3xl">Nothing matches, yet.</p>
          <p className="mt-2 text-sm text-taupe-ink">Try fewer filters, or compose exactly what you have in mind.</p>
          <a href="/build" className="btn btn-outline mt-6">
            Build your watch
          </a>
        </div>
      )}
    </div>
  );
}
