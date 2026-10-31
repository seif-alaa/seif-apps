import Link from "next/link";
import Image from "next/image";
import { formatEGP } from "@/domain/money";
import type { Product } from "@/domain/models";

/**
 * Catalogue card. Real photography when uploaded; otherwise an illustrative
 * SVG from /api/render, loaded as a cacheable image (keeps HTML small).
 */
export function ProductCard({ product, query, priority = false, caliber }: { product: Product; query: string; priority?: boolean; caliber?: string }) {
  const photo = product.images[0];
  const soldOut = product.soldOut || product.stockQuantity < 1;
  return (
    <Link href={`/timepieces/${product.slug}`} className="group block" data-testid={`product-${product.slug}`}>
      <div className="relative aspect-[4/5] overflow-hidden bg-cream transition-colors duration-500 group-hover:bg-[#e3dccf]">
        {photo ? (
          <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw" className="object-cover" priority={priority} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- vector render; next/image adds nothing for SVG
          <img
            src={`/api/render?${query}`}
            alt={`${product.name} ${product.dialLabel}, illustrative rendering`}
            width={600}
            height={860}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            className="absolute inset-[4%] h-[92%] w-[92%] object-contain transition-transform duration-700 ease-[var(--ease-settle)] group-hover:scale-[1.025]"
          />
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
