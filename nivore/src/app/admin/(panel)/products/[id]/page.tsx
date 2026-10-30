import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { PageHeader } from "@/components/admin/ui";
import { STARTER_PARTS } from "@/data/seed/components";
import { repos } from "@/data/repositories";
import { toPublicCatalog } from "@/domain/catalog";
import type { Product } from "@/domain/models";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = repos();
  const [catalog, collections, settings] = await Promise.all([r.catalog.get(), r.products.collections(), r.settings.get()]);
  const isNew = id === "new";
  const now = new Date().toISOString();
  const product: Product | null = isNew
    ? { id: `p-${Date.now().toString(36)}`, slug: "", name: "", dialLabel: "", subtitle: "", description: "", collectionIds: [], priceMinor: 0, compareAtMinor: null, configuration: { parts: { ...STARTER_PARTS }, engraving: null, options: [] }, images: [], extraSpecs: [], stockQuantity: 1, status: "draft", releaseAt: null, featured: false, soldOut: false, allowCustomization: true, maxPerOrder: 1, seo: { title: "", description: "" }, sortOrder: 100, createdAt: now, updatedAt: now }
    : await r.products.get(id);
  if (!product) notFound();
  return (
    <>
      <PageHeader title={isNew ? "New product" : `${product.name} · ${product.dialLabel}`} eyebrow="Product" />
      <ProductEditor initial={product} isNew={isNew} catalog={toPublicCatalog(catalog)} collections={collections} pricing={settings.pricing} />
    </>
  );
}
