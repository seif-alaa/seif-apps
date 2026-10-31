import "server-only";
import { cache } from "react";
import { repos } from "@/data/repositories";
import { toPublicCatalog } from "@/domain/catalog";
import { createEngine } from "@/domain/compatibility";
import { isProductVisible } from "@/domain/models";
import { resolveStorefront } from "@/domain/storefront";

/** Per-request cached loaders for server components. */

export const getCatalog = cache(() => repos().catalog.get());
export const getSettings = cache(() => repos().settings.get());
export const getContent = cache(() => repos().content.get());

export const getPublicCatalog = cache(async () => toPublicCatalog(await getCatalog()));

export const getEngine = cache(async () => createEngine(await getPublicCatalog()));

export const getVisibleProducts = cache(async () => {
  const now = new Date();
  return (await repos().products.list()).filter((p) => isProductVisible(p, now));
});

export const getStorefront = cache(async () => {
  const s = await getSettings();
  return resolveStorefront(s.storefront, new Date(), { hasAccessPass: true });
});

export function isDevDriver(): boolean {
  return repos().driver === "dev";
}
