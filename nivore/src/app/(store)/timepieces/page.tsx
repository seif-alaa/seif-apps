import type { Metadata } from "next";
import { ProductCard } from "@/components/shop/ProductCard";
import { ShopGrid, type ShopItem } from "@/components/shop/ShopGrid";
import { repos } from "@/data/repositories";
import { getContent, getEngine, getVisibleProducts } from "@/server/catalog";
import { productView } from "@/server/views";

export const metadata: Metadata = { title: "Timepieces", description: "Finished NIVORÉ compositions: custom automatic watches built in our atelier in Egypt." };

export default async function TimepiecesPage() {
  const [products, engine, content, collections] = await Promise.all([getVisibleProducts(), getEngine(), getContent(), repos().products.collections()]);
  const items: ShopItem[] = products.map((p, i) => {
    const v = productView(p, engine);
    const c = v.build.family?.complications ?? [];
    return {
      id: p.id,
      name: `${p.name} ${p.dialLabel}`,
      priceMinor: p.priceMinor,
      sizeMm: v.build.case?.spec.diameterMm ?? 0,
      featured: p.featured,
      sortOrder: p.sortOrder,
      collections: p.collectionIds,
      complication: c.includes("gmt") ? "GMT" : c.includes("day") ? "Day and date" : c.includes("date") ? "Date" : "Time only",
      band: v.build.band?.spec.kind ?? "",
      available: v.available,
      node: <ProductCard product={p} query={v.query} caliber={v.caliber} priority={i < 3} />,
    };
  });
  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-12 md:px-10 md:pt-16">
      <header className="mb-10 grid gap-6 md:grid-cols-[1fr_1fr] md:items-end">
        <h1 className="display text-[3.2rem] md:text-[4.6rem]">{content.collectionBanner.headline}</h1>
        <p className="max-w-md text-[15px] leading-relaxed text-taupe-ink md:justify-self-end">{content.collectionBanner.body}</p>
      </header>
      <ShopGrid items={items} collections={collections.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
