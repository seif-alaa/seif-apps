import Link from "next/link";
import Image from "next/image";
import { IndexNumeral, MinuteTrack, Monogram, PhotoPlaceholder } from "@/components/brand/Brand";
import { DialTeaser } from "@/components/home/DialTeaser";
import { ProductCard } from "@/components/shop/ProductCard";
import { resolveBuild } from "@/components/watch/geometry";
import { buildLayers, StaticWatch } from "@/components/watch/layers";
import { repos } from "@/data/repositories";
import { auctionStatus, minimumNextBid, PUBLIC_STATUS_LABEL } from "@/domain/auction";
import { decodeConfiguration, encodeConfiguration } from "@/domain/configuration";
import { formatEGP } from "@/domain/money";
import { getContent, getEngine, getPublicCatalog, getVisibleProducts } from "@/server/catalog";
import { productView } from "@/server/views";

export default async function HomePage() {
  const [content, products, engine, catalog] = await Promise.all([getContent(), getVisibleProducts(), getEngine(), getPublicCatalog()]);
  const featured = content.featuredProductIds.map((id) => products.find((p) => p.id === id)).filter((p) => p != null).slice(0, 3);
  const hero = featured[0] ?? products[0];
  const heroBuild = hero ? resolveBuild(hero.configuration, engine.get, engine.family) : null;

  // Builder teaser: the hero build with four alternative dials, all pre-rendered here.
  const teaserDials = ["dial-ivory-date", "dial-teal-explorer", "dial-cognac-roman", "dial-rose-linen"];
  const teaserBase = products.find((p) => p.slug === "alba-36-ivory") ?? hero;
  const teaser = teaserBase
    ? teaserDials
        .map((id) => {
          const proposal = engine.propose(teaserBase.configuration, "dial", id);
          if (proposal.blocked.length || !engine.validate(proposal.next).ok) return null;
          const b = resolveBuild(proposal.next, engine.get, engine.family);
          const d = b.dial!;
          return {
            id,
            label: d.spec.colorName,
            swatch: d.spec.colorHex,
            query: encodeConfiguration(proposal.next, catalog.components).toString(),
            // eslint-disable-next-line @next/next/no-img-element -- cacheable vector render, lazy below the fold
            node: <img src={`/api/render?${encodeConfiguration(proposal.next, catalog.components).toString()}`} alt={`${d.spec.colorName} dial, illustrative`} width={600} height={860} loading="lazy" decoding="async" className="h-full w-full" />,
          };
        })
        .filter((v) => v != null)
    : [];

  const auctions = await repos().auctions.list();
  const auction = auctions.find((a) => a.id === content.featuredAuctionId && a.published && !a.archived);
  const now = new Date();
  const auctionConfig = auction?.previewBuild ? decodeConfiguration(new URLSearchParams(auction.previewBuild), catalog.components) : null;

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
            {content.hero.image ? (
              <div className="relative mx-auto aspect-[4/5] w-full max-w-[560px]">
                <Image src={content.hero.image} alt={content.hero.imageAlt} fill priority sizes="(min-width: 1024px) 45vw, 90vw" className="object-cover" />
              </div>
            ) : (
              heroBuild && (
                <div className="relative mx-auto aspect-[600/860] w-[68%] max-w-[440px] sm:w-[52%] lg:w-[78%]">
                  <StaticWatch layers={buildLayers(heroBuild, "front", catalog.assets)} idPrefix="hero" className="h-full w-full" title={`${hero!.name} ${hero!.dialLabel}, illustrative rendering`} />
                </div>
              )
            )}
            {hero && !content.hero.image && (
              <p className="mt-2 text-center text-[11px] tracking-[0.06em] text-taupe-ink">
                <span className="collection-title">{hero.name}</span> · {hero.dialLabel} — illustrative rendering
              </p>
            )}
          </div>
        </div>
        <MinuteTrack className="block h-3 w-full text-taupe/60" count={140} />
      </section>

      {/* ── Introduction ─────────────────────────────────────── */}
      <section className="mx-auto grid max-w-[1440px] gap-12 px-5 py-24 md:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:py-32">
        <PhotoPlaceholder label="atelier bench, watch components, soft daylight" className="aspect-[3/4] w-full max-w-md" />
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
        <ul className="mt-10 grid gap-x-6 gap-y-12 xs:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} query={productView(p, engine).query} caliber={productView(p, engine).caliber} />
            </li>
          ))}
        </ul>
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
            <div className="relative mx-auto aspect-[600/860] w-[60%] max-w-[360px]">
              {auctionConfig && (
                // eslint-disable-next-line @next/next/no-img-element -- cacheable vector render, lazy below the fold
                <img src={`/api/render?${encodeConfiguration(auctionConfig, catalog.components).toString()}`} alt={`${auction.title}, illustrative rendering`} width={600} height={860} loading="lazy" decoding="async" className="h-full w-full" />
              )}
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
        <PhotoPlaceholder label="dial macro, brushed and polished case" className="aspect-[4/5] w-full" />
      </section>

      {/* ── Packaging ────────────────────────────────────────── */}
      <section className="bg-stone/45">
        <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-5 py-20 md:px-10 lg:grid-cols-2 lg:py-24">
          {content.packaging.image ? (
            <div className="relative aspect-[4/3] w-full">
              <Image src={content.packaging.image} alt="NIVORÉ presentation box" fill sizes="(min-width: 1024px) 45vw, 90vw" className="object-cover" />
            </div>
          ) : (
            <PhotoPlaceholder label="presentation box, lid ajar, ivory sleeve" className="aspect-[4/3] w-full" />
          )}
          <div>
            <Monogram size={46} className="text-taupe" />
            <h2 className="display mt-6 text-[2.4rem] md:text-[3rem]">{content.packaging.headline}</h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-taupe-ink">{content.packaging.body}</p>
            <p className="serif mt-6 text-lg italic">Handle with care. Open slowly.</p>
          </div>
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
