import type { Metadata } from "next";
import { Configurator } from "@/components/configurator/Configurator";
import { STARTER_PARTS } from "@/data/seed/components";
import { decodeConfiguration, encodeConfiguration, STEPS, type Configuration } from "@/domain/configuration";
import { getEngine, getPublicCatalog, getSettings, getStorefront, getVisibleProducts } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Build your watch",
  description: "Compose your own automatic watch, part by part: movement, dial, case, hands, bezel and strap, with live pricing in EGP.",
};

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function BuildPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const [catalog, engine, settings, products, storefront] = await Promise.all([getPublicCatalog(), getEngine(), getSettings(), getVisibleProducts(), getStorefront()]);

  const starterRaw: Configuration = { parts: { ...STARTER_PARTS }, engraving: null, options: [] };
  let starter = engine.normalize(starterRaw);
  if (!engine.validate(starter).ok) starter = engine.normalize({ parts: {}, engraving: null, options: [] });

  let initial = starter;
  let fromUrl = false;
  let initialStep = 0;
  const shared = decodeConfiguration(params, catalog.components);
  const fromSlug = typeof params.from === "string" ? params.from : null;
  if (shared && Object.keys(shared.parts).length) {
    const normalized = engine.normalize(shared);
    initial = engine.validate(normalized).ok ? normalized : starter;
    fromUrl = true;
    initialStep = typeof params.edit === "string" ? STEPS.length - 1 : STEPS.length - 1;
  } else if (fromSlug) {
    const p = products.find((x) => x.slug === fromSlug);
    if (p && engine.validate(p.configuration).ok) {
      initial = p.configuration;
      fromUrl = true;
    }
  }

  const presets = products
    .filter((p) => p.allowCustomization && engine.validate(p.configuration).ok)
    .slice(0, 6)
    .map((p) => ({ slug: p.slug, label: `${p.name} · ${p.dialLabel}`, query: encodeConfiguration(p.configuration, catalog.components).toString() }));

  // Promo codes are never sent to the browser.
  const pricing = { ...settings.pricing, promos: [], options: settings.pricing.options.filter((o) => o.enabled) };

  return (
    <Configurator
      catalog={catalog}
      pricing={pricing}
      initial={initial}
      starter={starter}
      fromUrl={fromUrl}
      initialStep={initialStep}
      editItemId={typeof params.edit === "string" ? params.edit : null}
      presets={presets}
      assemblyLeadTime={settings.business.assemblyLeadTime}
      checkoutOpen={storefront.checkoutOpen}
    />
  );
}
