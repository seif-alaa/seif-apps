import Link from "next/link";
import { formatEGP } from "@/domain/money";
import type { Product } from "@/domain/models";

export const PREVIEW_CAPTION = "Preview image. Your watch is photographed before dispatch.";
export const priceLabel = (p: Pick<Product, "priceMinor">) => (p.priceMinor > 0 ? formatEGP(p.priceMinor) : "Price to be announced");

/** Catalogue card: the product photo, name, price and movement. */
export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const photo = product.images[0];
  const soldOut = product.soldOut || product.stockQuantity < 1;
  return (
    <Link href={`/timepieces/${product.slug}`} className="group block" data-testid={`product-${product.slug}`}>
      {photo && (
        <div className="relative aspect-[4/5] overflow-hidden bg-cream">
          {/* Product photos are already 4:5 WebP; object-position keeps the watch centred if a different crop is ever uploaded. */}
          <picture>
            <source type="image/webp" srcSet={photo.src} />
            {/* eslint-disable-next-line @next/next/no-img-element -- <picture> with WebP source, fixed width/height to avoid layout shift */}
            <img
              src={photo.src}
              alt={photo.alt}
              width={photo.width || 1122}
              height={photo.height || 1402}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-settle)] group-hover:scale-[1.02]"
              style={{ objectPosition: "50% 55%" }}
            />
          </picture>
          {soldOut && <span className="absolute left-3 top-3 bg-ivory px-2 py-1 text-[10px] uppercase tracking-[0.16em]">Sold</span>}
        </div>
      )}
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <p className="collection-title text-[12px]">
          {product.name}
          {product.dialLabel && <span className="font-normal normal-case tracking-normal text-taupe-ink"> · {product.dialLabel}</span>}
        </p>
        <p className="tabular shrink-0 text-[13px]">{priceLabel(product)}</p>
      </div>
      <p className="mt-0.5 text-[12px] text-taupe-ink">{product.movement}</p>
      <p className="mt-1 text-[11px] text-taupe-ink/80">{PREVIEW_CAPTION}</p>
    </Link>
  );
}

/** 1 column on phones, 2 on tablets, 3 on desktop; an incomplete last row is centred so no card sits alone at the edge. */
export function ProductGrid({ children }: { children: React.ReactNode[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-x-6 gap-y-12">
      {children.map((c, i) => (
        <li key={i} className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]">
          {c}
        </li>
      ))}
    </ul>
  );
}
