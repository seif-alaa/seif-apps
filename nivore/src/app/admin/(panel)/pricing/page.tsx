import { savePricing } from "@/app/admin/actions";
import { JsonSectionForm } from "@/components/admin/JsonSectionForm";
import type { Json } from "@/components/admin/ObjectEditor";
import { PageHeader, Table, fmtDate } from "@/components/admin/ui";
import { repos } from "@/data/repositories";
import Link from "next/link";

export default async function PricingPage() {
  const [s, audit] = await Promise.all([repos().settings.get(), repos().misc.audit({ limit: 400 })]);
  const priceAudit = audit.filter((a) => a.action.startsWith("price.")).slice(0, 25);
  const pricing = s.pricing as unknown as Json;
  return (
    <>
      <PageHeader title="Pricing">Assembly, personalisation, promotions, delivery and tax. Component prices are edited on each <Link href="/admin/components" className="underline">component</Link>; catalogue prices on each <Link href="/admin/products" className="underline">product</Link>. All amounts in EGP.</PageHeader>
      <JsonSectionForm
        initial={{ pricing, shipping: s.shipping as unknown as Json }}
        action={async (v) => {
          "use server";
          return savePricing(v);
        }}
        sections={[
          { key: "pricing", title: "Charges, personalisation & promotions", help: "Promo codes: uppercase letters, numbers and dashes. Percent values are entered as %. Tax stays off until you confirm your obligations." },
          { key: "shipping", title: "Delivery & pickup", help: "Rates per governorate override the default rate. Leave free-delivery threshold empty for none." },
        ]}
        templates={{
          "pricing.promos[]": { code: "NEWCODE", label: "", kind: "percent", value: 1000, appliesTo: "all", minSubtotalMinor: 0, startsAt: null, endsAt: null, active: false, usageLimit: null, usedCount: 0 },
          "pricing.options[]": { id: "new-option", name: "New option", description: "", priceMinor: 0, enabled: false },
        }}
      />
      <h2 className="eyebrow mt-12">Recent price changes</h2>
      <div className="mt-3">
        <Table head={["When", "Who", "Change"]}>
          {priceAudit.map((a) => <tr key={a.id}><td className="px-4 py-2.5 text-taupe-ink">{fmtDate(a.at)}</td><td className="px-4 py-2.5">{a.actor}</td><td className="px-4 py-2.5">{a.summary}</td></tr>)}
        </Table>
      </div>
    </>
  );
}
