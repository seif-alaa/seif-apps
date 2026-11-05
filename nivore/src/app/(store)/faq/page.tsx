import type { Metadata } from "next";
import { getContent } from "@/server/catalog";

export const metadata: Metadata = { title: "Questions" };

export default async function FaqPage() {
  const c = await getContent();
  return (
    <div className="mx-auto max-w-3xl px-5 pt-14 md:px-10 md:pt-20">
      <h1 className="display text-[3rem] md:text-[4rem]">Questions</h1>
      <div className="mt-10 divide-y divide-line border-y border-line">
        {c.faq.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="flex list-none items-start justify-between gap-6 text-[16px]">
              {f.q}
              <span className="mt-0.5 text-taupe transition-transform group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-taupe-ink">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
