import type { Metadata } from "next";
import { Builder } from "@/components/builder/Builder";
import { defaultBuild, decodeBuild } from "@/lib/parts";
import { getPartsCatalog } from "@/server/parts";
import { getSettings, getStorefront } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Build your watch",
  description: "Compose your own automatic Seiko-mod watch, part by part: case, bezel, dial, hands and strap, with live pricing in EGP.",
};

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function BuildPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const catalog = getPartsCatalog();
  const [settings, storefront] = await Promise.all([getSettings(), getStorefront()]);
  const first = catalog.families.find((f) => f.live);
  if (!first) return <p className="px-5 py-24 text-center text-taupe-ink">The builder is being prepared. Please check back soon.</p>;

  // New visitors start at step 1. A valid share link opens at Review; old-format links open the default build.
  const raw = typeof params.b === "string" ? params.b : null;
  const shared = decodeBuild(catalog, raw);
  return (
    <Builder
      catalog={catalog}
      assemblyMinor={settings.pricing.assemblyMinor}
      initial={shared ?? defaultBuild(first)}
      fromUrl={Boolean(shared)}
      editItemId={typeof params.edit === "string" ? params.edit : null}
      checkoutOpen={storefront.checkoutOpen}
    />
  );
}
