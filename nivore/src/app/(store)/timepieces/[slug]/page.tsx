import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatEGP } from "@/domain/money";
import { MinuteTrack } from "@/components/brand/Brand";
import { AddToBag } from "@/components/shop/AddToBag";
import { PRODUCT_BUILDS } from "@/config/product-builds";
import { decodeBuild } from "@/lib/parts";
import { getPartsCatalog } from "@/server/parts";
import { PREVIEW_CAPTION, ProductCard, priceLabel } from "@/components/shop/ProductCard";
import { getSettings, getStorefront, getVisibleProducts } from "@/server/catalog";

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return (await getVisibleProducts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const p = (await getVisibleProducts()).find((x) => x.slug === slug);
  return p ? { title: p.seo.title || `${p.name} · ${p.dialLabel}`, description: p.seo.description || p.subtitle } : {};
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [products, settings, storefront] = await Promise.all([getVisibleProducts(), getSettings(), getStorefront()]);
  const p = products.find((x) => x.slug === slug);
  if (!p) notFound();
  const related = products.filter((x) => x.id !== p.id).slice(0, 3);
  const title = `${p.name}${p.dialLabel ? ` · ${p.dialLabel}` : ""}`;
  const available = !p.soldOut && p.stockQuantity > 0;
  const orderable = available && p.priceMinor > 0 && storefront.checkoutOpen;
  const preset = PRODUCT_BUILDS[p.id];
  const customizeHref = preset && decodeBuild(getPartsCatalog(), preset) ? `/build?b=${preset}` : "/build";
  const specs = [{ label: "Movement", value: p.movement }, ...p.extraSpecs, { label: "Water resistance", value: "Not rated. Unless your documentation states otherwise, keep it away from water." }];

  return (
    <div className="mx-auto max-w-[1440px] px-5 pt-8 md:px-10 md:pt-12">
      <nav aria-label="Breadcrumb" className="eyebrow mb-6">
        <Link href="/timepieces" className="hover:text-espresso">Timepieces</Link> <span aria-hidden="true">/</span> {p.name}
      </nav>
      <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
        <div className="grid gap-3 sm:grid-cols-2 lg:sticky lg:top-24 lg:self-start">
          {p.images.map((img, i) => (
            <div key={img.src} className={`relative bg-cream ${i === 0 ? "aspect-[4/5] sm:col-span-2" : "aspect-square"}`}>
              <Image src={img.src} alt={img.alt} fill priority={i === 0} sizes={i === 0 ? "(min-width:1024px) 55vw, 100vw" : "(min-width:1024px) 27vw, 50vw"} className="object-cover" />
            </div>
          ))}
          <p className="text-[11px] tracking-[0.04em] text-taupe-ink sm:col-span-2">{PREVIEW_CAPTION}</p>
        </div>

        <div className="lg:pt-4">
          <p className="eyebrow">Atelier · {settings.business.displayName.split(" ")[0]}</p>
          <h1 className="mt-3">
            <span className="collection-title text-[1.6rem] md:text-[2rem]">{p.name}</span>
            {p.dialLabel && <span className="display ml-3 text-[1.9rem] text-taupe md:text-[2.3rem]">{p.dialLabel}</span>}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-taupe-ink">{p.subtitle}</p>
          <p className="tabular mt-6 text-[1.5rem]">
            {priceLabel(p)}
            {p.priceMinor > 0 && p.compareAtMinor && p.compareAtMinor > p.priceMinor && <span className="ml-3 text-base text-taupe-ink line-through">{formatEGP(p.compareAtMinor)}</span>}
          </p>
          <p className="mt-1 text-[12.5px] text-taupe-ink">{available ? (p.stockQuantity === 1 ? "One available · assembled and ready" : "Available · assembled and ready") : "This piece has been sold."}</p>
          <div className="mt-7 grid gap-3">
            <AddToBag productId={p.id} name={title} detail={p.movement} image={p.images[0]?.src} priceMinor={p.priceMinor} available={orderable} unavailableLabel={available && p.priceMinor <= 0 ? "Price to be announced" : "Sold"} maxQuantity={Math.min(p.maxPerOrder, p.stockQuantity)} />
            <Link href={customizeHref} className="btn btn-outline" data-testid="customize-this">Customize this</Link>
          </div>
          {!storefront.checkoutOpen && <p className="mt-3 text-[12.5px] text-taupe-ink">{settings.storefront.checkoutLockedMessage}</p>}

          <MinuteTrack className="mt-10 h-3 w-full text-taupe/60" />
          <p className="mt-8 text-[15px] leading-relaxed">{p.description}</p>

          <h2 className="eyebrow mt-10">Specifications</h2>
          <dl className="mt-3 divide-y divide-line border-y border-line text-[13.5px]">
            {specs.map((s) => (
              <div key={s.label} className="grid grid-cols-[8.5rem_1fr] gap-4 py-3">
                <dt className="text-taupe-ink">{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 bg-cream p-4 text-[12.5px] leading-relaxed text-taupe-ink">Built in the NIVORÉ atelier around a third-party automatic movement and selected aftermarket components. NIVORÉ is independent and not affiliated with or endorsed by Seiko or the movement maker.</p>

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
          <h2 className="display border-b border-line pb-5 text-[2.2rem]">More from the atelier</h2>
          <ul className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-12">
            {related.map((r) => (
              <li key={r.id} className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]">
                <ProductCard product={r} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
