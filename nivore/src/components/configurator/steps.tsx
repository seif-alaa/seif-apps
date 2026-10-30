"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { effectivePrice, type MovementFamily, type PreviewAsset, type PublicComponent } from "@/domain/catalog";
import type { Engine, OptionEvaluation } from "@/domain/compatibility";
import { canonicalConfiguration, SLOT_LABEL, type Configuration, type Slot } from "@/domain/configuration";
import { formatDelta, formatEGP } from "@/domain/money";
import type { PricingSettings } from "@/domain/pricing";
import { resolveBuild, type ResolvedBuild } from "@/components/watch/geometry";
import { cn } from "@/lib/cn";
import { ComplicationGlyph, PartThumb, type ThumbKind } from "./thumbs";
import { OptionCard, StockNote } from "./ui";

export interface StepCtx {
  engine: Engine;
  config: Configuration;
  /** Deferred configuration used for heavy option evaluation. */
  evalConfig: Configuration;
  build: ResolvedBuild;
  assets: readonly PreviewAsset[];
  pricing: PricingSettings;
  select(slot: Slot, opt: OptionEvaluation): void;
  preload(id: string): void;
  setEngraving(text: string, style: "sans" | "serif"): void;
  toggleOption(id: string): void;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

const COMPLICATION_LABEL = (c: readonly string[]) =>
  c.includes("gmt") ? "Second time zone + date" : c.includes("day") ? "Day and date" : c.includes("date") ? "Date" : "Time only";

function delta(ctx: StepCtx, slot: Slot, c: PublicComponent): number {
  const cur = ctx.engine.get(ctx.config.parts[slot]);
  return effectivePrice(c) - (cur ? effectivePrice(cur) : 0);
}

function useThumbs(ctx: StepCtx, slot: Slot, kind: ThumbKind) {
  // Thumbnails depend on every other part; recompute only when those change.
  const others = canonicalConfiguration({ ...ctx.evalConfig, parts: { ...ctx.evalConfig.parts, [slot]: undefined } });
  const cache = useRef(new Map<string, ReactNode>());
  const lastKey = useRef(others);
  if (lastKey.current !== others) {
    cache.current.clear();
    lastKey.current = others;
  }
  return (opt: OptionEvaluation) => {
    const id = opt.component.id;
    let node = cache.current.get(id);
    if (!node) {
      const cfg = opt.proposal?.next ?? { ...ctx.evalConfig, parts: { ...ctx.evalConfig.parts, [slot]: id } };
      const b = resolveBuild(cfg, ctx.engine.get, ctx.engine.family);
      node = <PartThumb build={b} kind={kind} assets={ctx.assets} uid={`${kind}${id}`} />;
      cache.current.set(id, node);
    }
    return node;
  };
}

function Section({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="eyebrow">{title}</h3>
        {note && <span className="text-[11.5px] text-taupe-ink">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function NotApplicable({ children }: { children: ReactNode }) {
  return <p className="border border-dashed border-line px-4 py-3 text-[13px] text-taupe-ink">{children}</p>;
}

/** Available options first; unavailable ones grouped below with reasons. */
function OptionGrid({
  ctx,
  slot,
  kind,
  layout = "tile",
  filter,
  meta,
  cols = "grid-cols-3",
}: {
  ctx: StepCtx;
  slot: Slot;
  kind: ThumbKind | null;
  layout?: "tile" | "row";
  filter?: (c: PublicComponent) => boolean;
  meta?: (c: PublicComponent) => ReactNode;
  cols?: string;
}) {
  const options = useMemo(() => ctx.engine.options(ctx.evalConfig, slot), [ctx.engine, ctx.evalConfig, slot]);
  const thumb = useThumbs(ctx, slot, kind ?? "dial");
  const [showUnavailable, setShowUnavailable] = useState(false);
  const visible = options.filter((o) => !filter || filter(o.component) || o.component.id === ctx.config.parts[slot]);
  const available = visible.filter((o) => o.available || o.component.id === ctx.config.parts[slot]);
  const unavailable = visible.filter((o) => !o.available && o.component.id !== ctx.config.parts[slot]);

  const card = (o: OptionEvaluation) => (
    <li key={o.component.id}>
      <OptionCard
        testId={`opt-${o.component.id}`}
        layout={layout}
        selected={ctx.config.parts[slot] === o.component.id}
        disabled={!o.available && ctx.config.parts[slot] !== o.component.id}
        onSelect={() => ctx.select(slot, o)}
        onIntent={() => ctx.preload(o.component.id)}
        thumb={kind ? thumb(o) : undefined}
        title={o.component.name}
        meta={meta?.(o.component)}
        delta={delta(ctx, slot, o.component)}
        reason={o.unavailableReason}
        footnote={<StockNote status={o.component.stock.status} leadTimeDays={o.component.stock.leadTimeDays} />}
      />
    </li>
  );

  return (
    <div className="space-y-4">
      {available.length ? (
        <ul className={cn("grid gap-2.5", layout === "tile" ? cols : "grid-cols-1")}>{available.map(card)}</ul>
      ) : (
        <NotApplicable>No {SLOT_LABEL[slot].toLowerCase()} matches these filters with your current choices.</NotApplicable>
      )}
      {unavailable.length > 0 && (
        <div>
          <button type="button" className="eyebrow flex min-h-10 items-center gap-2 !text-taupe-ink hover:!text-espresso" aria-expanded={showUnavailable} onClick={() => setShowUnavailable((v) => !v)}>
            <span aria-hidden="true">{showUnavailable ? "−" : "+"}</span> Not available with your choices ({unavailable.length})
          </button>
          {showUnavailable && <ul className={cn("mt-2 grid gap-2.5", layout === "tile" ? cols : "grid-cols-1")}>{unavailable.map(card)}</ul>}
        </div>
      )}
    </div>
  );
}

function Chips<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string; swatch?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {options.map((o) => (
        <button key={o.id} type="button" className="chip shrink-0" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.swatch && <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ background: o.swatch }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── 01 Movement ─────────────────────────────────────────────────────── */

export function MovementStep({ ctx, families }: { ctx: StepCtx; families: MovementFamily[] }) {
  const options = useMemo(() => ctx.engine.options(ctx.evalConfig, "movement"), [ctx.engine, ctx.evalConfig]);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-7">
      {families
        .filter((fam) => options.some((o) => (o.component.spec as { familyId: string }).familyId === fam.id))
        .map((fam) => {
          const variants = options.filter((o) => (o.component.spec as { familyId: string }).familyId === fam.id);
          const specs = [
            fam.jewels && `${fam.jewels} jewels`,
            fam.frequencyBph && `${fam.frequencyBph.toLocaleString("en-US")} bph`,
            fam.powerReserveHours && `≈ ${fam.powerReserveHours} h reserve`,
            fam.hacking && "Hacking seconds",
            fam.handWinding && "Hand-winding",
          ].filter(Boolean) as string[];
          return (
            <section key={fam.id} className="space-y-3">
              <div className="flex gap-4">
                <span className="h-14 w-14 shrink-0">
                  <ComplicationGlyph complications={fam.complications} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-medium">
                    {fam.name} <span className="font-normal text-taupe-ink">· {COMPLICATION_LABEL(fam.complications)}</span>
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-taupe-ink">{fam.plainLanguage}</p>
                  <button type="button" className="mt-1 text-[12px] underline decoration-line-strong underline-offset-4 hover:text-taupe" aria-expanded={open === fam.id} onClick={() => setOpen(open === fam.id ? null : fam.id)}>
                    {open === fam.id ? "Hide specifications" : "Specifications & compatibility"}
                  </button>
                  {open === fam.id && (
                    <div className="mt-2 space-y-1.5 text-[12px] text-taupe-ink">
                      <p>{specs.join(" · ")}</p>
                      <p>
                        Ø {fam.diameterMm ?? "—"} mm · height {fam.heightMm ? `${fam.heightMm} mm` : "not yet measured"}
                      </p>
                      <p className="italic">{fam.specsVerified ? "Verified by the atelier." : "Maker's published figures, pending atelier verification."}</p>
                    </div>
                  )}
                </div>
              </div>
              <ul className="space-y-2">
                {variants.map((o) => (
                  <li key={o.component.id}>
                    <OptionCard
                      testId={`opt-${o.component.id}`}
                      layout="row"
                      selected={ctx.config.parts.movement === o.component.id}
                      disabled={!o.available && ctx.config.parts.movement !== o.component.id}
                      onSelect={() => ctx.select("movement", o)}
                      title={o.component.name}
                      meta={o.component.description}
                      delta={delta(ctx, "movement", o.component)}
                      reason={o.unavailableReason}
                      footnote={<StockNote status={o.component.stock.status} leadTimeDays={o.component.stock.leadTimeDays} />}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      <p className="text-[12px] leading-relaxed text-taupe-ink">
        Movements are made by Time Module Inc. and named as supplied. NIVORÉ is an independent atelier and is not affiliated with the movement maker.
      </p>
    </div>
  );
}

/* ── 02 Dial ─────────────────────────────────────────────────────────── */

const FAMILY_SWATCH: Record<string, [string, string]> = {
  light: ["Light", "#ece5d6"],
  pink: ["Rosé", "#e9cfc4"],
  blue: ["Blue", "#2e4a72"],
  green: ["Green", "#3d5c4c"],
  brown: ["Brown", "#7a4a2a"],
  red: ["Red", "#5a1f26"],
  grey: ["Grey", "#8d8a85"],
  dark: ["Black", "#1d1b1a"],
};

export function DialStep({ ctx }: { ctx: StepCtx }) {
  const dials = ctx.engine.listType("dial");
  const families = [...new Set(dials.map((d) => (d.spec as { colorFamily: string }).colorFamily))];
  const [fam, setFam] = useState<string>("all");
  const [lume, setLume] = useState<"any" | "lume">("any");
  return (
    <div className="space-y-4">
      <Chips
        label="Dial colour"
        value={fam}
        onChange={setFam}
        options={[{ id: "all", label: "All colours" }, ...families.map((f) => ({ id: f, label: FAMILY_SWATCH[f]?.[0] ?? f, swatch: FAMILY_SWATCH[f]?.[1] }))]}
      />
      <Chips label="Luminous" value={lume} onChange={setLume} options={[{ id: "any", label: "Any markers" }, { id: "lume", label: "Luminous markers" }]} />
      <OptionGrid
        ctx={ctx}
        slot="dial"
        kind="dial"
        filter={(c) => {
          const s = c.spec as { colorFamily: string; lume: boolean };
          return (fam === "all" || s.colorFamily === fam) && (lume === "any" || s.lume);
        }}
        meta={(c) => {
          const s = c.spec as { diameterMm: number; dateWindow: string; texture: string };
          return `${s.diameterMm} mm · ${s.dateWindow === "none" ? "no date" : s.dateWindow === "day-date" ? "day-date" : "date"} · ${s.texture}`;
        }}
      />
    </div>
  );
}

/* ── 03 Case ─────────────────────────────────────────────────────────── */

export function CaseStep({ ctx }: { ctx: StepCtx }) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-taupe-ink">Thumbnails share one scale, so sizes compare honestly.</p>
      <OptionGrid
        ctx={ctx}
        slot="case"
        kind="case"
        layout="row"
        meta={(c) => {
          const s = c.spec as { diameterMm: number; lugToLugMm: number; thicknessMm: number; lugWidthMm: number; crownPosition: number; finish: string; material: string };
          return (
            <>
              <span className="tabular">
                {s.diameterMm} mm · {s.lugToLugMm} mm lug to lug · {s.thicknessMm} mm thick
              </span>
              <br />
              {s.lugWidthMm} mm lugs · crown at {s.crownPosition === 3 ? "3" : "4"} · {s.finish.replace("-", " & ")}
            </>
          );
        }}
      />
    </div>
  );
}

/* ── 04 Hands ────────────────────────────────────────────────────────── */

export function HandsStep({ ctx }: { ctx: StepCtx }) {
  return (
    <OptionGrid
      ctx={ctx}
      slot="hands"
      kind="hands"
      meta={(c) => {
        const s = c.spec as { lume: boolean; gmtHand: boolean };
        return [s.lume ? "Luminous" : "Polished, no lume", s.gmtHand ? "with GMT hand" : null].filter(Boolean).join(" · ");
      }}
    />
  );
}

/* ── 05 Bezel & crystal ─────────────────────────────────────────────── */

export function BezelStep({ ctx }: { ctx: StepCtx }) {
  const bezelApplies = ctx.engine.applicable(ctx.config, "bezel");
  const insertApplies = ctx.engine.applicable(ctx.config, "insert");
  const ringApplies = ctx.engine.applicable(ctx.config, "chapterRing");
  const fam = ctx.build.family;
  return (
    <div className="space-y-8">
      <Section title="Bezel">
        {bezelApplies ? (
          <OptionGrid ctx={ctx} slot="bezel" kind="bezel" meta={(c) => ((c.spec as { bezelSystem: string }).bezelSystem === "dive-120" ? "Rotating, 120 clicks" : "Fixed")} />
        ) : (
          <NotApplicable>The {ctx.build.case?.name} has an integrated bezel, shaped as part of the case.</NotApplicable>
        )}
      </Section>
      {insertApplies && (
        <Section title="Bezel insert" note={fam?.complications.includes("gmt") ? "A 24-hour scale reads your GMT hand" : undefined}>
          <OptionGrid ctx={ctx} slot="insert" kind="insert" meta={(c) => (c.spec as { material: string }).material} />
        </Section>
      )}
      <Section title="Crystal">
        <OptionGrid
          ctx={ctx}
          slot="crystal"
          kind="crystal"
          layout="row"
          meta={(c) => {
            const s = c.spec as { profile: string; material: string; coating: string; cyclops: boolean };
            return [s.profile.replace("-", " "), s.material, s.coating === "none" ? null : s.coating === "blue-ar" ? "blue anti-reflective" : "clear anti-reflective", s.cyclops ? "date magnifier" : null]
              .filter(Boolean)
              .join(" · ");
          }}
        />
      </Section>
      <Section title="Chapter ring">
        {ringApplies ? <OptionGrid ctx={ctx} slot="chapterRing" kind="chapterRing" /> : <NotApplicable>This case has no chapter ring; the dial meets the case directly.</NotApplicable>}
      </Section>
    </div>
  );
}

/* ── 06 Bracelet / strap ────────────────────────────────────────────── */

export function BandStep({ ctx }: { ctx: StepCtx }) {
  const [kind, setKind] = useState<"all" | "bracelet" | "leather" | "rubber" | "fabric">("all");
  const claspApplies = ctx.engine.applicable(ctx.config, "clasp");
  return (
    <div className="space-y-8">
      <Section title="Bracelet or strap" note={ctx.build.case ? `${ctx.build.case.spec.lugWidthMm} mm lugs` : undefined}>
        <Chips
          label="Material"
          value={kind}
          onChange={setKind}
          options={[
            { id: "all", label: "All" },
            { id: "bracelet", label: "Steel" },
            { id: "leather", label: "Leather" },
            { id: "rubber", label: "Rubber" },
            { id: "fabric", label: "Fabric" },
          ]}
        />
        <OptionGrid
          ctx={ctx}
          slot="band"
          kind="band"
          filter={(c) => kind === "all" || (c.spec as { kind: string }).kind === kind}
          meta={(c) => {
            const s = c.spec as { lugWidthMm: number; claspWidthMm: number; endLinks: string };
            return `${s.lugWidthMm}–${s.claspWidthMm} mm${s.endLinks === "fitted" ? " · fitted end links" : ""}`;
          }}
        />
      </Section>
      <Section title="Clasp or buckle">
        {claspApplies ? (
          <OptionGrid ctx={ctx} slot="clasp" kind={null} layout="row" meta={(c) => `${(c.spec as { widthMm: number }).widthMm} mm · ${(c.spec as { tone: string }).tone}`} />
        ) : (
          <NotApplicable>This strap has its own buckle.</NotApplicable>
        )}
      </Section>
    </div>
  );
}

/* ── 07 Personalisation ─────────────────────────────────────────────── */

export function PersonalizeStep({ ctx }: { ctx: StepCtx }) {
  const cb = ctx.build.caseback;
  const engr = ctx.pricing.engraving;
  const engravable = engr.enabled && cb?.spec.kind === "solid" && cb.spec.engravable;
  const maxChars = Math.min(engr.maxChars, cb?.spec.engraveMaxChars ?? 0);
  const text = ctx.config.engraving?.text ?? "";
  const style = ctx.config.engraving?.style ?? "serif";
  const options = ctx.pricing.options.filter((o) => o.enabled);
  return (
    <div className="space-y-8">
      <Section title="Caseback">
        <OptionGrid ctx={ctx} slot="caseback" kind="caseback" meta={(c) => ((c.spec as { kind: string }).kind === "exhibition" ? "Shows the movement" : "Solid steel")} />
      </Section>

      {engr.enabled && (
        <Section title="Engraving" note={engravable ? `${formatEGP(engr.priceMinor)} · up to ${maxChars} characters` : undefined}>
          {engravable ? (
            <div className="space-y-3">
              <label className="block">
                <span className="sr-only">Engraving text</span>
                <input
                  className="field"
                  value={text}
                  maxLength={maxChars}
                  placeholder="A name, a date, a few words"
                  onChange={(e) => ctx.setEngraving(e.target.value.slice(0, maxChars), style)}
                  aria-describedby="engr-help"
                  data-testid="engraving-input"
                />
              </label>
              <div className="flex items-center justify-between gap-3">
                <div role="group" aria-label="Lettering" className="flex gap-1.5">
                  {(["serif", "sans"] as const).map((s) => (
                    <button key={s} type="button" className="chip" aria-pressed={style === s} onClick={() => ctx.setEngraving(text, s)}>
                      <span className={s === "serif" ? "serif italic" : "uppercase tracking-[0.14em]"}>{s === "serif" ? "Script" : "Capitals"}</span>
                    </button>
                  ))}
                </div>
                <span className={cn("tabular text-[12px]", text.length >= maxChars ? "text-warn" : "text-taupe-ink")}>
                  {text.length}/{maxChars}
                </span>
              </div>
              <p id="engr-help" className="text-[12px] leading-relaxed text-taupe-ink">
                Shown on the preview as a guide to placement. Every engraving is reviewed by the atelier before production; we will contact you if anything needs adjusting.
              </p>
            </div>
          ) : (
            <NotApplicable>{cb?.spec.kind === "exhibition" ? "A display caseback cannot be engraved. Choose a solid caseback to add engraving." : "Engraving is not offered for this caseback."}</NotApplicable>
          )}
        </Section>
      )}

      {options.length > 0 && (
        <Section title="Additional details">
          <ul className="space-y-2">
            {options.map((o) => {
              const on = ctx.config.options.includes(o.id);
              return (
                <li key={o.id}>
                  <label className={cn("flex cursor-pointer gap-3 border p-3.5 transition-colors", on ? "border-espresso" : "border-line hover:border-line-strong")}>
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-espresso)]" checked={on} onChange={() => ctx.toggleOption(o.id)} />
                    <span className="flex-1">
                      <span className="flex justify-between gap-3 text-[13px]">
                        <span>{o.name}</span>
                        <span className="tabular">{formatDelta(o.priceMinor)}</span>
                      </span>
                      <span className="mt-0.5 block text-[12px] text-taupe-ink">{o.description}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
