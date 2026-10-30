import { repos } from "@/data/repositories";
import { resolveBuild } from "@/components/watch/geometry";
import { buildLayers, StaticWatch } from "@/components/watch/layers";
import { getEngine, getPublicCatalog } from "@/server/catalog";

export default async function RenderCheck() {
  const engine = await getEngine();
  const cat = await getPublicCatalog();
  const products = await repos().products.list();
  return (
    <div className="grid grid-cols-4 gap-4 bg-cream p-6">
      {products.map((p) => {
        const b = resolveBuild(p.configuration, engine.get, engine.family);
        return (
          <div key={p.id}>
            <StaticWatch layers={buildLayers(b, "front", cat.assets)} idPrefix={p.id} className="w-full" />
            <p className="text-xs">{p.name} · {p.dialLabel}</p>
          </div>
        );
      })}
      {products.slice(0, 4).map((p) => {
        const b = resolveBuild({ ...p.configuration, engraving: { text: "For L. with love 2026", style: "serif" } }, engine.get, engine.family);
        return <StaticWatch key={p.id + "r"} layers={buildLayers(b, "rear", cat.assets)} idPrefix={p.id + "r"} className="w-full" />;
      })}
    </div>
  );
}
