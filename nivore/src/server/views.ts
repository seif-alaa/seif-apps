import "server-only";
import type { Engine } from "@/domain/compatibility";
import { encodeConfiguration, type Configuration } from "@/domain/configuration";
import type { Product } from "@/domain/models";
import { resolveBuild, type ResolvedBuild } from "@/components/watch/geometry";

export interface SpecRow {
  label: string;
  value: string;
}

/** Specification rows derived from the actual components (never hand-typed claims). */
export function specRows(build: ResolvedBuild): SpecRow[] {
  const rows: SpecRow[] = [];
  const { family: fam, movement: m, case: k, dial: d, hands: h, bezel: z, insert: i, crystal: x, chapterRing: r, band: s, clasp: q, caseback: cb } = build;
  if (fam && m) {
    const facts = [fam.jewels && `${fam.jewels} jewels`, fam.frequencyBph && `${fam.frequencyBph.toLocaleString("en-US")} bph`, fam.powerReserveHours && `≈ ${fam.powerReserveHours} h power reserve`]
      .filter(Boolean)
      .join(" · ");
    rows.push({ label: "Movement", value: `${fam.name}, automatic${m.spec.dateWheel ? `, ${m.spec.dateWheel} date wheel` : ""}${facts ? ` — ${facts}` : ""}` });
  }
  if (k) {
    rows.push({ label: "Case", value: `${k.name} · ${k.spec.material}, ${k.spec.finish.replace("-", " and ")}` });
    rows.push({ label: "Dimensions", value: `${k.spec.diameterMm} mm diameter · ${k.spec.lugToLugMm} mm lug to lug · ${k.spec.thicknessMm} mm thick · ${k.spec.lugWidthMm} mm lugs` });
  }
  if (d) rows.push({ label: "Dial", value: `${d.name}${d.spec.lume ? ", luminous markers" : ""}` });
  if (h) rows.push({ label: "Hands", value: h.name });
  if (z) rows.push({ label: "Bezel", value: `${z.name}${i ? ` with ${i.name.toLowerCase()} insert` : ""}` });
  if (x) rows.push({ label: "Crystal", value: x.name });
  if (r) rows.push({ label: "Chapter ring", value: r.name });
  if (s) rows.push({ label: s.spec.kind === "bracelet" ? "Bracelet" : "Strap", value: `${s.name}${q ? `, ${q.name.toLowerCase()}` : ""}` });
  if (cb) rows.push({ label: "Caseback", value: cb.name });
  rows.push({ label: "Water resistance", value: "Not rated. Unless your documentation states otherwise, keep it away from water." });
  return rows;
}

export function productView(p: Product, engine: Engine) {
  const build = resolveBuild(p.configuration, engine.get, engine.family);
  return {
    product: p,
    build,
    specs: [...specRows(build), ...p.extraSpecs],
    query: encodeConfiguration(p.configuration, [...engine.listType("movement"), ...allComponents(engine)]).toString(),
    available: !p.soldOut && p.stockQuantity > 0,
    caliber: build.family?.caliber ?? "",
  };
}

function allComponents(engine: Engine) {
  return (["dial", "case", "hands", "bezel", "insert", "crystal", "chapterRing", "band", "clasp", "caseback"] as const).flatMap((t) => engine.listType(t));
}

export function disclosure(build: ResolvedBuild): string {
  const cal = build.family ? `${build.family.maker.replace(/ \(.*\)/, "")} ${build.family.caliber}` : "third-party";
  return `Built in the NIVORÉ atelier around a ${cal} automatic movement and selected aftermarket components. NIVORÉ is independent and not affiliated with or endorsed by the movement maker.`;
}

export function renderUrl(query: string, view: "front" | "rear" = "front") {
  return `/api/render?${query}${view === "rear" ? "&view=rear" : ""}`;
}

export type { Configuration };
