import { AssetManager } from "@/components/admin/AssetManager";
import { PageHeader } from "@/components/admin/ui";
import { STARTER_PARTS } from "@/data/seed/components";
import { repos } from "@/data/repositories";
import { toPublicCatalog } from "@/domain/catalog";

export default async function AssetsPage() {
  const catalog = await repos().catalog.get();
  return (
    <>
      <PageHeader title="Preview assets">
        Photographic layers replace the illustrated drawing part by part. Each layer carries its physical scale and an anchor point, so it lines up with every case and dial size. See docs/ASSETS.md for the photography and export workflow.
      </PageHeader>
      <AssetManager assets={catalog.assets} catalog={toPublicCatalog({ ...catalog, assets: [] })} sample={{ parts: { ...STARTER_PARTS }, engraving: null, options: [] }} />
    </>
  );
}
