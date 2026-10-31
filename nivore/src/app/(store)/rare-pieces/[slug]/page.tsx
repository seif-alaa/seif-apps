import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuctionRoom } from "@/components/auction/AuctionRoom";
import { resolveBuild } from "@/components/watch/geometry";
import { buildLayers, StaticWatch } from "@/components/watch/layers";
import { repos } from "@/data/repositories";
import { auctionStatus, minimumNextBid } from "@/domain/auction";
import { decodeConfiguration } from "@/domain/configuration";
import { getEngine, getPublicCatalog, getSettings, getStorefront } from "@/server/catalog";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const a = await repos().auctions.get((await params).slug);
  return a ? { title: a.title, description: a.subtitle } : {};
}

export default async function AuctionPage({ params }: { params: Params }) {
  const { slug } = await params;
  const r = repos();
  const a = await r.auctions.get(slug);
  if (!a || !a.published) notFound();
  const [engine, catalog, settings, sf, bids] = await Promise.all([getEngine(), getPublicCatalog(), getSettings(), getStorefront(), r.auctions.bids(a.id)]);
  const now = new Date();
  const cfg = a.previewBuild ? decodeConfiguration(new URLSearchParams(a.previewBuild), catalog.components) : null;
  const terms = a.terms || settings.policies["auction-terms"].body;
  const initial = {
    status: auctionStatus(a, now),
    mode: a.mode,
    currentBidMinor: a.currentBidMinor,
    bidCount: a.bidCount,
    minimumNextMinor: minimumNextBid(a),
    opensAt: a.opensAt,
    closesAt: a.closesAt,
    version: a.version,
    serverTime: now.toISOString(),
    recent: bids.filter((b) => b.status === "accepted").slice(0, 8).map((b) => ({ label: b.bidderLabel, amountMinor: b.amountMinor, at: b.placedAt, demonstration: b.demonstration })),
  };
  return (
    <div className="mx-auto max-w-[1440px] px-5 pt-8 md:px-10 md:pt-12">
      <nav aria-label="Breadcrumb" className="eyebrow mb-6"><Link href="/rare-pieces">Rare pieces</Link> / {a.title}</nav>
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="relative aspect-[4/5] bg-cream">
            {cfg && <StaticWatch layers={buildLayers(resolveBuild(cfg, engine.get, engine.family), "front", catalog.assets)} idPrefix="ap" className="absolute inset-[5%] h-[90%] w-[90%]" title={`${a.title}, illustrative`} />}
          </div>
          <p className="mt-2 text-[11px] text-taupe-ink">Illustrative rendering until the piece is photographed.</p>
        </div>
        <div>
          <h1 className="display text-[2.8rem] md:text-[3.8rem]">{a.title}</h1>
          <p className="serif text-xl italic text-taupe">{a.subtitle}</p>
          <p className="mt-6 text-[15px] leading-relaxed">{a.description}</p>
          <div className="mt-10"><AuctionRoom id={a.id} initial={initial} incrementMinor={a.incrementMinor} biddingOpen={sf.biddingOpen} /></div>
          <h2 className="eyebrow mt-12">Composition</h2>
          <dl className="mt-3 divide-y divide-line border-y border-line text-[13.5px]">
            {a.specs.map((s) => (
              <div key={s.label} className="grid grid-cols-[8rem_1fr] gap-4 py-3"><dt className="text-taupe-ink">{s.label}</dt><dd>{s.value}</dd></div>
            ))}
          </dl>
          <details className="mt-8 border-b border-line pb-4">
            <summary className="cursor-pointer text-[14px]">Auction terms</summary>
            <div className="mt-3 text-[13.5px] leading-relaxed text-taupe-ink">
              {terms ? terms.split(/\n{2,}/).map((p, i) => <p key={i} className="mt-2">{p}</p>) : <p>Final auction terms are being written by the atelier and will be published before any live bidding opens. In demonstration mode nothing is binding.</p>}
              <p className="mt-3">Winning bidders receive payment instructions directly; payment is confirmed by the atelier by hand. Bids close at the published time, extended by {a.antiSnipe.extendMinutes} minutes if a bid arrives in the final {a.antiSnipe.windowMinutes} minutes.</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
