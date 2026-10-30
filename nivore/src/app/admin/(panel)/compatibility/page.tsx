import { saveMovementFamily } from "@/app/admin/actions";
import { CompatManager } from "@/components/admin/CompatManager";
import { JsonSectionForm } from "@/components/admin/JsonSectionForm";
import type { Json } from "@/components/admin/ObjectEditor";
import { PageHeader } from "@/components/admin/ui";
import { repos } from "@/data/repositories";
import { toPublicCatalog } from "@/domain/catalog";

export default async function CompatibilityPage() {
  const catalog = await repos().catalog.get();
  return (
    <>
      <PageHeader title="Compatibility">Three outcomes, kept separate: verified compatible, verified incompatible, and not yet confirmed. Only verified-compatible parts can be ordered together.</PageHeader>
      <CompatManager catalog={toPublicCatalog(catalog)} records={catalog.compat} />
      <h2 className="display mb-4 mt-14 text-[1.8rem]">Movement families</h2>
      <p className="mb-6 text-[13px] text-taupe-ink">Caliber-level facts shared by every supplier variant. Leave a figure empty if unverified; height drives case clearance checks.</p>
      <div className="space-y-8">
        {catalog.movementFamilies.map((f) => (
          <JsonSectionForm
            key={f.id}
            initial={{ family: f as unknown as Json }}
            action={async (v) => {
              "use server";
              return saveMovementFamily(v.family);
            }}
            sections={[{ key: "family", title: f.name }]}
          />
        ))}
      </div>
    </>
  );
}
