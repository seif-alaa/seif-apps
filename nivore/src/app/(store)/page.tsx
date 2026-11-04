import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { IndexNumeral, MinuteTrack, Monogram } from "@/components/brand/Brand";
import { LayerStack } from "@/components/builder/stack";
import { TrustStrip } from "@/components/layout/TrustStrip";
import { DialTeaser } from "@/components/home/DialTeaser";
import { PREVIEW_CAPTION, ProductCard, ProductGrid } from "@/components/shop/ProductCard";
import { repos } from "@/data/repositories";
import { auctionStatus, minimumNextBid, PUBLIC_STATUS_LABEL } from "@/domain/auction";
import { formatEGP } from "@/domain/money";
import { decodeBuild, defaultBuild, encodeBuild, layersOf } from "@/lib/parts";
import { getContent, getVisibleProducts } from "@/server/catalog";
import { getPartsCatalog } from "@/server/parts";

const SWATCH: Record<string, string> = { black: "#1d1b1a", silver: "#c9c9c9", emerald: "#1f6b4a", navy: "#1c2a50" };

export const metadata: Metadata = {
  title: { absolute: "NIVORÉ Timepieces — Independent custom automatic watches, Egypt" },
  description: "Build your own automatic watch part by part, or choose a finished NIVORÉ piece. Assembled by hand in Egypt. Independent, not affiliated with Seiko.",
  openGraph: { title: "NIVORÉ Timepieces", description: "Custom automatic watches, assembled by hand in Egypt.", images: [{ url: "/products/product_1_diver.webp", width: 1122, height: 1402, alt: "A NIVORÉ watch on the atelier bench" }] },
};

