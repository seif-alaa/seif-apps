import type { Metadata } from "next";
import Link from "next/link";
import { MinuteTrack, Monogram, PhotoPlaceholder } from "@/components/brand/Brand";
import { getContent } from "@/server/catalog";

export const metadata: Metadata = { title: "The Atelier", description: "An independent watch atelier in Egypt, composing automatic watches one at a time." };

export default async function AtelierPage() {
  const c = await getContent();
  return (
    <>
      <section className="bg-espresso text-ivory">
        <div className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 lg:py-36">
          <p className="eyebrow !text-stone">The Atelier</p>
          <h1 className="display mt-6 max-w-4xl text-[3rem] md:text-[5rem]">{c.atelier.headline}</h1>
          <p className="serif mt-10 text-2xl font-light italic text-champagne">Defined by Detail.</p>
        </div>
      </section>
      <section className="mx-auto grid max-w-[1440px] gap-14 px-5 py-24 md:px-10 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6 text-[17px] leading-[1.75]">
          {c.atelier.paragraphs.map((p, i) => (
            <p key={i} className={i === 0 ? "serif text-[1.6rem] font-light leading-snug" : "max-w-xl text-taupe-ink first-of-type:text-espresso"}>
              {p}
            </p>
          ))}
        </div>
        <PhotoPlaceholder label="hands fitting a strap" className="aspect-[4/5] w-full" />
      </section>
      <section className="bg-cream">
        <div className="mx-auto max-w-[1440px] px-5 py-24 md:px-10">
          <MinuteTrack className="h-3 w-full text-taupe/60" />
          <h2 className="eyebrow mt-10">Brand values</h2>
          <dl className="mt-8 grid gap-10 md:grid-cols-2 lg:grid-cols-5">
            {c.atelier.values.map((v, i) => (
              <div key={v.title}>
                <dt className="flex items-baseline gap-3">
                  <span className="serif text-champagne tabular">0{i + 1}</span>
                  <span className="text-[16px] font-medium">{v.title}</span>
                </dt>
                <dd className="mt-2 text-[14px] leading-relaxed text-taupe-ink">{v.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-5 py-24 text-center md:px-10">
        <Monogram size={52} className="mx-auto text-taupe" />
        <h2 className="display mt-8 text-[2.4rem] md:text-[3.2rem]">Conversation comes before transaction.</h2>
        <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-taupe-ink">If you have something particular in mind, a size, a colour, a date to keep on the caseback, write to us. Bespoke commissions are composed with you, part by part.</p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/contact#commission" className="btn btn-primary">Begin a commission</Link>
          <Link href="/build" className="btn btn-outline">Build your watch</Link>
        </div>
      </section>
    </>
  );
}
