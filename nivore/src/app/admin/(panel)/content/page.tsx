import { saveContent } from "@/app/admin/actions";
import { JsonSectionForm } from "@/components/admin/JsonSectionForm";
import type { Json } from "@/components/admin/ObjectEditor";
import { PageHeader } from "@/components/admin/ui";
import { repos } from "@/data/repositories";
import Link from "next/link";

export default async function ContentPage() {
  const c = await repos().content.get();
  const products = await repos().products.list();
  return (
    <>
      <PageHeader title="Website content">Write in the atelier&rsquo;s voice: precise, warm, calm, honest. No superlatives or exclamation marks. Image fields take a path from <Link href="/admin/assets" className="underline">uploads</Link>, e.g. /uploads/dev/hero.webp.</PageHeader>
      <p className="mb-6 text-[12.5px] text-taupe-ink">Product ids for featured items: {products.map((p) => p.id).join(", ")}</p>
      <JsonSectionForm
        initial={c as unknown as Record<string, Json>}
        action={async (v) => {
          "use server";
          return saveContent(v);
        }}
        sections={[
          { key: "banner", title: "Promotional banner", help: "A single quiet line above the header. Keep it off unless there is something worth saying." },
          { key: "hero", title: "Homepage hero" },
          { key: "intro", title: "Brand introduction" },
          { key: "featuredProductIds", title: "Featured products (ids)" },
          { key: "featuredAuctionId", title: "Featured rare piece (auction id)" },
          { key: "process", title: "How customisation works" },
          { key: "craft", title: "Craftsmanship" },
          { key: "packaging", title: "Packaging" },
          { key: "ordering", title: "Ordering process" },
          { key: "collectionBanner", title: "Timepieces page banner" },
          { key: "atelier", title: "The Atelier page" },
          { key: "faq", title: "Questions" },
          { key: "footer", title: "Footer" },
          { key: "announcement", title: "Release announcement" },
        ]}
      />
    </>
  );
}
