import type { Metadata } from "next";
import { ProductCard } from "@/components/shop/ProductCard";
import { ShopGrid, type ShopItem } from "@/components/shop/ShopGrid";
import { getContent, getVisibleProducts } from "@/server/catalog";

export const metadata: Metadata = { title: "Timepieces", description: "Finished NIVORÉ Seiko-mod watches: custom automatic builds from our atelier in Egypt." };

const fnOf = (movement: string) => (/gmt/i.test(movement) ? "GMT" : /chrono/i.test(movement) ? "Chronograph" : "Date");

export default async function TimepiecesPage() {
  const [products, content] = await Promise.all([getVisibleProducts(), getContent()]);
  const items: ShopItem[] = products.map((p, i) => ({
    id: p.id,
    name: `${p.name} ${p.dialLabel}`,
    priceMinor: p.priceMinor,
    featured: p.featured,
    sortOrder: p.sortOrder,
    fn: fnOf(p.movement),
    available: !p.soldOut && p.stockQuantity > 0,
    node: <ProductCard product={p} priority={i < 3} />,
  }));
  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-12 md:px-10 md:pt-16">
      <header className="mb-10 grid gap-6 md:grid-cols-[1fr_1fr] md:items-end">
        <h1 className="display text-[3.2rem] md:text-[4.6rem]">{content.collectionBanner.headline}</h1>
        <p className="max-w-md text-[15px] leading-relaxed text-taupe-ink md:justify-self-end">{content.collectionBanner.body}</p>
      </header>
      <ShopGrid items={items} />
    </div>
  );
}
