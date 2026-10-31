import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LayerPreview } from "@/components/dev/LayerPreview";
import meta from "../../../../public/parts/layers.json";

export const metadata: Metadata = { title: "Layer preview (dev)", robots: { index: false, follow: false } };

const DIALS = [
  ["dial_D01", "D01 · Black"],
  ["dial_D02", "D02 · Navy"],
  ["dial_D03", "D03 · Green"],
  ["dial_D04", "D04 · Silver sector"],
] as const;
const STRAPS = [
  ["bracelet_S02", "S02 · 3-link bracelet"],
  ["bracelet_S01", "S01 · 5-link bracelet"],
  ["strap_S08", "S08 · Black rubber"],
  ["strap_S09", "S09 · Brown leather"],
] as const;

/** Development tool. Never served in production builds. */
export default function LayersPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const parts = meta.parts as Record<string, { dateWindow?: { x: number; y: number; w: number; h: number } }>;
  return (
    <main className="min-h-dvh bg-ivory">
      <header className="border-b border-line px-5 py-4">
        <p className="eyebrow">Development · not part of the storefront</p>
        <h1 className="display text-[1.8rem]">Layer preview</h1>
      </header>
      <LayerPreview
        dials={DIALS.map(([id, label]) => ({ id, label, window: parts[id].dateWindow! }))}
        straps={STRAPS.map(([id, label]) => ({ id, label }))}
      />
    </main>
  );
}
