import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { POLICY_KEYS, type PolicyKey } from "@/domain/settings";
import { getSettings } from "@/server/catalog";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSettings();
  return POLICY_KEYS.includes(slug as PolicyKey) ? { title: s.policies[slug as PolicyKey].title } : {};
}

/** Policy pages. Bodies come only from the business; until then a clear notice is shown. */
export default async function InfoPage({ params }: { params: Params }) {
  const { slug } = await params;
  if (!POLICY_KEYS.includes(slug as PolicyKey)) notFound();
  const s = await getSettings();
  const policy = s.policies[slug as PolicyKey];
  return (
    <article className="mx-auto max-w-2xl px-5 pt-14 md:px-10 md:pt-20">
      <h1 className="display text-[2.8rem] md:text-[3.6rem]">{policy.title}</h1>
      {policy.body ? (
        <>
          <div className="mt-10 space-y-5 text-[15.5px] leading-[1.8]">
            {policy.body.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          {policy.updatedAt && <p className="mt-10 text-[12px] text-taupe-ink">Last updated {new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(policy.updatedAt))}</p>}
        </>
      ) : (
        <div className="mt-10 border border-line bg-cream p-6 text-[14.5px] leading-relaxed">
          <p>This policy is being finalised by the atelier and will be published here before orders are accepted.</p>
          <p className="mt-3 text-taupe-ink">
            If you need an answer now, <Link href="/contact" className="underline underline-offset-4">write to us</Link>.
          </p>
        </div>
      )}
    </article>
  );
}
