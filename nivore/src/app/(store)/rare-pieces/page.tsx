import type { Metadata } from "next";
import Link from "next/link";
import { Monogram } from "@/components/brand/Brand";
import { repos } from "@/data/repositories";
import { auctionStatus, minimumNextBid, PUBLIC_STATUS_LABEL } from "@/domain/auction";
import { decodeConfiguration, encodeConfiguration } from "@/domain/configuration";
import { formatEGP } from "@/domain/money";
import { getPublicCatalog } from "@/server/catalog";

export const metadata: Metadata = { title: "Rare pieces", description: "One-of-one watches from the NIVORÉ atelier, offered in a private auction room." };

export default async function RarePiecesPage() {
  const [all, catalog] = await Promise.all([repos().auctions.list(), getPublicCatalog()]);
  const now = new Date();
  const auctions = all.filter((a) => a.published && !a.archived).sort((a, b) => a.closesAt.localeCompare(b.closesAt));
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(new Date(iso));
  return (
    <>
      <section className="bg-espresso text-ivory">
        <div className="mx-auto max-w-[1440px] px-5 py-20 md:px-10 lg:py-28">
          <Monogram size={44} className="text-champagne" />
          <p className="eyebrow mt-8 !text-stone">Rare pieces</p>
          <h1 className="display mt-3 text-[3.2rem] md:text-[5rem]">The private auction.</h1>
          <p className="mt-6 max-w-xl text-[15.5px] leading-relaxed text-stone">Occasionally the atelier composes a piece that will not be repeated. These are offered here, one at a time, to whoever values them most. No noise, no countdown pressure beyond the closing time itself.</p>
          <p className="mt-6 text-[12.5px] text-mushroom">This room currently runs in demonstration mode: you can try bidding, and every bid is clearly marked as a non-binding demonstration.</p>
        </div>
      </section>
      <div className="mx-auto max-w-[1440px] px-5 md:px-10">
        {auctions.length === 0 && <p className="py-20 text-center text-taupe-ink">No pieces are offered at the moment.</p>}
        <ul className="divide-y divide-line">
          {auctions.map((a, i) => {
            const cfg = a.previewBuild ? decodeConfiguration(new URLSearchParams(a.previewBuild), catalog.components) : null;
            const st = auctionStatus(a, now);
            return (
              <li key={a.id} className="grid gap-10 py-16 md:grid-cols-[0.8fr_1.2fr] md:items-center">
                <Link href={`/rare-pieces/${a.slug}`} className="relative mx-auto block aspect-[600/860] w-[70%] max-w-[340px] bg-cream">
                  {/* eslint-disable-next-line @next/next/no-img-element -- cacheable vector render */}
                  {cfg && <img src={`/api/render?${encodeConfiguration(cfg, catalog.components).toString()}`} alt={`${a.title}, illustrative`} width={600} height={860} loading={i ? "lazy" : "eager"} className="absolute inset-[4%] h-[92%] w-[92%]" />}
                </Link>
                <div>
                  <p className="eyebrow">{PUBLIC_STATUS_LABEL[st]}</p>
                  <h2 className="display mt-2 text-[2.4rem] md:text-[3.2rem]">{a.title}</h2>
                  <p className="serif text-lg italic text-taupe">{a.subtitle}</p>
                  <dl className="mt-6 grid max-w-lg grid-cols-2 gap-4 text-[13.5px]">
                    <div><dt className="eyebrow">{a.bidCount ? "Highest bid" : "Starting bid"}</dt><dd className="tabular mt-1">{formatEGP(a.bidCount ? a.currentBidMinor : minimumNextBid(a))}</dd></div>
                    <div><dt className="eyebrow">{st === "upcoming" ? "Opens" : "Closes"}</dt><dd className="mt-1">{fmt(st === "upcoming" ? a.opensAt : a.closesAt)}</dd></div>
                  </dl>
                  <Link href={`/rare-pieces/${a.slug}`} className="btn btn-outline mt-8">View the piece</Link>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