export default async function HomePage() {
  const [content, products] = await Promise.all([getContent(), getVisibleProducts()]);
  const parts = getPartsCatalog();
  const featured = content.featuredProductIds.map((id) => products.find((p) => p.id === id)).filter((p) => p != null).slice(0, 3);
  const photos = products.flatMap((p) => p.images);

  // Builder teaser: the first live family with each of its dials, rendered from the real photo layers.
  const family = parts.families.find((f) => f.live);
  const teaser = family
    ? family.dial.map((id) => {
        const b = { ...defaultBuild(family), dial: id };
        const colour = parts.parts[id].label.split(" · ").pop() ?? "";
        return {
          id,
          label: colour.charAt(0).toUpperCase() + colour.slice(1),
          swatch: SWATCH[colour.toLowerCase()] ?? "#8a8178",
          query: `b=${encodeBuild(b)}`,
          node: <LayerStack layers={layersOf(parts, b)} alt={`${family.name} with a ${colour} dial, illustrative`} className="h-full w-full" />,
        };
      })
    : [];

  const auctions = await repos().auctions.list();
  const auction = auctions.find((a) => a.id === content.featuredAuctionId && a.published && !a.archived);
  const now = new Date();
  const auctionBuild = decodeBuild(parts, auction?.previewBuild);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-cream">
        <div className="mx-auto grid max-w-[1440px] items-center gap-6 px-5 pb-14 pt-10 md:px-10 lg:min-h-[calc(100dvh-6.5rem)] lg:grid-cols-[1.05fr_1fr] lg:py-10">
          <div className="order-2 lg:order-1">
            <p className="eyebrow animate-fade-up">{content.hero.eyebrow}</p>
            <h1 className="display mt-5 text-[3.4rem] leading-[0.98] sm:text-[4.5rem] lg:text-[6.6rem]">{content.hero.headline}</h1>
            <p className="mt-6 max-w-md text-[16px] leading-relaxed text-taupe-ink">{content.hero.body}</p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
              <Link href="/build" className="btn btn-primary">
                Build your watch
              </Link>
              <Link href="/timepieces" className="eyebrow link-underline self-start !text-espresso sm:self-auto">
                Explore timepieces
              </Link>
              <Link href="/rare-pieces" className="eyebrow link-underline self-start !text-espresso sm:self-auto">
                Discover rare pieces
              </Link>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            {content.hero.image && (
              <>
                <div className="relative mx-auto aspect-[4/5] w-full max-w-[560px]">
                  <Image src={content.hero.image} alt={content.hero.imageAlt} fill priority sizes="(min-width: 1024px) 45vw, 90vw" className="object-cover" />
                </div>
                <p className="mx-auto mt-2 max-w-[560px] text-[11px] tracking-[0.04em] text-taupe-ink">{PREVIEW_CAPTION}</p>
              </>
            )}
          </div>
        </div>
        <MinuteTrack className="block h-3 w-full text-taupe/60" count={140} />
      </section>
      <TrustStrip />

      {/* ── Introduction ─────────────────────────────────────── */}
      <section className="mx-auto grid max-w-[1440px] gap-12 px-5 py-24 md:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:py-32">
        {photos[0] && (
          <div className="relative aspect-[3/4] w-full max-w-md overflow-hidden bg-cream">
            <Image src={photos[0].src} alt={photos[0].alt} fill sizes="(min-width: 1024px) 30vw, 90vw" className="object-cover" />
          </div>
        )}
        <div className="lg:pt-10">
          <h2 className="display max-w-2xl text-[2.6rem] md:text-[3.6rem]">{content.intro.headline}</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <p className="text-[15px] leading-relaxed">{content.intro.body}</p>
            <p className="text-[15px] leading-relaxed text-taupe-ink">{content.intro.body2}</p>
          </div>
          <Link href="/atelier" className="eyebrow link-underline mt-10 inline-block !text-espresso">
            About the atelier
          </Link>
        </div>
      </section>

      {/* ── Featured builds ──────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-5 md:px-10">
        <div className="flex items-end justify-between border-b border-line pb-5">
          <h2 className="display text-[2.2rem] md:text-[2.8rem]">Collection 01</h2>
          <Link href="/timepieces" className="eyebrow link-underline !text-espresso">
            All timepieces
          </Link>
        </div>
        <div className="mt-10">
          <ProductGrid>
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 3} />
            ))}
          </ProductGrid>
        </div>
      </section>

      {/* ── Builder teaser ───────────────────────────────────── */}
      {teaser.length > 1 && (
        <section className="mt-28 bg-cream">
          <div className="mx-auto max-w-[1200px] px-5 py-20 md:px-10 lg:py-28">
            <DialTeaser variants={teaser} />
          </div>
        </section>
      )}

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 lg:py-32">
        <p className="eyebrow">How a NIVORÉ is composed</p>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {content.process.map((s, i) => (
            <li key={s.title} className="border-t border-espresso pt-6">
              <IndexNumeral n={i + 1} className="text-[2.6rem] text-taupe" />
              <h3 className="mt-4 text-[17px] font-medium">{s.title}</h3>
              <p className="mt-2 max-w-sm text-[14.5px] leading-relaxed text-taupe-ink">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Featured rare piece ──────────────────────────────── */}
      {auction && (
        <section className="bg-espresso text-ivory">
          <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-5 py-20 md:px-10 lg:grid-cols-2 lg:py-28">
            <div className="relative mx-auto aspect-square w-[78%] max-w-[420px]">
              {auctionBuild && <LayerStack layers={layersOf(parts, auctionBuild)} alt={`${auction!.title}, illustrative rendering`} className="h-full w-full" />}
            </div>
            <div>
              <p className="eyebrow !text-stone">Rare pieces · {PUBLIC_STATUS_LABEL[auctionStatus(auction, now)]}</p>
              <h2 className="display mt-4 text-[2.8rem] md:text-[3.8rem]">{auction.title}</h2>
              <p className="serif mt-2 text-xl font-light italic text-stone">{auction.subtitle}</p>
              <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-stone">{auction.description}</p>
              <dl className="mt-8 grid max-w-md grid-cols-2 gap-6 border-t border-cocoa pt-6 text-sm">
                <div>
                  <dt className="eyebrow !text-mushroom">{auction.bidCount ? "Current bid" : "Starting bid"}</dt>
                  <dd className="tabular mt-1 text-lg">{formatEGP(auction.bidCount ? auction.currentBidMinor : minimumNextBid(auction))}</dd>
                </div>
                <div>
                  <dt className="eyebrow !text-mushroom">Closes</dt>
                  <dd className="mt-1 text-lg">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Cairo" }).format(new Date(auction.closesAt))}</dd>
                </div>
              </dl>
              {auction.mode === "demonstration" && <p className="mt-6 text-[12px] text-mushroom">This room is a demonstration. Bids placed here are not binding and are clearly marked.</p>}
              <Link href={`/rare-pieces/${auction.slug}`} className="btn mt-8 border-ivory text-ivory hover:bg-ivory hover:text-espresso">
                Enter the private room
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Craft ────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-[1440px] gap-14 px-5 py-24 md:px-10 lg:grid-cols-[1.2fr_0.8fr] lg:py-32">
        <div>
          <p className="eyebrow">{content.craft.eyebrow}</p>
          <h2 className="display mt-4 max-w-2xl text-[2.6rem] md:text-[3.4rem]">{content.craft.headline}</h2>
          <dl className="mt-12 space-y-8">
            {content.craft.points.map((pt, i) => (
              <div key={pt.title} className="grid grid-cols-[3rem_1fr] gap-4 border-t border-line pt-5">
                <dt className="serif text-taupe tabular">0{i + 1}</dt>
                <dd>
                  <p className="text-[16px] font-medium">{pt.title}</p>
                  <p className="mt-1.5 max-w-lg text-[14.5px] leading-relaxed text-taupe-ink">{pt.body}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {photos[2] && (
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-cream">
            <Image src={photos[2].src} alt={photos[2].alt} fill sizes="(min-width: 1024px) 35vw, 90vw" className="origin-[50%_54%] scale-[1.9] object-cover" />
          </div>
        )}
      </section>

      {/* ── Packaging ────────────────────────────────────────── */}
      <section className="bg-stone/45">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center md:px-10 lg:py-24">
          <Monogram size={46} className="mx-auto text-taupe" />
          <h2 className="display mt-6 text-[2.4rem] md:text-[3rem]">{content.packaging.headline}</h2>
          <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-taupe-ink">{content.packaging.body}</p>
          <p className="serif mt-6 text-lg italic">Handle with care. Open slowly.</p>
        </div>
      </section>

      {/* ── Ordering ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-5 pt-24 md:px-10 lg:pt-32">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <h2 className="display text-[2.4rem] md:text-[3rem]">Ordering, plainly.</h2>
          <Link href="/faq" className="eyebrow link-underline self-start !text-espresso md:self-auto">
            Questions
          </Link>
        </div>
        <ol className="mt-10 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {content.ordering.map((s, i) => (
            <li key={s.title} className="bg-ivory p-6 lg:p-8">
              <span className="serif text-taupe tabular">N° 0{i + 1}</span>
              <h3 className="mt-6 text-[16px] font-medium">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-taupe-ink">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
