"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { PublicCatalog } from "@/domain/catalog";
import { createEngine, type OptionEvaluation, type Proposal } from "@/domain/compatibility";
import {
  buildReference,
  encodeConfiguration,
  presentationName,
  SLOT_LABEL,
  SLOT_ORDER,
  STEPS,
  stepForSlot,
  type Configuration,
  type Slot,
} from "@/domain/configuration";
import { formatEGP } from "@/domain/money";
import { quoteBuild, type PricingSettings } from "@/domain/pricing";
import { resolveBuild } from "@/components/watch/geometry";
import { buildLayers, isIllustrative } from "@/components/watch/layers";
import { WatchStage } from "@/components/watch/WatchStage";
import { useBag } from "@/lib/cart";
import { cn } from "@/lib/cn";
import { useSaved } from "@/lib/saved";
import { readLocal, writeLocal } from "@/lib/storage";
import { BandStep, BezelStep, CaseStep, DialStep, HandsStep, MovementStep, PersonalizeStep, type StepCtx } from "./steps";
import { AnimatedPrice, Dialog, StepTrack, Toast } from "./ui";

export interface ConfiguratorProps {
  catalog: PublicCatalog;
  pricing: PricingSettings;
  initial: Configuration;
  starter: Configuration;
  fromUrl: boolean;
  initialStep?: number;
  editItemId?: string | null;
  presets: { slug: string; label: string; query: string }[];
  assemblyLeadTime: string | null;
  checkoutOpen: boolean;
}

const CURRENT_KEY = "nivore.current.v1";

