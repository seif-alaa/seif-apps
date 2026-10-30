import type { Metadata } from "next";
import { ContactForm } from "@/components/shop/ContactForms";
import { getSettings } from "@/server/catalog";

export const metadata: Metadata = { title: "Contact & bespoke", description: "Write to the NIVORÉ atelier, or begin a bespoke commission." };

export default async function ContactPage() {
  const s = await getSettings();
  const b = s.business;
  const wa = b.whatsapp?.replace(/[^\d]/g, "");
  return (
    <div className="mx-auto max-w-[1440px] px-5 pt-14 md:px-10 md:pt-20">
      <h1 className="display text-[3rem] md:text-[4.4rem]">Speak with the atelier.</h1>
      <div className="mt-14 grid gap-16 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="space-y-8 text-[14.5px]">
          <div>
            <h2 className="eyebrow">Direct</h2>
            <ul className="mt-3 space-y-2">
              {b.email && <li><a className="link-underline" href={`mailto:${b.email}`}>{b.email}</a></li>}
              {b.phone && <li><a className="link-underline" href={`tel:${b.phone}`}>{b.phone}</a></li>}
              {wa && <li><a className="link-underline" href={`https://wa.me/${wa}`} rel="noopener">WhatsApp</a></li>}
              {b.instagram && <li>{b.instagram}</li>}
              {!b.email && !b.phone && !wa && <li className="text-taupe-ink">Direct contact details will be published shortly. The forms here reach the atelier now.</li>}
            </ul>
          </div>
          <div>
            <h2 className="eyebrow">Atelier</h2>
            <p className="mt-3">{b.city}</p>
            {b.hours && <p className="text-taupe-ink">{b.hours}</p>}
          </div>
          {b.replyWithinDays && <p className="text-taupe-ink">We reply personally within {b.replyWithinDays} days.</p>}
        </aside>
        <div className="space-y-20">
          <section>
            <h2 className="display text-[2rem]">Write to us</h2>
            <div className="mt-6"><ContactForm kind="contact" /></div>
          </section>
          <section id="commission" className="scroll-mt-24 border-t border-line pt-14">
            <p className="eyebrow">Bespoke · one-of-one</p>
            <h2 className="display mt-2 text-[2rem]">Begin a commission</h2>
            <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-taupe-ink">For a combination the builder does not offer, a special date on the caseback, or a piece for a particular wrist. Begin with the size of your wrist; dial, hands and strap follow.</p>
            <div className="mt-8"><ContactForm kind="commission" /></div>
          </section>
        </div>
      </div>
    </div>
  );
}
