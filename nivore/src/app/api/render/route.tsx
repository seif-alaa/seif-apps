import { repos } from "@/data/repositories";
import { toPublicCatalog } from "@/domain/catalog";
import { createEngine } from "@/domain/compatibility";
import { decodeConfiguration } from "@/domain/configuration";
import { resolveBuild } from "@/components/watch/geometry";
import { buildLayers, StaticWatch } from "@/components/watch/layers";
import { svgToString } from "@/server/svg-string";

/**
 * GET /api/render?b=…&e=…&view=front|rear → SVG of a composition.
 * Used for bag thumbnails, saved designs and order sheets, so those pages
 * need no renderer JavaScript. Output depends only on the query → cacheable.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const catalog = toPublicCatalog(await repos().catalog.get());
  const config = decodeConfiguration(url.searchParams, catalog.components);
  if (!config) return new Response("Bad request", { status: 400 });
  const engine = createEngine(catalog);
  const view = url.searchParams.get("view") === "rear" ? "rear" : "front";
  const build = resolveBuild(config, engine.get, engine.family);
  const svg = svgToString(<StaticWatch layers={buildLayers(build, view, catalog.assets)} idPrefix="r" />);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
