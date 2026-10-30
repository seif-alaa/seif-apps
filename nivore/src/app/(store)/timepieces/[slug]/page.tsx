import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MinuteTrack } from "@/components/brand/Brand";
import { AddToBag } from "@/components/shop/AddToBag";
import { ProductCard } from "@/components/shop/ProductCard";
import { buildLayers, StaticWatch } from "@/components/watch/layers";
import { formatEGP } from "@/domain/money";
import { getEngine, getPublicCatalog, getSettings, getStorefront, getVisibleProducts } from "@/server/catalog";
import { disclosure, productView } from "@/server/views";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const p = (await getVisibleProducts()).find((x) => x.slug === slug);
  return p ? { title: p.seo.title || `${p.name} · ${p.dialLabel}`, description: p.seo.description || p.subtitle } : {};
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [products, engine, catalog, settings, storefront] = await Promise.all([getVisibleProducts(), getEngine(), getPublicCatalog(), getSettings(), getStorefront()]);
  const p = products.find((x) => x.slug === slug);
  if (!p) notFound();
  const v = productView(p, engine);
  const related = products.filter((x) => x.id !== p.id && x.collectionIds.some((c) => p.collectionIds.includes(c))).slice(0, 3);
  const title = `${p.name} · ${p.dialLabel}`;

  return (
    <div className="mx-auto max-w-[1440px] px-5 pt-8 md:px-10 md:pt-12">
      <nav aria-label="Breadcrumb" className="eyebrow mb-6">
        <Link href="/timepieces" className="hover:text-espresso">Timepieces</Link> <span aria-hidden="true">/</span> {p.name}
      </nav>
      <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
        {/* Gallery: real photography first; illustrative front and back otherwise. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:sticky lg:top-24 lg:self-start">
          {p.images.length ? (
            p.images.map((img, i) => (
              <div key={img.src} className={`relative bg-cream ${i === 0 ? "aspect-[4/5] sm:col-span-2" : "aspect-square"}`}>
                <Image src={img.src} alt={img.alt} fill priority={i === 0} sizes={i === 0 ? "(min-width:1024px) 55vw, 100vw" : "(min-width:1024px) 27vw, 50vw"} className="object-cover" />
              </div>
            ))
          ) : (
            <>
              <div className="relative aspect-[4/5] bg-cream sm:col-span-2">
                <div className="absolute inset-[5%]">
                  <StaticWatch layers={buildLayers(v.build, "front", catalog.assets)} idPrefix="pdp-f" className="h-full w-full" title={`${title}, front, illustrative rendering`} />
                </div>
              </div>
              <div className="relative aspect-square bg-cream">
                <div className="absolute inset-[6%]">
                  <StaticWatch layers={buildLayers(v.build, "rear", catalog.assets)} idPrefix="pdp-r" className="h-full w-full" title={`${title}, back, illustrative rendering`} />
                </div>
              </div>
              <div className="photo-placeholder relative flex aspect-square items-end p-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-taupe-ink">Photo — on the wrist, soft daylight</span>
              </div>
              <p className="text-[11px] tracking-[0.04em] text-taupe-ink sm:col-span-2">
                Illustrations are drawn from each part&rsquo;s recorded dimensions. Photography of this piece will replace them.
              </p>
            </>
          )}
        </div>

        <div className="lg:pt-4">
          <p className="eyebrow">Atelier · {settings.business.displayName.split(" ")[0]}</p>
          <h1 className="mt-3">
            <span className="collection-title text-[1.6rem] md:text-[2rem]">{p.name}</span>
            <span className="display ml-3 text-[1.9rem] text-taupe md:text-[2.3rem]">{p.dialLabel}</span>
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-taupe-ink">{p.subtitle}</p>
          <p className="tabular mt-6 text-[1.5rem]">
            {formatEGP(p.priceMinor)}
            {p.compareAtMinor && p.compareAtMinor > p.priceMinor && <span className="ml-3 text-base text-taupe-ink line-through">{formatEGP(p.compareAtMinor)}</span>}
          </p>
          <p className="mt-1 text-[12.5px] text-taupe-ink">
            {v.available ? (p.stockQuantity === 1 ? "One available · assembled and ready" : "Available · assembled and ready") : "This piece has been sold."}
          </p>
          <div className="mt-7 grid gap-3">
            <AddToBag productId={p.id} name={title} detail={p.subtitle} priceMinor={p.priceMinor} available={v.available && storefront.checkoutOpen} maxQuantity={Math.min(p.maxPerOrder, p.stockQuantity)} />
            {p.allowCustomization && (
              <Link href={`/build?from=${p.slug}`} className="btn btn-outline w-full">
                Make it your own
              </Link>
            )}
          </div>
          {!storefront.checkoutOpen && <p className="mt-3 text-[12.5px] text-taupe-ink">{settings.storefront.checkoutLockedMessage}</p>}

          <MinuteTrack className="mt-10 h-3 w-full text-taupe/60" />
          <p className="mt-8 text-[15px] leading-relaxed">{p.description}</p>

          <h2 className="eyebrow mt-10">Specifications</h2>
          <dl className="mt-3 divide-y divide-line border-y border-line text-[13.5px]">
            {v.specs.map((s) => (
              <div key={s.label} className="grid grid-cols-[8.5rem_1fr] gap-4 py-3">
                <dt className="text-taupe-ink">{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 bg-cream p-4 text-[12.5px] leading-relaxed text-taupe-ink">{disclosure(v.build)}</p>

          <div className="mt-8 divide-y divide-line border-y border-line">
            {[
              ["Care", "Wear it often; an automatic movement winds as you move. Unless your documentation states otherwise, keep it away from water. Avoid strong magnetic fields and hard knocks. Have it serviced by a qualified watchmaker.", "/info/care"],
              ["Ordering & payment", "Cash on delivery or InstaPay transfer, confirmed by the atelier by hand. No account needed.", "/faq"],
              ["Delivery & returns", "Delivery across Egypt. Our delivery and returns terms are published on their own pages.", "/info/shipping"],
            ].map(([t, body, href]) => (
              <details key={t} className="group py-4">
                <summary className="flex list-none items-center justify-between text-[14px]">
                  {t}
                  <span className="text-taupe transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 text-[13.5px] leading-relaxed text-taupe-ink">
                  {body}{" "}
                  <Link href={href} className="underline underline-offset-4">Read more</Link>
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-28">
          <h2 className="display border-b border-line pb-5 text-[2.2rem]">Related compositions</h2>
          <ul className="mt-10 grid gap-x-6 gap-y-12 xs:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => {
              const rv = productView(r, engine);
              return (
                <li key={r.id}>
                  <ProductCard product={r} build={rv.build} caliber={rv.caliber} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
