"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { formatEGP } from "@/domain/money";
import { useBag } from "@/lib/cart";
import { cn } from "@/lib/cn";
import {
  buildName,
  buildReference,
  defaultBuild,
  encodeBuild,
  familyOf,
  handsPrice,
  layersOf,
  partsTotalEgp,
  partSrc,
  type FamilyInfo,
  type PartsCatalog,
  type PhotoBuild,
} from "@/lib/parts";
import { useSaved } from "@/lib/saved";
import { Stage } from "./Stage";
import { AnimatedPrice, Dialog, OptionCard, StepTrack, Toast } from "./ui";

export interface BuilderProps {
  catalog: PartsCatalog;
  assemblyMinor: number;
  initial: PhotoBuild;
  fromUrl: boolean;
  editItemId: string | null;
  checkoutOpen: boolean;
}

type StepId = "model" | "case" | "bezel" | "dial" | "hands" | "band" | "review";

const STEP_COPY: Record<StepId, { title: string; verb: string; narrative: string; camera: number }> = {
  model: { title: "Model", verb: "Choose the watch", narrative: "Each model has its own case, dial and hands. The movement is fixed by the model.", camera: 1 },
  case: { title: "Case", verb: "Set its proportion", narrative: "Diameter and lug-to-lug decide how the watch sits on your wrist.", camera: 1 },
  bezel: { title: "Bezel", verb: "Frame the dial", narrative: "The ring around the crystal.", camera: 1.1 },
  dial: { title: "Dial", verb: "Choose its face", narrative: "Colour, texture and markers. The dial is what you will look at most.", camera: 1.28 },
  hands: { title: "Hands", verb: "Draw the hands", narrative: "Shape and finish change how quickly the time reads.", camera: 1.32 },
  band: { title: "Bracelet / strap", verb: "Fit it to the wrist", narrative: "Steel, leather or rubber, cut to the case's lug width.", camera: 0.9 },
  review: { title: "Review", verb: "Your composition", narrative: "Every part and its price. Edit any step without losing the rest.", camera: 0.94 },
};

const stepsFor = (f: FamilyInfo): StepId[] => ["model", "case", ...(f.bezel.length ? (["bezel"] as const) : []), "dial", "hands", "band", "review"];

/** How a part's 1024 px canvas is zoomed inside a square thumbnail. */
const THUMB: Record<string, { scale: number; origin: string; shift?: string }> = {
  case: { scale: 1.1, origin: "50% 50%" },
  bezel: { scale: 1.1, origin: "50% 50%" },
  dial: { scale: 1.8, origin: "50% 50%" },
  hands: { scale: 3.4, origin: "50% 38%" },
  // bracelets/straps are 1024 x 2560: show the upper half (end link and strap) filling the square
  band: { scale: 2.2, origin: "50% 25%", shift: "translateY(25%)" },
};

function PartThumb({ id, kind }: { id: string; kind: keyof typeof THUMB }) {
  const t = THUMB[kind];
  const style: CSSProperties = { transform: `${t.shift ?? ""} scale(${t.scale})`.trim(), transformOrigin: t.origin };
  // eslint-disable-next-line @next/next/no-img-element -- the part's own 1024 px webp, zoomed with CSS
  return <img src={partSrc(id)} alt="" width={1024} height={kind === "band" ? 2560 : 1024} loading="lazy" decoding="async" draggable={false} className="absolute inset-[4%] h-[92%] w-[92%] object-contain" style={style} />;
}

