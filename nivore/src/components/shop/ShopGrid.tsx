"use client";

import { useMemo, useState, type ReactNode } from "react";

export interface ShopItem {
  id: string;
  node: ReactNode;
  name: string;
  priceMinor: number;
  sizeMm: number;
  featured: boolean;
  sortOrder: number;
  collections: string[];
  complication: string;
  band: string;
  available: boolean;
}

type Sort = "featured" | "price-asc" | "price-desc" | "size";

export function ShopGrid({ items, collections }: { items: ShopItem[]; collections: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [col, setCol] = useState("all");
  const [size, setSize] = useState("all");
  const [comp, setComp] = useState("all");
  const [band, setBand] = useState("all");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sort, setSort] = useState<Sort>("featured");

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items
      .filter((i) => !query || i.name.toLowerCase().includes(query))
      .filter((i) => col === "all" || i.collections.includes(col))
      .filter((i) => size === "all" || (size === "small" ? i.sizeMm <= 36 : size === "medium" ? i.sizeMm > 36 && i.sizeMm < 40 : i.sizeMm >= 40))
      .filter((i) => comp === "all" || i.complication === comp)
      .filter((i) => band === "all" || i.band === band)
      .filter((i) => !onlyAvailable || i.available)
      .sort((a, b) =>
        sort === "price-asc" ? a.priceMinor - b.priceMinor : sort === "price-desc" ? b.priceMinor - a.priceMinor : sort === "size" ? a.sizeMm - b.sizeMm : Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder,
      );
  }, [items, q, col, size, comp, band, onlyAvailable, sort]);

  const select = (label: string, value: string, set: (v: string) => void, options: [string, string][]) => (
    <label className="block min-w-0">
      <span className="field-label">{label}</span>
      <select className="field !min-h-10 !py-2 text-sm" value={value} onChange={(e) => set(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 border-y border-line py-5 md:grid-cols-4 lg:grid-cols-7">
        <label className="col-span-2 block lg:col-span-2">
          <span className="field-label">Search</span>
          <input className="field !min-h-10 !py-2 text-sm" type="search" placeholder="Name or dial" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {select("Collection", col, setCol, [["all", "All"], ...collections.map((c) => [c.id, c.name] as [string, string])])}
        {select("Case size", size, setSize, [["all", "All sizes"], ["small", "Up to 36 mm"], ["medium", "37–39 mm"], ["large", "40 mm and up"]])}
        {select("Function", comp, setComp, [["all", "All"], ["Time only", "Time only"], ["Date", "Date"], ["Day and date", "Day and date"], ["GMT", "GMT"]])}
        {select("Worn on", band, setBand, [["all", "All"], ["bracelet", "Steel bracelet"], ["leather", "Leather"], ["rubber", "Rubber"], ["fabric", "Fabric"]])}
        {select("Sort", sort, (v) => setSort(v as Sort), [["featured", "Featured"], ["price-asc", "Price, low to high"], ["price-desc", "Price, high to low"], ["size", "Size, small to large"]])}
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
        <ul className="grid grid-cols-1 gap-x-6 gap-y-12 xs:grid-cols-2 lg:grid-cols-3">
          {shown.map((i) => (
            <li key={i.id}>{i.node}</li>
          ))}
        </ul>
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
