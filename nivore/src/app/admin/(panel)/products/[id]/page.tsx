import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { PageHeader } from "@/components/admin/ui";
import { repos } from "@/data/repositories";
import type { Product } from "@/domain/models";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = repos();
  const collections = await r.products.collections();
  const isNew = id === "new";
  const now = new Date().toISOString();
  const product: Product | null = isNew
    ? { id: `p-${Date.now().toString(36)}`, slug: "", name: "", dialLabel: "", movement: "NH35 automatic", subtitle: "", description: "", collectionIds: [], priceMinor: 0, compareAtMinor: null, images: [], extraSpecs: [], stockQuantity: 1, status: "draft", releaseAt: null, featured: false, soldOut: false, maxPerOrder: 1, seo: { title: "", description: "" }, sortOrder: 100, createdAt: now, updatedAt: now }
    : await r.products.get(id);
  if (!product) notFound();
  return (
    <>
      <PageHeader title={isNew ? "New product" : product.name} eyebrow="Product" />
      <ProductEditor initial={product} isNew={isNew} collections={collections} />
    </>
  );
}