export function Builder({ catalog, assemblyMinor, initial, fromUrl, editItemId, checkoutOpen }: BuilderProps) {
  const [build, setBuild] = useState<PhotoBuild>(initial);
  const family = familyOf(catalog, build.family)!;
  const steps = useMemo(() => stepsFor(family), [family]);
  const [step, setStep] = useState(fromUrl ? steps.length - 1 : 0);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([fromUrl ? steps.length - 1 : 0]));
  const [toast, setToast] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState(false);
  const [sheet, setSheet] = useState<"peek" | "full">("peek");
  const [confirmReset, setConfirmReset] = useState(false);
  const [live, setLive] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const addToBag = useBag((s) => s.add);
  const replaceInBag = useBag((s) => s.replace);
  const hydrateBag = useBag((s) => s.hydrate);
  const saveDesign = useSaved((s) => s.save);
  const hydrateSaved = useSaved((s) => s.hydrate);

  const layers = useMemo(() => layersOf(catalog, build), [catalog, build]);
  const partsEgp = useMemo(() => partsTotalEgp(catalog, build), [catalog, build]);
  const totalMinor = partsEgp * 100 + assemblyMinor;
  const name = buildName(catalog, build);
  const reference = useMemo(() => buildReference(build), [build]);
  const encoded = useMemo(() => encodeBuild(build), [build]);
  const stepId = steps[Math.min(step, steps.length - 1)];
  const copy = STEP_COPY[stepId];

  useEffect(() => {
    hydrateBag();
    hydrateSaved();
  }, [hydrateBag, hydrateSaved]);

  // Preload every image of the current family so swaps are instant.
  useEffect(() => {
    const ids = new Set<string>([...family.case, ...family.bezel, ...family.dial, ...family.band, ...family.hands.flatMap((h) => [h.hour, h.minute, h.second])]);
    if (family.ring) ids.add(family.ring);
    if (family.gmt) ids.add(family.gmt);
    for (const id of ids) new Image().src = partSrc(id);
  }, [family]);

  // Keep the address bar shareable and refresh-safe.
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams({ b: encoded });
      if (editItemId) params.set("edit", editItemId);
      window.history.replaceState(null, "", `/build?${params.toString()}`);
    }, 250);
    return () => clearTimeout(t);
  }, [encoded, editItemId]);

  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(steps.length - 1, i));
      setStep(next);
      setVisited((v) => new Set(v).add(next));
      setBreakdown(false);
      panelRef.current?.scrollTo({ top: 0 });
    },
    [steps.length],
  );

  const pick = (key: "case" | "bezel" | "dial" | "hands" | "band", id: string) => setBuild((b) => ({ ...b, [key]: id }));
  const chooseFamily = (f: FamilyInfo) => {
    if (f.id !== build.family) setBuild(defaultBuild(f));
  };

  function handleAddToBag() {
    const item = {
      kind: "custom" as const,
      build,
      layers,
      name,
      detail: [family.movement, catalog.parts[build.case]?.label].filter(Boolean).join(" · "),
      buildRef: reference,
      quantity: 1,
      displayMinor: totalMinor,
    };
    if (editItemId) {
      replaceInBag(editItemId, item);
      setToast("Your bag has been updated.");
    } else {
      addToBag(item);
      setToast("Added to your bag.");
    }
  }

  function handleSave() {
    saveDesign({ ref: reference, name, build, layers, query: `b=${encoded}`, savedAt: new Date().toISOString(), totalMinorAtSave: totalMinor });
    setToast("Saved on this device. Find it under Saved compositions.");
  }

  async function handleShare() {
    const url = `${window.location.origin}/build?b=${encoded}`;
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: `NIVORÉ · ${name}`, text: `My NIVORÉ composition, ${reference}`, url });
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
      const { downloadBuildImage } = await import("./exportImage");
      await downloadBuildImage(layers, { name, reference });
    } catch {
      setToast("The image could not be created in this browser.");
    }
  }

  const cards = (items: { id: string; title: string; thumb: ReactNode; price: number; selected: boolean; onSelect: () => void }[]) => (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
      {items.map((o) => (
        <li key={o.id}>
          <OptionCard testId={`opt-${o.id}`} selected={o.selected} onSelect={o.onSelect} thumb={o.thumb} title={o.title} priceEgp={o.price} />
        </li>
      ))}
    </ul>
  );

  const part = (id: string) => catalog.parts[id];
  const single = (key: "case" | "bezel" | "dial" | "band", ids: string[], kind: keyof typeof THUMB) =>
    cards(ids.map((id) => ({ id, title: part(id).label, thumb: <PartThumb id={id} kind={kind} />, price: part(id).priceEgp, selected: build[key] === id, onSelect: () => pick(key, id) })));

  const liveFamilies = catalog.families.filter((f) => f.live);
  const greyed = [...new Set([...catalog.families.filter((f) => !f.live).map((f) => f.name), ...catalog.comingSoon])].filter((n) => !liveFamilies.some((f) => f.name === n));

  const body = (() => {
    switch (stepId) {
      case "model":
        return (
          <div className="space-y-5">
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {liveFamilies.map((f) => (
                <li key={f.id}>
                  <OptionCard testId={`family-${f.id}`} selected={build.family === f.id} onSelect={() => chooseFamily(f)} thumb={<PartThumb id={f.case[0]} kind="case" />} title={f.name} meta={`Movement ${f.movement}`} priceEgp={null} />
                </li>
              ))}
            </ul>
            {greyed.length > 0 && (
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3" aria-label="Coming soon">
                {greyed.map((n) => (
                  <li key={n}>
                    <OptionCard selected={false} disabled onSelect={() => {}} title={n} reason="Coming soon" priceEgp={null} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      case "case":
        return single("case", family.case, "case");
      case "bezel":
        return single("bezel", family.bezel, "bezel");
      case "dial":
        return single("dial", family.dial, "dial");
      case "hands":
        return cards(family.hands.map((h) => ({ id: h.id, title: h.label, thumb: <PartThumb id={h.minute} kind="hands" />, price: handsPrice(catalog, h), selected: build.hands === h.id, onSelect: () => pick("hands", h.id) })));
      case "band":
        return single("band", family.band, "band");
      case "review":
        return null;
    }
  })();

  // Review rows: label, part name, price (EGP)
  const hands = family.hands.find((h) => h.id === build.hands)!;
  const rows: { label: string; name: string; price: number; step?: StepId }[] = [
    { label: "Model", name: `${family.name} · ${family.movement}`, price: 0, step: "model" },
    { label: "Case", name: part(build.case).label, price: part(build.case).priceEgp, step: "case" },
    ...(build.bezel ? [{ label: "Bezel", name: part(build.bezel).label, price: part(build.bezel).priceEgp, step: "bezel" as const }] : []),
    { label: "Dial", name: part(build.dial).label, price: part(build.dial).priceEgp, step: "dial" },
    ...(family.ring ? [{ label: "Chapter ring", name: part(family.ring).label, price: part(family.ring).priceEgp }] : []),
    { label: "Hands", name: hands.label, price: handsPrice(catalog, hands), step: "hands" },
    ...(family.gmt ? [{ label: "GMT hand", name: part(family.gmt).label, price: part(family.gmt).priceEgp }] : []),
    { label: "Bracelet / strap", name: part(build.band).label, price: part(build.band).priceEgp, step: "band" },
  ];
  const isReview = stepId === "review";

  const priceLines = (
    <dl className="space-y-1.5 text-[13px]">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-4">
          <dt className="min-w-0 truncate">
            <span className="text-taupe-ink">{r.label}</span> · {r.name}
          </dt>
          <dd className="tabular shrink-0">{formatEGP(r.price * 100)}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-4">
        <dt>
          <span className="text-taupe-ink">Assembly</span> · Atelier assembly and regulation check
        </dt>
        <dd className="tabular shrink-0">{formatEGP(assemblyMinor)}</dd>
      </div>
      <div className="flex justify-between gap-4 border-t border-line pt-2 font-medium">
        <dt>Total</dt>
        <dd className="tabular">{formatEGP(totalMinor)}</dd>
      </div>
      <p className="pt-1 text-[11.5px] text-taupe-ink">Delivery is calculated at checkout. Prices are confirmed by the atelier&rsquo;s server when you order.</p>
    </dl>
  );

  return (
    <div className="flex h-[calc(100dvh-3.25rem)] flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(400px,460px)]">
      {/* Stage */}
      <section className="relative min-h-0 flex-1 overflow-hidden bg-cream" aria-label="Watch preview">
        <div className="pointer-events-none absolute left-5 top-4 z-10 md:left-8 md:top-6">
          <p className="eyebrow hidden lg:block">Composition</p>
          <p className="display text-[1.35rem] md:text-[2rem]" data-testid="build-name">
            {name}
          </p>
          <p className="tabular text-[11px] tracking-[0.12em] text-taupe-ink" data-testid="build-ref">
            {reference}
          </p>
        </div>
        <div className="absolute inset-0">
          <Stage layers={layers} camera={copy.camera} live={live} label={`${name}, illustrative rendering`} />
        </div>
        <div className="absolute bottom-3 right-4 z-10 md:bottom-6 md:right-8">
          <button
            type="button"
            className={cn("min-h-8 rounded-full border px-3.5 text-[11px] tracking-[0.06em] transition-colors", live ? "border-espresso bg-espresso text-ivory" : "border-line bg-ivory/70 text-espresso backdrop-blur hover:border-line-strong")}
            aria-pressed={live}
            onClick={() => setLive((v) => !v)}
            data-testid="live-time"
          >
            Live time
          </button>
        </div>
      </section>

      {/* Panel */}
      <aside
        className={cn("relative z-20 flex min-h-0 flex-col border-t border-line bg-ivory shadow-[0_-12px_32px_-24px_rgba(58,50,46,0.5)] transition-[height] duration-500 lg:h-auto lg:border-l lg:border-t-0 lg:shadow-none", sheet === "full" ? "h-[58dvh]" : "h-[48dvh]")}
        style={{ transitionTimingFunction: "var(--ease-settle)" }}
        aria-label="Customise"
      >
        <button type="button" className="flex h-5 w-full shrink-0 items-center justify-center lg:hidden" aria-label={sheet === "full" ? "Show more of the watch" : "Expand options"} aria-expanded={sheet === "full"} onClick={() => setSheet((s) => (s === "full" ? "peek" : "full"))}>
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </button>
        <div className="shrink-0 px-5 pb-3 lg:px-8 lg:pb-5 lg:pt-7">
          <StepTrack steps={steps.map((id, i) => ({ id, index: String(i + 1).padStart(2, "0"), title: STEP_COPY[id].title }))} current={step} visited={visited} onJump={goTo} />
          <div className="mt-3 flex items-baseline justify-between gap-4 lg:mt-5">
            <h2 className="flex items-baseline gap-3">
              <span className="serif whitespace-nowrap text-sm font-light text-taupe-ink tabular">N° {String(step + 1).padStart(2, "0")}</span>
              <span className="display text-[1.6rem] lg:text-[2.1rem]">{copy.title}</span>
            </h2>
            <span className="eyebrow hidden sm:inline">{copy.verb}</span>
          </div>
          <p className="mt-1.5 hidden text-[13px] leading-relaxed text-taupe-ink lg:block">{copy.narrative}</p>
          {stepId !== "model" && (
            <p className="mt-2 text-[12px] text-taupe-ink" data-testid="movement">
              <span className="eyebrow">Movement</span> <span className="ml-1 text-espresso">{family.movement}</span> · fixed by the model
            </p>
          )}
        </div>

        <div ref={panelRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 lg:px-8" key={stepId} style={{ animation: "fade-up 360ms var(--ease-settle) both" }}>
          {isReview ? (
            <div className="space-y-7" data-testid="review">
              <div>
                <p className="eyebrow">Your composition</p>
                <p className="display mt-1 text-[2rem]">{name}</p>
                <p className="tabular text-[12px] tracking-[0.1em] text-taupe-ink">{reference}</p>
              </div>
              <ul className="divide-y divide-line border-y border-line">
                {rows.map((r) => (
                  <li key={r.label} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="eyebrow">{r.label}</p>
                      <p className="text-[13.5px]">{r.name}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="tabular text-[13px]">{formatEGP(r.price * 100)}</span>
                      {r.step && steps.includes(r.step) && (
                        <button type="button" className="text-[11.5px] text-taupe-ink underline underline-offset-4 hover:text-espresso" onClick={() => goTo(steps.indexOf(r.step!))}>
                          Edit
                        </button>
                      )}
                    </div>
                  </li>
                ))}
                <li className="flex justify-between gap-3 py-3 text-[13.5px]">
                  <span>
                    <span className="eyebrow block">Assembly</span>Atelier assembly and regulation check
                  </span>
                  <span className="tabular text-[13px]">{formatEGP(assemblyMinor)}</span>
                </li>
                <li className="flex justify-between py-4 text-[15px] font-medium">
                  <span>Total</span>
                  <span className="tabular" data-testid="review-total">
                    {formatEGP(totalMinor)}
                  </span>
                </li>
              </ul>
              <div className="grid gap-2">
                <button type="button" className="btn btn-primary w-full" onClick={handleAddToBag} data-testid="review-add">
                  {editItemId ? "Update bag" : "Add to bag"}
                </button>
                {!checkoutOpen && <p className="text-center text-[12px] text-taupe-ink">Ordering is paused at the moment. You can still save and share your composition.</p>}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="btn btn-outline" onClick={handleSave} data-testid="save-design">
                    Save this design
                  </button>
                  <button type="button" className="btn btn-outline" onClick={handleShare} data-testid="share-build">
                    Share this build
                  </button>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <button type="button" className="btn btn-ghost" onClick={handleDownload}>
                    Download image
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(true)}>
                    Start again
                  </button>
                </div>
                <Link href="/saved" className="text-center text-[12px] text-taupe-ink underline underline-offset-4">
                  View saved compositions
                </Link>
              </div>
              <p className="text-[11.5px] leading-relaxed text-taupe-ink">
                The preview is an illustration composed from photographs of each part; finishes and colours of the real parts may differ. Built in the NIVORÉ atelier around a third-party automatic movement; NIVORÉ is independent and not affiliated with Seiko or the movement maker.
              </p>
            </div>
          ) : (
            body
          )}
        </div>

        <div className="relative shrink-0 border-t border-line bg-ivory px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:px-8 lg:pb-6 lg:pt-4">
          {breakdown && (
            <div id="breakdown" className="absolute inset-x-0 bottom-full max-h-[50dvh] overflow-y-auto border-t border-line bg-ivory px-5 py-4 shadow-[0_-16px_32px_-24px_rgba(58,50,46,0.6)] lg:px-8" style={{ animation: "fade-up 280ms var(--ease-settle) both" }}>
              {priceLines}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <button type="button" className="text-left" aria-expanded={breakdown} aria-controls="breakdown" onClick={() => setBreakdown((b) => !b)}>
              <span className="eyebrow block">Total {breakdown ? "−" : "+"}</span>
              <AnimatedPrice value={totalMinor} className="text-[1.15rem] font-medium lg:text-[1.3rem]" />
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button type="button" className="btn btn-ghost !px-2" onClick={() => goTo(step - 1)}>
                  Back
                </button>
              )}
              {!isReview ? (
                <button type="button" className="btn btn-primary" data-testid="continue" onClick={() => goTo(step + 1)}>
                  {step === steps.length - 2 ? "Review" : "Continue"}
                </button>
              ) : (
                <button type="button" className="btn btn-primary" data-testid="add-to-bag" onClick={handleAddToBag}>
                  {editItemId ? "Update bag" : "Add to bag"}
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title="Start again?">
        <p className="mb-6 text-[14px] text-taupe-ink">Your current composition will be replaced by the first available build. Saved compositions are kept.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-outline" onClick={() => setConfirmReset(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setBuild(defaultBuild(liveFamilies[0]));
              setConfirmReset(false);
              setStep(0);
              setVisited(new Set([0]));
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