export function Configurator(props: ConfiguratorProps) {
  const { catalog, pricing } = props;
  const engine = useMemo(() => createEngine(catalog), [catalog]);
  const [config, setConfig] = useState<Configuration>(props.initial);
  const evalConfig = useDeferredValue(config);
  const [step, setStep] = useState(props.initialStep ?? 0);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([props.initialStep ?? 0]));
  const [pending, setPending] = useState<(Proposal & { slot: Slot; label: string }) | null>(null);
  const [viewOverride, setViewOverride] = useState<"front" | "rear" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState(false);
  const [sheet, setSheet] = useState<"peek" | "full">("peek");
  const [confirmReset, setConfirmReset] = useState(false);
  const [, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const addToBag = useBag((s) => s.add);
  const replaceInBag = useBag((s) => s.replace);
  const hydrateBag = useBag((s) => s.hydrate);
  const saveDesign = useSaved((s) => s.save);
  const hydrateSaved = useSaved((s) => s.hydrate);

  const build = useMemo(() => resolveBuild(config, engine.get, engine.family), [config, engine]);
  const quote = useMemo(() => quoteBuild(config, engine, pricing), [config, engine, pricing]);
  const validation = useMemo(() => engine.validate(config), [config, engine]);
  const reference = useMemo(() => buildReference(config), [config]);
  const name = presentationName(build.dial, build.case, build.family?.complications);
  const query = useMemo(() => encodeConfiguration(config, catalog.components).toString(), [config, catalog.components]);
  const current = STEPS[step];
  const view = viewOverride ?? (current.id === "personalize" ? "rear" : "front");

  useEffect(() => {
    hydrateBag();
    hydrateSaved();
  }, [hydrateBag, hydrateSaved]);

  // Restore the last composition when arriving without a shared link.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (props.fromUrl) return;
    const saved = readLocal<{ config: Configuration; step: number }>(CURRENT_KEY);
    if (saved?.config && engine.validate(saved.config).ok) {
      setConfig(saved.config);
      setStep(Math.min(saved.step ?? 0, STEPS.length - 1));
      setToast("Your last composition has been restored.");
    }
  }, [engine, props.fromUrl]);

  // Keep the URL and local copy in step with the composition (refresh-safe, shareable).
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(query);
      if (props.editItemId) params.set("edit", props.editItemId);
      window.history.replaceState(null, "", `/build?${params.toString()}`);
      writeLocal(CURRENT_KEY, { config, step });
    }, 250);
    return () => clearTimeout(t);
  }, [query, config, step, props.editItemId]);

  const commit = useCallback((next: Configuration) => {
    setConfig(next);
  }, []);

  const select = useCallback(
    (slot: Slot, opt: OptionEvaluation) => {
      const id = opt.component.id;
      if (config.parts[slot] === id) return;
      const proposal = opt.proposal ?? engine.propose(config, slot, id);
      if (proposal.blocked.length) {
        setToast(`${SLOT_LABEL[proposal.blocked[0].slot]}: ${proposal.blocked[0].message}`);
        return;
      }
      if (proposal.needsConfirmation) {
        setPending({ ...proposal, slot, label: opt.component.name });
        return;
      }
      startTransition(() => commit(proposal.next));
      const added = proposal.changes.filter((c) => c.kind === "added");
      if (added.length) setToast(added.map((c) => `${SLOT_LABEL[c.slot]} added: ${engine.get(c.to)?.name}`).join(" · "));
    },
    [config, engine, commit],
  );

  const preload = useCallback(
    (id: string) => {
      for (const a of catalog.assets) {
        if (a.componentId === id) {
          const img = new Image();
          img.src = a.src;
        }
      }
    },
    [catalog.assets],
  );

  const ctx: StepCtx = {
    engine,
    config,
    evalConfig,
    build,
    assets: catalog.assets,
    pricing,
    select,
    preload,
    setEngraving: (text, style) => setConfig((c) => ({ ...c, engraving: text ? { text, style } : null })),
    toggleOption: (id) => setConfig((c) => ({ ...c, options: c.options.includes(id) ? c.options.filter((x) => x !== id) : [...c.options, id] })),
  };

  const goTo = useCallback((i: number) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, i));
    setStep(next);
    setViewOverride(null);
    setVisited((v) => new Set(v).add(next));
    setBreakdown(false);
    panelRef.current?.scrollTo({ top: 0 });
  }, []);

  // Drop engraving when the caseback can no longer take it.
  useEffect(() => {
    const cb = build.caseback;
    if (config.engraving && (!pricing.engraving.enabled || !cb || cb.spec.kind !== "solid" || !cb.spec.engravable)) {
      setConfig((c) => ({ ...c, engraving: null }));
    }
  }, [build.caseback, config.engraving, pricing.engraving.enabled]);

  const canOrder = validation.ok && quote.availability.status !== "unavailable";

  function handleAddToBag() {
    if (!canOrder) return;
    const item = {
      kind: "custom" as const,
      configuration: config,
      name: name.full,
      detail: [build.family?.caliber, build.case?.name, build.band?.name].filter(Boolean).join(" · "),
      buildRef: reference,
      quantity: 1,
      displayMinor: quote.totalMinor,
    };
    if (props.editItemId) {
      replaceInBag(props.editItemId, item);
      setToast("Your bag has been updated.");
    } else {
      addToBag(item);
      setToast("Added to your bag.");
    }
  }

  function handleSave() {
    saveDesign({ ref: reference, name: name.full, configuration: config, query, savedAt: new Date().toISOString(), totalMinorAtSave: quote.totalMinor });
    setToast("Saved on this device. Find it under Saved compositions.");
  }

  async function handleShare() {
    const url = `${window.location.origin}/build?${query}`;
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: `NIVORÉ · ${name.full}`, text: `My NIVORÉ composition, ${reference}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast("Link copied. Anyone with it sees this exact composition.");
    } catch {
      setToast("Copy the link from the address bar to share this composition.");
    }
  }

  async function handleDownload() {
    try {
      const { downloadBuildImage } = await import("./export");
      const layers = buildLayers(build, "front", catalog.assets);
      await downloadBuildImage(layers, { name: name.full, reference, illustrative: isIllustrative(layers) });
    } catch {
      setToast("The image could not be created in this browser.");
    }
  }

  function applyPreset(q: string) {
    const params = new URLSearchParams(q);
    const codes = new Map(catalog.components.map((c) => [c.code, c]));
    const parts: Configuration["parts"] = {};
    for (const code of (params.get("b") ?? "").split(".")) {
      const c = codes.get(code);
      if (c) parts[c.type as Slot] = c.id;
    }
    const next = engine.normalize({ parts, engraving: null, options: [] });
    if (engine.validate(next).ok) {
      setConfig(next);
      setToast("Composition loaded. Change anything you like.");
    }
  }

  const stepBody = (() => {
    switch (current.id) {
      case "movement":
        return <MovementStep ctx={ctx} families={catalog.movementFamilies} />;
      case "dial":
        return <DialStep ctx={ctx} />;
      case "case":
        return <CaseStep ctx={ctx} />;
      case "hands":
        return <HandsStep ctx={ctx} />;
      case "bezel":
        return <BezelStep ctx={ctx} />;
      case "band":
        return <BandStep ctx={ctx} />;
      case "personalize":
        return <PersonalizeStep ctx={ctx} />;
      case "review":
        return null;
    }
  })();

  const isReview = current.id === "review";

  return (
    <div className="flex h-[calc(100dvh-3.25rem)] flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(400px,460px)]">
      {/* ── Stage ─────────────────────────────────────────────── */}
      <section className="relative min-h-0 flex-1 overflow-hidden bg-cream" aria-label="Watch preview">
        <div className="pointer-events-none absolute left-5 top-4 z-10 md:left-8 md:top-6">
          <p className="eyebrow hidden lg:block">Composition</p>
          <p className="display text-[1.35rem] md:text-[2rem]" data-testid="build-name">
            {name.full}
          </p>
          <p className="tabular text-[11px] tracking-[0.12em] text-taupe-ink" data-testid="build-ref">
            {reference}
          </p>
        </div>
        <div className="absolute inset-0 pb-6 pt-14 md:pt-10 lg:px-10 lg:pb-14 lg:pt-16">
          <WatchStage
            build={build}
            assets={catalog.assets}
            view={view}
            camera={current.camera}
            engravingGuide={current.id === "personalize"}
            label={`${name.full}, ${view === "front" ? "front" : "back"} view`}
          />
        </div>
        <div className="absolute bottom-3 right-4 z-10 flex gap-1 md:bottom-6 md:right-8" role="group" aria-label="View">
          {(["front", "rear"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={cn("min-h-8 rounded-full border px-3.5 text-[11px] tracking-[0.06em] transition-colors", view === v ? "border-espresso bg-espresso text-ivory" : "border-line bg-ivory/70 text-espresso backdrop-blur hover:border-line-strong")}
              aria-pressed={view === v}
              onClick={() => setViewOverride(v)}
            >
              {v === "front" ? "Front" : "Back"}
            </button>
          ))}
        </div>
      </section>

      {/* ── Panel ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          "relative z-20 flex min-h-0 flex-col border-t border-line bg-ivory shadow-[0_-12px_32px_-24px_rgba(58,50,46,0.5)] transition-[height] duration-500 lg:h-auto lg:border-l lg:border-t-0 lg:shadow-none",
          sheet === "full" ? "h-[78dvh]" : "h-[48dvh]",
        )}
        style={{ transitionTimingFunction: "var(--ease-settle)" }}
        aria-label="Customise"
      >
        <button
          type="button"
          className="flex h-5 w-full shrink-0 items-center justify-center lg:hidden"
          aria-label={sheet === "full" ? "Show more of the watch" : "Expand options"}
          aria-expanded={sheet === "full"}
          onClick={() => setSheet((s) => (s === "full" ? "peek" : "full"))}
        >
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </button>
        <div className="shrink-0 px-5 pb-3 lg:px-8 lg:pb-5 lg:pt-7">
          <StepTrack steps={STEPS} current={step} visited={visited} onJump={goTo} />
          <div className="mt-3 flex items-baseline justify-between gap-4 lg:mt-5">
            <h2 className="flex items-baseline gap-3">
              <span className="serif whitespace-nowrap text-sm font-light text-taupe-ink tabular">N° {current.index}</span>
              <span className="display text-[1.6rem] lg:text-[2.1rem]">{current.title}</span>
            </h2>
            <span className="eyebrow hidden sm:inline">{current.verb}</span>
          </div>
          <p className="mt-1.5 hidden text-[13px] leading-relaxed text-taupe-ink lg:block">{current.narrative}</p>
          {current.id === "movement" && props.presets.length > 0 && (
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
              <span className="eyebrow shrink-0 self-center pr-1">Begin from</span>
              {props.presets.map((p) => (
                <button key={p.slug} type="button" className="chip shrink-0" onClick={() => applyPreset(p.query)}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div ref={panelRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 lg:px-8" key={current.id} style={{ animation: "fade-up 360ms var(--ease-settle) both" }}>
          {isReview ? (
            <Review
              build={build}
              quote={quote}
              validation={validation}
              name={name.full}
              reference={reference}
              query={query}
              assemblyLeadTime={props.assemblyLeadTime}
              onEdit={(slot) => goTo(STEPS.indexOf(stepForSlot(slot)))}
              canOrder={canOrder}
              editing={Boolean(props.editItemId)}
              checkoutOpen={props.checkoutOpen}
              onAdd={handleAddToBag}
              onSave={handleSave}
              onShare={handleShare}
              onDownload={handleDownload}
              onReset={() => setConfirmReset(true)}
            />
          ) : (
            stepBody
          )}
        </div>

        {/* Price + navigation */}
        <div className="relative shrink-0 border-t border-line bg-ivory px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:px-8 lg:pb-6 lg:pt-4">
          {breakdown && (
            <div id="breakdown" className="absolute inset-x-0 bottom-full max-h-[50dvh] overflow-y-auto border-t border-line bg-ivory px-5 py-4 shadow-[0_-16px_32px_-24px_rgba(58,50,46,0.6)] lg:px-8" style={{ animation: "fade-up 280ms var(--ease-settle) both" }}>
              <PriceLines quote={quote} />
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <button type="button" className="text-left" aria-expanded={breakdown} aria-controls="breakdown" onClick={() => setBreakdown((b) => !b)}>
              <span className="eyebrow block">Total {breakdown ? "−" : "+"}</span>
              <AnimatedPrice value={quote.totalMinor} className="text-[1.15rem] font-medium lg:text-[1.3rem]" />
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button type="button" className="btn btn-ghost !px-2" onClick={() => goTo(step - 1)}>
                  Back
                </button>
              )}
              {!isReview ? (
                <button type="button" className="btn btn-primary" data-testid="continue" onClick={() => goTo(step + 1)}>
                  {step === STEPS.length - 2 ? "Review" : "Continue"}
                </button>
              ) : (
                <button type="button" className="btn btn-primary" data-testid="add-to-bag" disabled={!canOrder} onClick={handleAddToBag}>
                  {props.editItemId ? "Update bag" : "Add to bag"}
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      <Dialog open={Boolean(pending)} onClose={() => setPending(null)} title="This changes other parts">
        {pending && (
          <div className="space-y-5">
            <p className="text-[14px] leading-relaxed text-taupe-ink">
              {pending.label} needs {pending.changes.filter((c) => c.kind !== "added").length === 1 ? "one other part" : "some other parts"} to change so everything fits together.
            </p>
            <ul className="divide-y divide-line border-y border-line">
              {pending.changes.map((c) => (
                <li key={c.slot} className="py-3 text-[13px]">
                  <p className="eyebrow">{SLOT_LABEL[c.slot]}</p>
                  <p className="mt-1">
                    {c.from && <span className={cn(c.to && "text-taupe-ink line-through decoration-taupe/50")}>{engine.get(c.from)?.name}</span>}
                    {c.from && c.to && <span aria-hidden="true"> → </span>}
                    {c.to && <span>{engine.get(c.to)?.name}</span>}
                    {!c.to && <span className="text-taupe-ink"> (removed)</span>}
                  </p>
                  <p className="mt-1 text-[12px] text-taupe-ink">{c.reason}</p>
                </li>
              ))}
            </ul>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn btn-outline" onClick={() => setPending(null)}>
                Keep my current choice
              </button>
              <button
                type="button"
                className="btn btn-primary"
                data-testid="confirm-changes"
                onClick={() => {
                  commit(pending.next);
                  setPending(null);
                }}
              >
                Apply changes
              </button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title="Start again?">
        <p className="mb-6 text-[14px] text-taupe-ink">Your current composition will be replaced by the atelier&rsquo;s starting point. Saved compositions are kept.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-outline" onClick={() => setConfirmReset(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setConfig(props.starter);
              setConfirmReset(false);
              goTo(0);
            }}
          >
            Start again
          </button>
        </div>
      </Dialog>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function PriceLines({ quote }: { quote: ReturnType<typeof quoteBuild> }) {
  return (
    <dl className="space-y-1.5 text-[13px]">
      {quote.lines.map((l) => (
        <div key={l.key} className="flex justify-between gap-4">
          <dt className="min-w-0 truncate">
            <span className="text-taupe-ink">{l.label}</span> · {l.name}
          </dt>
          <dd className="tabular shrink-0">{formatEGP(l.amountMinor)}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-4 border-t border-line pt-2 font-medium">
        <dt>Total</dt>
        <dd className="tabular">{formatEGP(quote.totalMinor)}</dd>
      </div>
      <p className="pt-1 text-[11.5px] text-taupe-ink">Delivery is calculated at checkout. Prices are confirmed by the atelier&rsquo;s server when you order.</p>
    </dl>
  );
}

function Review(p: {
  build: ReturnType<typeof resolveBuild>;
  quote: ReturnType<typeof quoteBuild>;
  validation: ReturnType<ReturnType<typeof createEngine>["validate"]>;
  name: string;
  reference: string;
  query: string;
  assemblyLeadTime: string | null;
  onEdit: (slot: Slot) => void;
  canOrder: boolean;
  editing: boolean;
  checkoutOpen: boolean;
  onAdd: () => void;
  onSave: () => void;
  onShare: () => void;
  onDownload: () => void;
  onReset: () => void;
}) {
  const a = p.quote.availability;
  const byKey = new Map(p.quote.lines.map((l) => [l.key, l]));
  return (
    <div className="space-y-7" data-testid="review">
      <div>
        <p className="eyebrow">Your composition</p>
        <p className="display mt-1 text-[2rem]">{p.name}</p>
        <p className="tabular text-[12px] tracking-[0.1em] text-taupe-ink">{p.reference}</p>
      </div>

      <ul className="divide-y divide-line border-y border-line">
        {SLOT_ORDER.filter((s) => byKey.has(s)).map((s) => {
          const l = byKey.get(s)!;
          return (
            <li key={s} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="eyebrow">{SLOT_LABEL[s]}</p>
                <p className="text-[13.5px]">{l.name}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="tabular text-[13px]">{formatEGP(l.amountMinor)}</span>
                <button type="button" className="text-[11.5px] text-taupe-ink underline underline-offset-4 hover:text-espresso" onClick={() => p.onEdit(s)}>
                  Edit
                </button>
              </div>
            </li>
          );
        })}
        {p.quote.lines
          .filter((l) => !SLOT_ORDER.includes(l.key as Slot))
          .map((l) => (
            <li key={l.key} className="flex justify-between gap-3 py-3 text-[13.5px]">
              <span>
                <span className="eyebrow block">{l.label}</span>
                {l.name}
              </span>
              <span className="tabular text-[13px]">{formatEGP(l.amountMinor)}</span>
            </li>
          ))}
        <li className="flex justify-between py-4 text-[15px] font-medium">
          <span>Total</span>
          <span className="tabular" data-testid="review-total">
            {formatEGP(p.quote.totalMinor)}
          </span>
        </li>
      </ul>

      <div className="space-y-1.5 bg-cream/70 p-4 text-[13px] leading-relaxed">
        <p className="eyebrow">Availability & assembly</p>
        <p>
          {a.status === "available" && "All parts are in the atelier."}
          {a.status === "made_to_order" && `Some parts are ordered in for your build${a.leadTimeDays ? `, about ${a.leadTimeDays} days` : ""}.`}
          {a.status === "unavailable" && "One or more parts are currently unavailable."}
        </p>
        <p className="text-taupe-ink">{p.assemblyLeadTime ?? "Assembly timing is confirmed with you by the atelier after you order."}</p>
        {a.notes.map((n) => (
          <p key={n} className="text-[12px] text-taupe-ink">
            {n}
          </p>
        ))}
      </div>

      {!p.validation.ok && (
        <div role="alert" className="border border-err/40 p-4 text-[13px] text-err">
          This composition cannot be ordered yet:
          <ul className="mt-1 list-disc pl-5">
            {p.validation.issues.slice(0, 3).map((i) => (
              <li key={i.ruleId + i.ids.join()}>{i.message}</li>
            ))}
            {p.validation.missing.map((m) => (
              <li key={m}>Choose a {SLOT_LABEL[m].toLowerCase()}.</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-2">
        <button type="button" className="btn btn-primary w-full" disabled={!p.canOrder} onClick={p.onAdd} data-testid="review-add">
          {p.editing ? "Update bag" : "Add to bag"}
        </button>
        {!p.checkoutOpen && <p className="text-center text-[12px] text-taupe-ink">Ordering is paused at the moment. You can still save and share your composition.</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-outline" onClick={p.onSave} data-testid="save-design">
            Save this design
          </button>
          <button type="button" className="btn btn-outline" onClick={p.onShare} data-testid="share-build">
            Share this build
          </button>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button type="button" className="btn btn-ghost" onClick={p.onDownload}>
            Download image
          </button>
          <button type="button" className="btn btn-ghost" onClick={p.onReset}>
            Start again
          </button>
        </div>
        <Link href="/saved" className="text-center text-[12px] text-taupe-ink underline underline-offset-4">
          View saved compositions
        </Link>
      </div>

      <p className="text-[11.5px] leading-relaxed text-taupe-ink">
        The preview is an illustration drawn from each part&rsquo;s recorded dimensions; finishes and colours of the real parts may differ. Built in the NIVORÉ atelier around a third-party automatic movement; NIVORÉ is independent and not affiliated with the movement maker.
      </p>
    </div>
  );
}
