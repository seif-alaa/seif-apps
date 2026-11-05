import "server-only";
import manifest from "../../tools/parts/parts-manifest.json";
import report from "../../public/parts/_report.json";
import prices from "../../data/prices.json";
import { buildPartsCatalog, type Manifest, type PartsCatalog } from "@/lib/parts";

let memo: PartsCatalog | null = null;

/** Families, options and prices derived from the manifest, the normaliser's report and data/prices.json. */
export function getPartsCatalog(): PartsCatalog {
  if (!memo) {
    const available = new Set((report as { id: string; status: string }[]).filter((r) => r.status === "ok").map((r) => r.id));
    memo = buildPartsCatalog(manifest as unknown as Manifest, available, prices as unknown as Record<string, number>);
  }
  return memo;
}
