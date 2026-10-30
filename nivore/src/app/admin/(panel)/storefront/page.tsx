import { StorefrontForm } from "@/components/admin/StorefrontForm";
import { PageHeader } from "@/components/admin/ui";
import { repos } from "@/data/repositories";
import { formatCairo, resolveStorefront, STOREFRONT_MODE_LABEL } from "@/domain/storefront";

export default async function StorefrontPage() {
  const s = await repos().settings.get();
  const r = resolveStorefront(s.storefront, new Date());
  return (
    <>
      <PageHeader title="Storefront & launch">
        Right now visitors see: <strong>{r.gate === "none" ? (r.checkoutOpen ? "the full site" : "the site, with checkout closed") : STOREFRONT_MODE_LABEL[r.gate === "coming_soon" ? "coming_soon" : r.gate === "password" ? "password" : "maintenance"].title}</strong>
        {s.storefront.launchAt && <> · launch {formatCairo(s.storefront.launchAt)} Cairo</>}
      </PageHeader>
      <StorefrontForm initial={s.storefront} />
    </>
  );
}
