import Link from "next/link";
import Image from "next/image";
import { formatEGP } from "@/domain/money";
import type { Product } from "@/domain/models";
import { buildLayers, StaticWatch } from "@/components/watch/layers";
import type { ResolvedBuild } from "@/components/watch/geometry";

/** Catalogue card. Real photography when uploaded; otherwise a server-rendered illustrative SVG (no JS). */
export function ProductCard({ product, build, priority = false, caliber }: { product: Product; build: ResolvedBuild; priority?: boolean; caliber?: string }) {
  const photo = product.images[0];
  const soldOut = product.soldOut || product.stockQuantity < 1;
  return (
    <Link href={`/timepieces/${product.slug}`} className="group block" data-testid={`product-${product.slug}`}>
      <div className="relative aspect-[4/5] overflow-hidden bg-cream transition-colors duration-500 group-hover:bg-[#e3dccf]">
        {photo ? (
          <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw" className="object-cover" priority={priority} />
        ) : (
          <div className="absolute inset-[4%] transition-transform duration-700 ease-[var(--ease-settle)] group-hover:scale-[1.025]">
            <StaticWatch layers={buildLayers(build, "front", [])} idPrefix={`pc-${product.id}`} className="h-full w-full" title={`${product.name} ${product.dialLabel}, illustrative rendering`} />
          </div>
        )}
        {soldOut && <span className="absolute left-3 top-3 bg-ivory px-2 py-1 text-[10px] uppercase tracking-[0.16em]">Sold</span>}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <p>
          <span className="collection-title text-[12px]">{product.name}</span>
          <span className="text-[13px] text-taupe-ink"> · {product.dialLabel}</span>
        </p>
        <p className="tabular text-[13px]">{formatEGP(product.priceMinor)}</p>
      </div>
      {caliber && <p className="mt-0.5 text-[12px] text-taupe-ink">{caliber} automatic{product.stockQuantity === 1 && !soldOut ? " · one available" : ""}</p>}
    </Link>
  );
}
