import Link from "next/link";
import { notFound } from "next/navigation";
import { ComponentEditor } from "@/components/admin/ComponentEditor";
import { PageHeader } from "@/components/admin/ui";
import { STARTER_PARTS } from "@/data/seed/components";
import { repos } from "@/data/repositories";
import { COMPONENT_CODE_PREFIX, COMPONENT_TYPE_LABEL, COMPONENT_TYPES, SPEC_SCHEMAS, toPublicCatalog, type Component, type ComponentType } from "@/domain/catalog";
import { describeObject } from "@/server/schema-describe";

const DEFAULT_SPECS: { [T in ComponentType]: Record<string, unknown> } = {
  movement: { familyId: "nh35", crownPosition: 3, dateWheel: "white", variantNote: "" },
  dial: { diameterMm: 28.5, feet: "crown-3", dateWindow: "date", colorName: "", colorHex: "#efe9dc", colorFamily: "light", texture: "sunburst", markers: "baton", markerTone: "steel", lume: false, lumeHex: null, printHex: "#3a322e", dialText: "", collection: "Essentials" },
  case: { styleName: "", shape: "round", diameterMm: 39, lugToLugMm: 46, thicknessMm: 12, lugWidthMm: 20, dialOpeningMm: 28.5, crystalDiameterMm: 31.5, crownPosition: 3, crownGuards: false, material: "316L stainless steel", finish: "brushed-polished", tone: "steel", bezelSystem: "fixed", chapterRingSize: null, maxMovementHeightMm: null, supportsExhibitionCaseback: false, casebackFit: "", lugStyle: "straight" },
  hands: { style: "baton", tone: "steel", lume: false, lumeHex: null, secondsHex: "#c9c6c0", secondsStyle: "stick", gmtHand: false, gmtHex: null, movementFamilies: [], dialDiametersMm: [] },
  bezel: { bezelSystem: "fixed", style: "smooth", tone: "steel", takesInsert: false, insertOuterMm: null, fitsCaseIds: [] },
  insert: { outerMm: 38, scale: "dive-60", colorHex: "#1c1a19", secondaryHex: null, numeralHex: "#ebe6da", material: "aluminium", lumePip: true },
  crystal: { diameterMm: 31.5, profile: "flat", material: "sapphire", coating: "clear-ar", cyclops: false },
  chapterRing: { size: "", colorHex: "#c9c7c2", markings: "minute-track", printHex: "#2b2725" },
  band: { kind: "leather", style: "smooth", lugWidthMm: 20, claspWidthMm: 18, colorHex: "#766a5d", secondaryHex: null, stitchHex: null, tone: null, endLinks: "none", fitsCaseIds: [], claspInterface: "buckle" },
  clasp: { interface: "buckle", style: "tang-buckle", widthMm: 18, tone: "steel" },
  caseback: { kind: "solid", fit: "", engravable: false, engraveMaxChars: 0, tone: "steel" },
};

export default async function ComponentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
  const [{ id }, { type }] = await Promise.all([params, searchParams]);
  const catalog = await repos().catalog.get();
  const isNew = id === "new";

  if (isNew && !COMPONENT_TYPES.includes(type as ComponentType)) {
    return (
      <>
        <PageHeader title="New component">Choose what kind of part you are adding.</PageHeader>
        <ul className="grid gap-2 sm:grid-cols-3">
          {COMPONENT_TYPES.map((t) => <li key={t}><Link className="block border border-line p-5 hover:border-espresso" href={`/admin/components/new?type=${t}`}>{COMPONENT_TYPE_LABEL[t]}</Link></li>)}
        </ul>
      </>
    );
  }

  let component: Component | undefined;
  if (isNew) {
    const t = type as ComponentType;
    const n = catalog.components.filter((c) => c.type === t).length + 1;
    let code = `${COMPONENT_CODE_PREFIX[t]}${String(n).padStart(2, "0")}`;
    while (catalog.components.some((c) => c.code === code)) code = `${COMPONENT_CODE_PREFIX[t]}${Math.floor(Math.random() * 900 + 100)}`;
    component = { type: t, id: `${t}-new-${n}`.toLowerCase(), code, name: "", sku: `NV-${code}`, supplier: null, supplierRef: null, costMinor: null, priceMinor: 0, priceAdjustmentMinor: 0, discountEligible: true, description: "", images: [], stock: { status: "in_stock", quantity: 0, leadTimeDays: null }, active: false, sortOrder: n * 10, updatedAt: new Date().toISOString(), spec: DEFAULT_SPECS[t] } as unknown as Component;
  } else {
    component = catalog.components.find((c) => c.id === id);
  }
  if (!component) notFound();

  return (
    <>
      <PageHeader title={isNew ? `New ${COMPONENT_TYPE_LABEL[component.type].toLowerCase()}` : component.name} eyebrow={COMPONENT_TYPE_LABEL[component.type]} actions={<Link href={`/admin/components?type=${component.type}`} className="btn btn-ghost">Back to list</Link>}>
        New components start inactive so you can check fit and preview before customers see them.
      </PageHeader>
      <ComponentEditor
        initial={component}
        isNew={isNew}
        specFields={describeObject(SPEC_SCHEMAS[component.type] as never)}
        catalog={toPublicCatalog({ ...catalog, assets: catalog.assets })}
        sample={{ parts: { ...STARTER_PARTS }, engraving: null, options: [] }}
      />
    </>
  );
}
