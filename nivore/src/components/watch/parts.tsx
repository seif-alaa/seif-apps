import type { ReactNode } from "react";
import type { ResolvedBuild } from "./geometry";
import {
  annulus,
  CANVAS_H,
  caseGeometry,
  cushionPath,
  CX,
  CY,
  darken,
  f,
  GMT_ANGLE,
  HOUR_ANGLE,
  lighten,
  luminance,
  METAL,
  MINUTE_ANGLE,
  octagonPath,
  polar,
  PX_PER_MM,
  wedges,
  type Tone,
} from "./geometry";

/**
 * Procedural, to-scale part drawings. Each function returns an SVG fragment
 * for one layer. `u` is a unique id prefix so gradients never collide.
 * These are ILLUSTRATIVE: proportions come from recorded dimensions, but
 * finishes and colours are approximations of the real parts.
 */

type B = ResolvedBuild;
const SANS = { fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" } as const;
const SERIF = { fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" } as const;

function MetalGrad({ id, tone, x2 = 1, y2 = 1, x1 = 0, y1 = 0, polished = true }: { id: string; tone: Tone; x1?: number; y1?: number; x2?: number; y2?: number; polished?: boolean }) {
  const m = METAL[tone];
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      <stop offset="0" stopColor={polished ? m.hi : m.light} />
      <stop offset="0.28" stopColor={m.light} />
      <stop offset="0.55" stopColor={m.mid} />
      <stop offset="0.82" stopColor={m.dark} />
      <stop offset="1" stopColor={polished ? m.light : m.mid} />
    </linearGradient>
  );
}

/* ── Shadow ─────────────────────────────────────────────────────────── */

export function Shadow({ b, u }: { b: B; u: string }) {
  const g = caseGeometry(b.case);
  return (
    <g>
      <defs>
        <radialGradient id={`${u}s`}>
          <stop offset="0" stopColor="#2b2420" stopOpacity="0.30" />
          <stop offset="0.6" stopColor="#2b2420" stopOpacity="0.12" />
          <stop offset="1" stopColor="#2b2420" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={CX + 10} cy={CY + 18} rx={g.R * 1.3} ry={g.R * 1.36} fill={`url(#${u}s)`} />
    </g>
  );
}

/* ── Case ───────────────────────────────────────────────────────────── */

export function CaseFront({ b, u, rear = false }: { b: B; u: string; rear?: boolean }) {
  const k = b.case;
  const g = caseGeometry(k);
  const m = METAL[g.tone];
  const brushed = g.finish !== "polished";
  const integrated = k?.spec.bezelSystem === "integrated";
  const lugT = 2.7 * PX_PER_MM;
  const crownAngle = rear ? 270 - g.crownDeg : 90 + g.crownDeg;
  const guards = k?.spec.crownGuards;

  const lugs: ReactNode[] = [];
  if (g.shape === "round") {
    for (const side of [-1, 1]) {
      for (const sx of [-1, 1]) {
        const x0 = CX + sx * (g.lugGap / 2);
        const x1 = x0 + sx * lugT;
        const yA = CY + side * g.R * 0.62;
        const yB = CY + side * g.L;
        const curve = k?.spec.lugStyle === "curved" ? sx * lugT * 0.55 : 0;
        const tip = side * 7;
        const d = `M${f(x0)},${f(yA)} L${f(x0)},${f(yB - tip)} Q${f(x0)},${f(yB)} ${f((x0 + x1) / 2)},${f(yB)} Q${f(x1)},${f(yB)} ${f(x1)},${f(yB - tip)} Q${f(x1 + curve)},${f((yA + yB) / 2)} ${f(x1 + sx * lugT * 0.9)},${f(yA)} Z`;
        lugs.push(
          <g key={`${side}${sx}`}>
            <path d={d} fill={`url(#${u}lug)`} />
            <path d={`M${f((x0 + x1) / 2)},${f(yA)} L${f((x0 + x1) / 2)},${f(yB - tip * 1.6)}`} stroke={m.hi} strokeOpacity="0.55" strokeWidth="1.4" />
          </g>,
        );
      }
    }
  } else {
    // Integrated tabs for cushion and octagon cases.
    for (const side of [-1, 1]) {
      const w = g.lugGap + lugT * 2;
      const yA = CY + side * g.R * 0.7;
      const yB = CY + side * g.L;
      const r = 9;
      const top = Math.min(yA, yB);
      const h = Math.abs(yB - yA);
      lugs.push(
        <g key={side}>
          <rect x={CX - w / 2} y={top} width={w} height={h} rx={r} fill={`url(#${u}lug)`} />
          <rect x={CX - g.lugGap / 2} y={side < 0 ? yB - 1 : yB - 15} width={g.lugGap} height={16} fill={m.deep} opacity="0.55" />
        </g>,
      );
    }
  }

  const body =
    g.shape === "cushion" ? (
      <path d={cushionPath(g.R * 0.95, g.R * 0.46)} fill={`url(#${u}body)`} />
    ) : g.shape === "octagon" ? (
      <path d={octagonPath(g.R * 1.05)} fill={`url(#${u}body)`} strokeLinejoin="round" stroke={m.dark} strokeWidth="1" />
    ) : (
      <circle cx={CX} cy={CY} r={g.R} fill={`url(#${u}body)`} />
    );

  return (
    <g>
      <defs>
        <MetalGrad id={`${u}body`} tone={g.tone} polished={!brushed} />
        <linearGradient id={`${u}lug`} x1="0" x2="1">
          <stop offset="0" stopColor={m.dark} />
          <stop offset="0.35" stopColor={m.light} />
          <stop offset="0.6" stopColor={m.mid} />
          <stop offset="1" stopColor={m.dark} />
        </linearGradient>
        <linearGradient id={`${u}crown`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={m.light} />
          <stop offset="0.5" stopColor={m.mid} />
          <stop offset="1" stopColor={m.deep} />
        </linearGradient>
        <radialGradient id={`${u}bevel`} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor={m.hi} />
          <stop offset="0.5" stopColor={m.mid} />
          <stop offset="1" stopColor={m.deep} />
        </radialGradient>
        {brushed && (
          <pattern id={`${u}brush`} width="6" height="3" patternUnits="userSpaceOnUse">
            <rect width="6" height="1" fill="#fff" opacity="0.07" />
            <rect y="1.5" width="6" height="0.8" fill="#000" opacity="0.05" />
          </pattern>
        )}
        <clipPath id={`${u}clip`}>{body}</clipPath>
      </defs>
      {lugs}
      {/* Crown and guards, behind the case edge */}
      <g transform={`rotate(${crownAngle - 90} ${CX} ${CY})`}>
        {guards && (
          <path
            d={`M${CX + g.R - 14},${CY - 46} Q${CX + g.R + 22},${CY - 40} ${CX + g.R + 20},${CY - 20} L${CX + g.R + 20},${CY + 20} Q${CX + g.R + 22},${CY + 40} ${CX + g.R - 14},${CY + 46} Z`}
            fill={`url(#${u}crown)`}
          />
        )}
        <rect x={CX + g.R - 6} y={CY - 10} width={14} height={20} fill={m.dark} />
        <rect x={CX + g.R + 6} y={CY - 33} width={30} height={66} rx={7} fill={`url(#${u}crown)`} />
        <path
          d={Array.from({ length: 11 }, (_, i) => `M${CX + g.R + 9},${CY - 28 + i * 5.6}h24`).join("")}
          stroke={m.deep}
          strokeOpacity="0.45"
          strokeWidth="1.4"
        />
      </g>
      {body}
      {brushed && <rect x={CX - g.R * 1.2} y={CY - g.R * 1.2} width={g.R * 2.4} height={g.R * 2.4} fill={`url(#${u}brush)`} clipPath={`url(#${u}clip)`} />}
      {/* Polished outer bevel */}
      {g.shape === "round" && <circle cx={CX} cy={CY} r={g.R - 2.5} fill="none" stroke={m.hi} strokeOpacity="0.5" strokeWidth="2" />}
      {integrated && !rear && (
        <g>
          <circle cx={CX} cy={CY} r={g.crystalR + 16} fill={`url(#${u}bevel)`} />
          <circle cx={CX} cy={CY} r={g.crystalR + 16} fill="none" stroke={m.deep} strokeOpacity="0.35" strokeWidth="1" />
        </g>
      )}
      {!rear && (
        <>
          {/* Flange (inner wall) below the crystal */}
          <path d={annulus(g.dialR - 1, g.crystalR + 1.5)} fill={darken(m.mid, 0.1)} fillRule="evenodd" />
          <circle cx={CX} cy={CY} r={g.crystalR + 1.5} fill="none" stroke={m.deep} strokeOpacity="0.6" strokeWidth="2" />
        </>
      )}
    </g>
  );
}

/* ── Bezel ──────────────────────────────────────────────────────────── */

export function BezelFront({ b, u }: { b: B; u: string }) {
  const z = b.bezel;
  if (!z) return null;
  const g = caseGeometry(b.case);
  const tone = z.spec.tone as Tone;
  const m = METAL[tone];
  const dive = z.spec.bezelSystem === "dive-120";
  const outer = g.R + (dive ? 3.5 : 0.5);
  const inner = dive && z.spec.insertOuterMm ? (z.spec.insertOuterMm / 2) * PX_PER_MM - 1 : g.crystalR + 1;

  let edge: ReactNode = null;
  if (z.spec.style === "coin-edge") {
    const ticks = Array.from({ length: 120 }, (_, i) => {
      const [x1, y1] = polar(outer - 0.5, i * 3);
      const [x2, y2] = polar(outer - 6, i * 3);
      return `M${f(x1)},${f(y1)}L${f(x2)},${f(y2)}`;
    }).join("");
    edge = <path d={ticks} stroke={m.deep} strokeOpacity="0.55" strokeWidth="1.3" />;
  } else if (z.spec.style === "fluted") {
    const lights = Array.from({ length: 48 }, (_, i) => i * 7.5);
    edge = (
      <g clipPath={`url(#${u}ring)`}>
        <path d={wedges(outer + 2, lights, 3.75)} fill={m.hi} opacity="0.55" />
        <path d={wedges(outer + 2, lights.map((a) => a + 3.75), 3.75)} fill={m.deep} opacity="0.4" />
      </g>
    );
  }
  let ring = annulus(inner, outer);
  if (z.spec.style === "scalloped") {
    const pts = Array.from({ length: 360 }, (_, i) => {
      const r = outer - 3.2 * (0.5 + 0.5 * Math.cos((i * Math.PI * 2 * 24) / 360));
      return polar(r, i);
    });
    ring = `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join("L")}Z M${f(CX - inner)},${CY}a${inner},${inner} 0 1,1 ${f(2 * inner)},0a${inner},${inner} 0 1,1 ${f(-2 * inner)},0Z`;
  }

  return (
    <g>
      <defs>
        <linearGradient id={`${u}bz`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={m.hi} />
          <stop offset="0.3" stopColor={m.light} />
          <stop offset="0.5" stopColor={m.dark} />
          <stop offset="0.7" stopColor={m.light} />
          <stop offset="1" stopColor={m.dark} />
        </linearGradient>
        <clipPath id={`${u}ring`}>
          <path d={ring} fillRule="evenodd" />
        </clipPath>
      </defs>
      <path d={ring} fill={`url(#${u}bz)`} fillRule="evenodd" />
      {edge}
      <circle cx={CX} cy={CY} r={inner + 0.5} fill="none" stroke={m.deep} strokeOpacity="0.5" strokeWidth="1.2" />
      <circle cx={CX} cy={CY} r={outer - 1} fill="none" stroke={m.hi} strokeOpacity="0.45" strokeWidth="1" />
    </g>
  );
}

export function InsertFront({ b, u }: { b: B; u: string }) {
  const i = b.insert;
  if (!i) return null;
  const g = caseGeometry(b.case);
  const r2 = (i.spec.outerMm / 2) * PX_PER_MM - 1.5;
  const r1 = Math.max(g.crystalR + 1, r2 - 34);
  const mid = (r1 + r2) / 2;
  const num = i.spec.numeralHex;
  const ceramic = i.spec.material !== "aluminium";
  const items: ReactNode[] = [];
  const txt = (label: string, deg: number, size: number, key: string) => {
    const [x, y] = polar(mid, deg);
    items.push(
      <text key={key} x={f(x)} y={f(y)} fill={num} fontSize={size} fontWeight={500} textAnchor="middle" dominantBaseline="central" transform={`rotate(${deg} ${f(x)} ${f(y)})`} style={SANS}>
        {label}
      </text>,
    );
  };
  const bar = (deg: number, len: number, w: number, key: string) => {
    const [x1, y1] = polar(mid - len / 2, deg);
    const [x2, y2] = polar(mid + len / 2, deg);
    items.push(<line key={key} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} stroke={num} strokeWidth={w} />);
  };
  const triangle = (deg: number) => {
    const s = 11;
    const [tx, ty] = polar(r1 + 6, deg);
    const [ax, ay] = polar(r2 - 6, deg - 3.4);
    const [bx, by] = polar(r2 - 6, deg + 3.4);
    items.push(<path key="tri" d={`M${f(tx)},${f(ty)}L${f(ax)},${f(ay)}L${f(bx)},${f(by)}Z`} fill={num} />);
    if (i.spec.lumePip) {
      const [px, py] = polar(r2 - 12, deg);
      items.push(<circle key="pip" cx={f(px)} cy={f(py)} r={s / 3} fill="#efe9cf" stroke={darken(num, 0.4)} strokeWidth="0.8" />);
    }
  };

  if (i.spec.scale === "dive-60" || i.spec.scale === "countdown") {
    triangle(0);
    for (let m = 1; m < 60; m++) {
      const deg = m * 6;
      if (m % 10 === 0) txt(String(i.spec.scale === "countdown" ? 60 - m : m), deg, 23, `n${m}`);
      else if (m % 5 === 0) bar(deg, 18, 5, `b${m}`);
      else if (m < 15) bar(deg, 9, 1.8, `t${m}`);
    }
  } else if (i.spec.scale === "gmt-24") {
    triangle(0);
    for (let h = 1; h < 24; h++) {
      const deg = h * 15;
      if (h % 2 === 0) txt(String(h), deg, 19, `g${h}`);
      else {
        const [x, y] = polar(mid, deg);
        items.push(<circle key={`d${h}`} cx={f(x)} cy={f(y)} r={2.6} fill={num} />);
      }
    }
  } else {
    triangle(0);
    for (let h = 1; h < 12; h++) bar(h * 30, 14, h % 3 === 0 ? 4 : 2, `m${h}`);
  }

  return (
    <g>
      <defs>
        <clipPath id={`${u}top`}>
          <rect x="0" y="0" width="600" height={CY} />
        </clipPath>
        <radialGradient id={`${u}gloss`} cx="0.3" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity={ceramic ? 0.28 : 0.08} />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={annulus(r1, r2)} fill={i.spec.colorHex} fillRule="evenodd" />
      {i.spec.secondaryHex && <path d={annulus(r1, r2)} fill={i.spec.secondaryHex} fillRule="evenodd" clipPath={`url(#${u}top)`} />}
      <path d={annulus(r1, r2)} fill={`url(#${u}gloss)`} fillRule="evenodd" />
      {items}
      <circle cx={CX} cy={CY} r={r1} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="1.2" />
    </g>
  );
}

/* ── Chapter ring ───────────────────────────────────────────────────── */

export function ChapterRingFront({ b, u }: { b: B; u: string }) {
  const r = b.chapterRing;
  if (!r) return null;
  const g = caseGeometry(b.case);
  const r1 = g.dialR - 1;
  const r2 = g.crystalR + 1;
  const marks: ReactNode[] = [];
  if (r.spec.markings !== "plain") {
    let d = "";
    for (let i = 0; i < 60; i++) {
      const long = i % 5 === 0;
      const [x1, y1] = polar(r1 + 2, i * 6);
      const [x2, y2] = polar(r1 + (long ? 9 : 5.5), i * 6);
      d += `M${f(x1)},${f(y1)}L${f(x2)},${f(y2)}`;
    }
    marks.push(<path key="t" d={d} stroke={r.spec.printHex} strokeWidth="1.2" strokeOpacity="0.85" />);
    if (r.spec.markings === "numerals") {
      for (let i = 1; i <= 12; i++) {
        const [x, y] = polar(r2 - 4.5, i * 30);
        marks.push(
          <text key={i} x={f(x)} y={f(y)} fontSize="6.5" fill={r.spec.printHex} textAnchor="middle" dominantBaseline="central" transform={`rotate(${i * 30} ${f(x)} ${f(y)})`} style={SANS}>
            {i * 5}
          </text>,
        );
      }
    }
  }
  return (
    <g>
      <defs>
        <radialGradient id={`${u}cr`} cx="0.5" cy="0.5" r="0.5">
          <stop offset={(r1 / r2).toFixed(3)} stopColor={darken(r.spec.colorHex, 0.18)} />
          <stop offset="1" stopColor={lighten(r.spec.colorHex, 0.08)} />
        </radialGradient>
      </defs>
      <path d={annulus(r1, r2)} fill={`url(#${u}cr)`} fillRule="evenodd" />
      {marks}
    </g>
  );
}

/* ── Dial ───────────────────────────────────────────────────────────── */

function dateWheelColors(b: B) {
  const black = b.movement?.spec.dateWheel === "black";
  return { bg: black ? "#1c1b1a" : "#f4f1ea", fg: black ? "#ece8df" : "#1d1b1a" };
}

export function datePlacement(b: B) {
  const rd = ((b.dial?.spec.diameterMm ?? 28.5) / 2) * PX_PER_MM;
  const dayDate = b.dial?.spec.dateWindow === "day-date";
  const w = dayDate ? 84 : 36;
  const h = 30;
  const cxw = CX + rd * (dayDate ? 0.6 : 0.71);
  return { x: cxw - w / 2, y: CY - h / 2, w, h, cx: cxw, dayDate };
}

export function DialFront({ b, u }: { b: B; u: string }) {
  const d = b.dial;
  if (!d) return null;
  const s = d.spec;
  const rd = (s.diameterMm / 2) * PX_PER_MM;
  const base = s.colorHex;
  const dark = luminance(base) < 0.18;
  const markerTone = s.markerTone as Tone;
  const mt = METAL[markerTone];
  const hasDate = s.dateWindow !== "none";
  const skip3 = hasDate;

  /* Texture */
  let texture: ReactNode = null;
  if (s.texture === "sunburst") {
    const buckets: number[][] = [[], [], [], []];
    const darkW: number[] = [];
    for (let a = 0; a < 360; a += 2) {
      const v = Math.round(Math.cos(((a - 35) * Math.PI * 2) / 180) * 1e6) / 1e6;
      const k = Math.min(3, Math.max(0, Math.floor((v + 1) * 2)));
      if (a % 4 === 0) buckets[k].push(a);
      else if (v < -0.2) darkW.push(a);
    }
    const ops = [0.015, 0.04, 0.08, 0.15];
    texture = (
      <g clipPath={`url(#${u}dc)`}>
        {buckets.map((angles, i) => (
          <path key={i} d={wedges(rd + 2, angles, 2)} fill="#fff" opacity={ops[i] * (dark ? 0.9 : 1.05)} />
        ))}
        <path d={wedges(rd + 2, darkW, 2)} fill="#000" opacity={dark ? 0.12 : 0.05} />
      </g>
    );
  } else if (s.texture === "linen") {
    texture = <circle cx={CX} cy={CY} r={rd} fill={`url(#${u}lin)`} />;
  } else if (s.texture === "grained") {
    texture = <circle cx={CX} cy={CY} r={rd} fill={`url(#${u}grn)`} />;
  } else if (s.texture === "lacquer") {
    texture = <ellipse cx={CX - rd * 0.35} cy={CY - rd * 0.45} rx={rd * 0.75} ry={rd * 0.4} fill={`url(#${u}spec)`} transform={`rotate(-28 ${CX} ${CY})`} />;
  } else if (s.texture === "stone") {
    texture = (
      <g clipPath={`url(#${u}dc)`} opacity="0.55">
        <circle cx={CX - rd * 0.4} cy={CY - rd * 0.3} r={rd * 0.9} fill={`url(#${u}p1)`} />
        <circle cx={CX + rd * 0.45} cy={CY + rd * 0.2} r={rd * 0.85} fill={`url(#${u}p2)`} />
        <circle cx={CX - rd * 0.1} cy={CY + rd * 0.55} r={rd * 0.7} fill={`url(#${u}p3)`} />
      </g>
    );
  }

  /* Printed minute track */
  let track = "";
  for (let i = 0; i < 60; i++) {
    if (s.markers === "minimal" && i % 5 !== 0) continue;
    const [x1, y1] = polar(rd * 0.945, i * 6);
    const [x2, y2] = polar(rd * (i % 5 === 0 ? 0.885 : 0.915), i * 6);
    track += `M${f(x1)},${f(y1)}L${f(x2)},${f(y2)}`;
  }

  /* Markers */
  const markers: ReactNode[] = [];
  const lume = s.lume && s.lumeHex ? s.lumeHex : null;
  const baton = (deg: number, key: string, lenK = 0.16, wMm = 1.1, rK = 0.76, offset = 0) => {
    const len = rd * lenK;
    const w = wMm * PX_PER_MM;
    const y = CY - rd * rK - len / 2;
    markers.push(
      <g key={key} transform={`rotate(${deg} ${CX} ${CY})`}>
        <rect x={CX - w / 2 + offset + 1.2} y={y + 1.8} width={w} height={len} rx={1} fill="#000" opacity="0.22" />
        <rect x={CX - w / 2 + offset} y={y} width={w} height={len} rx={1} fill={`url(#${u}mk)`} />
        {lume && <rect x={CX - w / 2 + offset + 2} y={y + 2.5} width={w - 4} height={len - 5} rx={0.6} fill={lume} />}
      </g>,
    );
  };
  const numeralFill = markerTone === "steel" ? (dark ? "#efeae0" : s.printHex) : luminance(base) < 0.25 ? mt.light : mt.dark;
  const numeral = (label: string, deg: number, key: string, size: number, rK: number, style = SANS, weight = 500) => {
    const [x, y] = polar(rd * rK, deg);
    markers.push(
      <text key={key} x={f(x)} y={f(y)} fontSize={size} fontWeight={weight} fill={numeralFill} textAnchor="middle" dominantBaseline="central" style={style}>
        {label}
      </text>,
    );
  };
  const triangle12 = () => {
    const top = CY - rd * 0.9;
    const h = rd * 0.16;
    const w = rd * 0.15;
    markers.push(
      <g key="tri">
        <path d={`M${CX - w / 2 + 1.2},${top + 1.8}L${CX + w / 2 + 1.2},${top + 1.8}L${CX + 1.2},${top + h + 1.8}Z`} fill="#000" opacity="0.22" />
        <path d={`M${CX - w / 2},${top}L${CX + w / 2},${top}L${CX},${top + h}Z`} fill={`url(#${u}mk)`} />
        {lume && <path d={`M${CX - w / 2 + 4},${top + 2.5}L${CX + w / 2 - 4},${top + 2.5}L${CX},${top + h - 5}Z`} fill={lume} />}
      </g>,
    );
  };

  for (let h = 0; h < 12; h++) {
    const deg = h * 30;
    if (h === 3 && skip3) continue;
    switch (s.markers) {
      case "baton":
        if (h === 0) {
          baton(0, "b0a", 0.18, 1.0, 0.76, -7);
          baton(0, "b0b", 0.18, 1.0, 0.76, 7);
        } else baton(deg, `b${h}`);
        break;
      case "dot":
        if (h === 0) triangle12();
        else if (h === 6 || h === 9 || h === 3) baton(deg, `b${h}`, 0.2, 1.4, 0.74);
        else {
          const [x, y] = polar(rd * 0.8, deg);
          const r = rd * 0.085;
          markers.push(
            <g key={`d${h}`}>
              <circle cx={f(x) + 1.2} cy={f(y) + 1.8} r={r} fill="#000" opacity="0.22" />
              <circle cx={f(x)} cy={f(y)} r={r} fill={`url(#${u}mk)`} />
              <circle cx={f(x)} cy={f(y)} r={r - 2.4} fill={lume ?? (dark ? "#e9e4d8" : "#2b2725")} />
            </g>,
          );
        }
        break;
      case "explorer":
        if (h === 0) triangle12();
        else if (h % 3 === 0) numeral(String(h), deg, `n${h}`, rd * 0.2, 0.72, SANS, 600);
        else baton(deg, `b${h}`, 0.12, 1.0, 0.8);
        break;
      case "arabic":
        if (h % 3 === 0) numeral(String(h === 0 ? 12 : h), deg, `n${h}`, rd * 0.19, 0.72, SANS, 400);
        else baton(deg, `b${h}`, 0.09, 0.8, 0.82);
        break;
      case "roman": {
        const romans = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
        const [x, y] = polar(rd * 0.77, deg);
        markers.push(
          <text key={`r${h}`} x={f(x)} y={f(y)} fontSize={rd * 0.15} fill={numeralFill} textAnchor="middle" dominantBaseline="central" transform={`rotate(${deg} ${f(x)} ${f(y)})`} style={SERIF}>
            {romans[h]}
          </text>,
        );
        break;
      }
      case "minimal": {
        const [x1, y1] = polar(rd * 0.86, deg);
        const [x2, y2] = polar(rd * (h % 3 === 0 ? 0.74 : 0.79), deg);
        markers.push(<line key={`m${h}`} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} stroke={numeralFill} strokeWidth={h % 3 === 0 ? 3 : 1.6} strokeLinecap="round" />);
        break;
      }
    }
  }

  /* Date window */
  let date: ReactNode = null;
  if (hasDate) {
    const p = datePlacement(b);
    const wheel = dateWheelColors(b);
    date = (
      <g>
        <rect x={p.x - 3} y={p.y - 3} width={p.w + 6} height={p.h + 6} rx={2} fill={`url(#${u}mk)`} />
        <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={wheel.bg} />
        <rect x={p.x} y={p.y} width={p.w} height={5} fill="#000" opacity="0.12" />
        <text x={p.cx} y={CY + 1} fontSize={21} fontWeight={600} fill={wheel.fg} textAnchor="middle" dominantBaseline="central" style={SANS} letterSpacing="0.5">
          {p.dayDate ? "WED 16" : "16"}
        </text>
      </g>
    );
  }

  return (
    <g>
      <defs>
        <clipPath id={`${u}dc`}>
          <circle cx={CX} cy={CY} r={rd} />
        </clipPath>
        <radialGradient id={`${u}base`} cx="0.42" cy="0.38" r="0.75">
          <stop offset="0" stopColor={lighten(base, dark ? 0.08 : 0.06)} />
          <stop offset="0.7" stopColor={base} />
          <stop offset="1" stopColor={darken(base, dark ? 0.25 : 0.12)} />
        </radialGradient>
        <MetalGrad id={`${u}mk`} tone={markerTone} x1={0} y1={0} x2={1} y2={0.4} />
        <pattern id={`${u}lin`} width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M0,0.5H4M0.5,0V4" stroke={darken(base, 0.35)} strokeOpacity="0.28" strokeWidth="0.8" />
        </pattern>
        <pattern id={`${u}grn`} width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="2" r="0.7" fill="#000" opacity="0.18" />
          <circle cx="6" cy="1" r="0.5" fill="#fff" opacity="0.3" />
          <circle cx="4" cy="6" r="0.8" fill="#000" opacity="0.12" />
          <circle cx="8" cy="7" r="0.6" fill="#fff" opacity="0.25" />
        </pattern>
        <radialGradient id={`${u}spec`}>
          <stop offset="0" stopColor="#fff" stopOpacity={dark ? 0.22 : 0.4} />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        {(["#f2c9d8", "#c9eadf", "#cfdcf5"] as const).map((c, i) => (
          <radialGradient key={c} id={`${u}p${i + 1}`}>
            <stop offset="0" stopColor={c} />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      <circle cx={CX} cy={CY} r={rd} fill={`url(#${u}base)`} />
      {texture}
      <path d={track} stroke={s.printHex} strokeOpacity="0.6" strokeWidth="1.2" />
      {s.dialText && (
        <text x={CX} y={CY + rd * 0.42} fontSize="10" letterSpacing="2.2" fill={s.printHex} opacity="0.8" textAnchor="middle" style={SANS}>
          {s.dialText.toUpperCase()}
        </text>
      )}
      {markers}
      {date}
      <circle cx={CX} cy={CY} r={rd - 0.5} fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="1" />
    </g>
  );
}

/* ── Hands ──────────────────────────────────────────────────────────── */

type HandKind = "hour" | "minute";

function handShape(style: string, kind: HandKind, rd: number): { body: string; lume?: string; facet?: string } {
  const L = rd * (kind === "hour" ? 0.58 : 0.88);
  const w = rd * (kind === "hour" ? 0.085 : 0.065);
  const x = CX;
  const y = CY;
  const tail = rd * 0.1;
  switch (style) {
    case "dauphine":
      return {
        body: `M${x},${y - L}L${x + w / 2},${y - L * 0.22}L${x},${y + tail * 0.6}L${x - w / 2},${y - L * 0.22}Z`,
        facet: `M${x},${y - L}L${x},${y + tail * 0.6}L${x + w / 2},${y - L * 0.22}Z`,
      };
    case "sword":
      return {
        body: `M${x},${y - L}L${x + w / 2},${y - L * 0.8}L${x + w * 0.38},${y + tail * 0.4}L${x - w * 0.38},${y + tail * 0.4}L${x - w / 2},${y - L * 0.8}Z`,
        lume: `M${x},${y - L + 6}L${x + w / 2 - 2.4},${y - L * 0.8}L${x + w * 0.38 - 2.6},${y - L * 0.16}L${x - w * 0.38 + 2.6},${y - L * 0.16}L${x - w / 2 + 2.4},${y - L * 0.8}Z`,
      };
    case "baton": {
      const bw = w * 0.62;
      return {
        body: `M${x - bw / 2},${y + tail * 0.5}L${x - bw / 2},${y - L + bw / 2}Q${x},${y - L - bw * 0.3} ${x + bw / 2},${y - L + bw / 2}L${x + bw / 2},${y + tail * 0.5}Z`,
        lume: `M${x - bw / 2 + 2.2},${y - L * 0.2}L${x - bw / 2 + 2.2},${y - L + bw}L${x + bw / 2 - 2.2},${y - L + bw}L${x + bw / 2 - 2.2},${y - L * 0.2}Z`,
      };
    }
    case "pencil": {
      const pw = w * 0.5;
      return {
        body: `M${x},${y - L}L${x + pw / 2},${y - L + pw * 2.2}L${x + pw / 2},${y + tail * 0.5}L${x - pw / 2},${y + tail * 0.5}L${x - pw / 2},${y - L + pw * 2.2}Z`,
        facet: `M${x},${y - L}L${x + pw / 2},${y - L + pw * 2.2}L${x + pw / 2},${y + tail * 0.5}L${x},${y + tail * 0.5}Z`,
      };
    }
    case "leaf":
      return {
        body: `M${x},${y - L}C${x + w * 0.85},${y - L * 0.62} ${x + w * 0.6},${y - L * 0.1} ${x},${y + tail * 0.4}C${x - w * 0.6},${y - L * 0.1} ${x - w * 0.85},${y - L * 0.62} ${x},${y - L}Z`,
        facet: `M${x},${y - L}C${x + w * 0.85},${y - L * 0.62} ${x + w * 0.6},${y - L * 0.1} ${x},${y + tail * 0.4}Z`,
      };
    case "syringe": {
      const sw = w * 0.32;
      const bw = w * 0.62;
      return {
        body: `M${x},${y - L}L${x + sw / 2},${y - L * 0.72}L${x + bw / 2},${y - L * 0.68}L${x + bw / 2},${y - L * 0.18}L${x + sw / 2},${y - L * 0.14}L${x + sw / 2},${y + tail * 0.4}L${x - sw / 2},${y + tail * 0.4}L${x - sw / 2},${y - L * 0.14}L${x - bw / 2},${y - L * 0.18}L${x - bw / 2},${y - L * 0.68}L${x - sw / 2},${y - L * 0.72}Z`,
        lume: `M${x - bw / 2 + 2},${y - L * 0.66}L${x + bw / 2 - 2},${y - L * 0.66}L${x + bw / 2 - 2},${y - L * 0.2}L${x - bw / 2 + 2},${y - L * 0.2}Z`,
      };
    }
    case "cathedral": {
      const cw = w * 1.05;
      return {
        body: `M${x},${y - L}L${x + cw * 0.18},${y - L * 0.82}C${x + cw * 0.7},${y - L * 0.7} ${x + cw * 0.6},${y - L * 0.36} ${x + cw * 0.2},${y - L * 0.3}L${x + cw * 0.16},${y + tail * 0.4}L${x - cw * 0.16},${y + tail * 0.4}L${x - cw * 0.2},${y - L * 0.3}C${x - cw * 0.6},${y - L * 0.36} ${x - cw * 0.7},${y - L * 0.7} ${x - cw * 0.18},${y - L * 0.82}Z`,
        lume: `M${x},${y - L * 0.8}C${x + cw * 0.5},${y - L * 0.68} ${x + cw * 0.45},${y - L * 0.42} ${x},${y - L * 0.36}C${x - cw * 0.45},${y - L * 0.42} ${x - cw * 0.5},${y - L * 0.68} ${x},${y - L * 0.8}Z`,
      };
    }
    case "arrow": {
      if (kind === "minute") return handShape("sword", kind, rd);
      const aw = w * 1.5;
      const sw = w * 0.36;
      return {
        body: `M${x},${y - L}L${x + aw / 2},${y - L * 0.66}L${x + sw / 2},${y - L * 0.68}L${x + sw / 2},${y + tail * 0.4}L${x - sw / 2},${y + tail * 0.4}L${x - sw / 2},${y - L * 0.68}L${x - aw / 2},${y - L * 0.66}Z`,
        lume: `M${x},${y - L + 7}L${x + aw / 2 - 5},${y - L * 0.68}L${x - aw / 2 + 5},${y - L * 0.68}Z`,
      };
    }
    default:
      return handShape("baton", kind, rd);
  }
}

export function HandsFront({ b, u }: { b: B; u: string }) {
  const h = b.hands;
  if (!h) return null;
  const rd = ((b.dial?.spec.diameterMm ?? 28.5) / 2) * PX_PER_MM;
  const tone = h.spec.tone as Tone;
  const m = METAL[tone];
  const lume = h.spec.lume && h.spec.lumeHex ? h.spec.lumeHex : null;
  const hand = (kind: HandKind, angle: number) => {
    const s = handShape(h.spec.style, kind, rd);
    return (
      <g key={kind}>
        <g transform={`translate(2.5 4) rotate(${angle} ${CX} ${CY})`} opacity="0.22">
          <path d={s.body} fill="#000" />
        </g>
        <g transform={`rotate(${angle} ${CX} ${CY})`}>
          <path d={s.body} fill={`url(#${u}h)`} stroke={m.deep} strokeOpacity="0.4" strokeWidth="0.6" />
          {s.facet && <path d={s.facet} fill={m.deep} opacity="0.28" />}
          {lume && s.lume && <path d={s.lume} fill={lume} />}
        </g>
      </g>
    );
  };
  let gmt: ReactNode = null;
  if (h.spec.gmtHand && h.spec.gmtHex) {
    const L = rd * 0.86;
    const c = h.spec.gmtHex;
    gmt = (
      <g transform={`rotate(${GMT_ANGLE} ${CX} ${CY})`}>
        <path d={`M${CX - 1.6},${CY}L${CX - 1.6},${CY - L + 26}L${CX + 1.6},${CY - L + 26}L${CX + 1.6},${CY}Z`} fill={c} />
        <path d={`M${CX},${CY - L}L${CX + 11},${CY - L + 28}L${CX - 11},${CY - L + 28}Z`} fill={c} />
        {lume && <path d={`M${CX},${CY - L + 7}L${CX + 6},${CY - L + 24}L${CX - 6},${CY - L + 24}Z`} fill={lume} />}
      </g>
    );
  }
  return (
    <g>
      <defs>
        <MetalGrad id={`${u}h`} tone={tone} x1={0} y1={0} x2={1} y2={0} />
      </defs>
      {gmt}
      {hand("hour", HOUR_ANGLE)}
      {hand("minute", MINUTE_ANGLE)}
      <circle cx={CX} cy={CY} r={10} fill={`url(#${u}h)`} stroke={m.deep} strokeOpacity="0.4" strokeWidth="0.6" />
    </g>
  );
}

/** Seconds hand, drawn pointing at 12; the stage rotates it. */
export function SecondsHand({ b }: { b: B }) {
  const h = b.hands;
  if (!h) return null;
  const rd = ((b.dial?.spec.diameterMm ?? 28.5) / 2) * PX_PER_MM;
  const c = h.spec.secondsHex;
  const L = rd * 0.93;
  const tail = rd * 0.22;
  const lume = h.spec.lume && h.spec.lumeHex ? h.spec.lumeHex : null;
  return (
    <g>
      <g opacity="0.2" transform="translate(2 4)">
        <rect x={CX - 1.3} y={CY - L} width={2.6} height={L + tail} fill="#000" />
      </g>
      <rect x={CX - 1.2} y={CY - L} width={2.4} height={L + tail} fill={c} />
      {h.spec.secondsStyle === "lollipop" && <circle cx={CX} cy={CY - L * 0.74} r={7.5} fill={lume ?? c} stroke={c} strokeWidth="2.4" />}
      {h.spec.secondsStyle === "arrow" && <path d={`M${CX},${CY - L - 2}L${CX + 7},${CY - L + 18}L${CX - 7},${CY - L + 18}Z`} fill={c} />}
      <circle cx={CX} cy={CY + tail * 0.8} r={5.5} fill={c} />
      <circle cx={CX} cy={CY} r={6} fill={c} />
      <circle cx={CX} cy={CY} r={2.4} fill={darken(c, 0.4)} />
    </g>
  );
}

/* ── Crystal ────────────────────────────────────────────────────────── */

export function CrystalFront({ b, u }: { b: B; u: string }) {
  const x = b.crystal;
  if (!x) return null;
  const g = caseGeometry(b.case);
  const r = g.crystalR;
  const strength = { flat: 0.1, domed: 0.16, "double-dome": 0.2, box: 0.22 }[x.spec.profile];
  const tint = x.spec.coating === "blue-ar" ? "#9fb6ea" : "#ffffff";
  let cyclops: ReactNode = null;
  if (x.spec.cyclops && b.dial && b.dial.spec.dateWindow !== "none") {
    const p = datePlacement(b);
    const w = 62;
    const h = 52;
    const wheel = dateWheelColors(b);
    cyclops = (
      <g>
        <rect x={p.cx - w / 2 + 2} y={CY - h / 2 + 3} width={w} height={h} rx={9} fill="#000" opacity="0.12" />
        <rect x={p.cx - w / 2} y={CY - h / 2} width={w} height={h} rx={9} fill={wheel.bg} opacity="0.96" />
        <text x={p.cx} y={CY + 2} fontSize={p.dayDate ? 22 : 40} fontWeight={600} textAnchor="middle" dominantBaseline="central" fill={wheel.fg} style={SANS}>
          {p.dayDate ? "16" : "16"}
        </text>
        <rect x={p.cx - w / 2} y={CY - h / 2} width={w} height={h} rx={9} fill={`url(#${u}cy)`} stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
      </g>
    );
  }
  return (
    <g>
      <defs>
        <clipPath id={`${u}cc`}>
          <circle cx={CX} cy={CY} r={r} />
        </clipPath>
        <linearGradient id={`${u}rf`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tint} stopOpacity={strength * 2.2} />
          <stop offset="0.45" stopColor={tint} stopOpacity={strength * 0.35} />
          <stop offset="1" stopColor={tint} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${u}cy`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      {cyclops}
      <g clipPath={`url(#${u}cc)`}>
        <ellipse cx={CX - r * 0.42} cy={CY - r * 0.55} rx={r * 1.05} ry={r * 0.52} transform={`rotate(-32 ${CX} ${CY})`} fill={`url(#${u}rf)`} />
        {x.spec.coating === "blue-ar" && <circle cx={CX} cy={CY} r={r} fill="#4a6fd0" opacity="0.04" />}
      </g>
      <circle cx={CX} cy={CY} r={r - 1} fill="none" stroke="#fff" strokeOpacity={x.spec.profile === "flat" ? 0.18 : 0.32} strokeWidth="1.5" />
      {x.spec.profile === "box" && <circle cx={CX} cy={CY} r={r - 5} fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="3" />}
    </g>
  );
}

/* ── Bracelets and straps ───────────────────────────────────────────── */

export function BandFront({ b, u, rear = false }: { b: B; u: string; rear?: boolean }) {
  const s = b.band;
  if (!s) return null;
  const g = caseGeometry(b.case);
  const spec = s.spec;
  const w1 = Math.min(g.lugGap - 2, spec.lugWidthMm * PX_PER_MM - 2);
  const w2 = w1 - (spec.lugWidthMm - spec.claspWidthMm) * PX_PER_MM * 0.35;
  const tone = (spec.tone ?? "steel") as Tone;
  const m = METAL[tone];
  const barY = g.L - 26; // spring bar distance from centre
  const fitted = spec.endLinks === "fitted";
  const nato = spec.style === "nato";
  const startTop = nato ? CY : fitted ? CY - g.R * 0.8 : CY - barY - 10;
  const startBottom = nato ? CY : fitted ? CY + g.R * 0.8 : CY + barY + 10;
  const shape = (y0: number, y1: number) =>
    `M${f(CX - w1 / 2)},${f(y0)}L${f(CX - w2 / 2)},${f(y1)}L${f(CX + w2 / 2)},${f(y1)}L${f(CX + w1 / 2)},${f(y0)}Z`;
  const top = shape(startTop, -20);
  const bottom = shape(startBottom, CANVAS_H + 20);
  const clip = `${u}bc`;

  let fill: ReactNode = null;
  const W = w1;
  const x0 = CX - W / 2;
  const rows = (rowH: number, render: (y: number, i: number) => ReactNode) => {
    const out: ReactNode[] = [];
    let i = 0;
    for (let y = CY - rowH / 2; y > -rowH; y -= rowH, i++) out.push(render(y, i));
    i = 0;
    for (let y = CY + rowH / 2; y < CANVAS_H + rowH; y += rowH, i++) out.push(render(y, i + 1000));
    return out;
  };

  if (spec.kind === "bracelet") {
    if (spec.style === "oyster") {
      const cw = W * 0.34;
      fill = rows(70, (y, i) => (
        <g key={i}>
          <rect x={x0} y={y - 35} width={(W - cw) / 2} height={68} fill={`url(#${u}br)`} />
          <rect x={CX - cw / 2} y={y - 35} width={cw} height={68} fill={`url(#${u}pol)`} />
          <rect x={CX + cw / 2} y={y - 35} width={(W - cw) / 2} height={68} fill={`url(#${u}br)`} />
          <rect x={x0} y={y + 33} width={W} height={2.2} fill={m.deep} opacity="0.75" />
          <rect x={x0} y={y - 35} width={W} height={10} fill="#fff" opacity="0.10" />
          <rect x={x0} y={y + 22} width={W} height={11} fill="#000" opacity="0.07" />
        </g>
      ));
    } else if (spec.style === "jubilee") {
      const fr = [0.27, 0.11, 0.24, 0.11, 0.27];
      fill = rows(62, (y, i) => {
        let x = x0;
        return (
          <g key={i}>
            {fr.map((p, j) => {
              const wj = W * p;
              const el =
                j % 2 === 0 ? (
                  <rect key={j} x={x} y={y - 31} width={wj} height={60} rx={j === 2 ? 10 : 2} fill={j === 2 ? `url(#${u}pol)` : `url(#${u}br)`} />
                ) : (
                  <g key={j}>
                    <rect x={x + 1} y={y - 31} width={wj - 2} height={28} rx={8} fill={`url(#${u}pol)`} />
                    <rect x={x + 1} y={y + 1} width={wj - 2} height={28} rx={8} fill={`url(#${u}pol)`} />
                  </g>
                );
              x += wj;
              return el;
            })}
            <rect x={x0} y={y + 29.5} width={W} height={1.6} fill={m.deep} opacity="0.7" />
          </g>
        );
      });
    } else if (spec.style === "beads") {
      const fr = [0.22, 0.187, 0.187, 0.187, 0.22];
      fill = rows(34, (y, i) => {
        let x = x0;
        return (
          <g key={i}>
            {fr.map((p, j) => {
              const wj = W * p;
              const el =
                j === 0 || j === 4 ? (
                  <rect key={j} x={x} y={y - 17} width={wj} height={34} fill={`url(#${u}br)`} />
                ) : (
                  <rect key={j} x={x + 2} y={y - 15} width={wj - 4} height={30} rx={13} fill={`url(#${u}pol)`} stroke={m.deep} strokeOpacity="0.35" strokeWidth="0.8" />
                );
              x += wj;
              return el;
            })}
          </g>
        );
      });
    } else {
      fill = (
        <g>
          <rect x={x0} y={-40} width={W} height={CANVAS_H + 80} fill={`url(#${u}br)`} />
          <rect x={x0} y={-40} width={W} height={CANVAS_H + 80} fill={`url(#${u}mesh)`} />
        </g>
      );
    }
  } else {
    const c = spec.colorHex;
    const edge = darken(c, 0.28);
    let pattern: ReactNode = null;
    if (spec.style === "suede") pattern = <rect x={x0 - 10} y={-40} width={W + 20} height={CANVAS_H + 80} fill={`url(#${u}sd)`} />;
    if (spec.style === "tropic") pattern = <rect x={x0 - 10} y={-40} width={W + 20} height={CANVAS_H + 80} fill={`url(#${u}tr)`} />;
    if (spec.style === "sailcloth") pattern = <rect x={x0 - 10} y={-40} width={W + 20} height={CANVAS_H + 80} fill={`url(#${u}sc)`} />;
    if (spec.style === "nato") {
      const s2 = spec.secondaryHex ?? lighten(c, 0.4);
      pattern = (
        <g>
          <rect x={CX - W * 0.2} y={-40} width={W * 0.08} height={CANVAS_H + 80} fill={s2} />
          <rect x={CX + W * 0.12} y={-40} width={W * 0.08} height={CANVAS_H + 80} fill={s2} />
          <rect x={x0 - 10} y={-40} width={W + 20} height={CANVAS_H + 80} fill={`url(#${u}wv)`} />
        </g>
      );
    }
    const grooves =
      spec.style === "fkm" ? (
        <g stroke={darken(c, 0.35)} strokeWidth="2" opacity="0.6">
          <line x1={CX - W * 0.22} y1={-40} x2={CX - W * 0.22} y2={CANVAS_H + 40} />
          <line x1={CX + W * 0.22} y1={-40} x2={CX + W * 0.22} y2={CANVAS_H + 40} />
        </g>
      ) : null;
    const stitch = spec.stitchHex ? (
      <g stroke={spec.stitchHex} strokeWidth="1.6" strokeDasharray="7 5" opacity="0.9">
        <line x1={x0 + 11} y1={-40} x2={CX - w2 / 2 + 11} y2={CANVAS_H + 40} />
        <line x1={x0 + W - 11} y1={-40} x2={CX + w2 / 2 - 11} y2={CANVAS_H + 40} />
      </g>
    ) : null;
    const keeperY = CY + g.L + 150;
    fill = (
      <g>
        <rect x={x0 - 10} y={-40} width={W + 20} height={CANVAS_H + 80} fill={c} />
        <rect x={x0 - 10} y={-40} width={W + 20} height={CANVAS_H + 80} fill={`url(#${u}pad)`} />
        {pattern}
        {grooves}
        {stitch}
        {nato ? (
          <g>
            <rect x={x0 - 4} y={keeperY} width={W + 8} height={13} rx={3} fill={`url(#${u}pol)`} />
            <rect x={x0 - 4} y={keeperY + 70} width={W + 8} height={13} rx={3} fill={`url(#${u}pol)`} />
          </g>
        ) : spec.kind !== "fabric" ? (
          <g>
            <rect x={x0 - 3} y={keeperY} width={W + 6} height={22} rx={4} fill={darken(c, 0.12)} stroke={edge} strokeWidth="1" />
            <rect x={x0 - 3} y={keeperY + 42} width={W + 6} height={18} rx={4} fill={darken(c, 0.12)} stroke={edge} strokeWidth="1" />
          </g>
        ) : null}
      </g>
    );
  }

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={nato ? shape(-20, CANVAS_H + 20) : `${top}${bottom}`} />
        </clipPath>
        <linearGradient id={`${u}br`} x1="0" x2="1">
          <stop offset="0" stopColor={m.dark} />
          <stop offset="0.2" stopColor={m.mid} />
          <stop offset="0.55" stopColor={m.light} />
          <stop offset="1" stopColor={m.dark} />
        </linearGradient>
        <linearGradient id={`${u}pol`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={m.mid} />
          <stop offset="0.3" stopColor={m.hi} />
          <stop offset="0.55" stopColor={m.light} />
          <stop offset="0.8" stopColor={m.dark} />
          <stop offset="1" stopColor={m.mid} />
        </linearGradient>
        <linearGradient id={`${u}fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.12" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.88" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${u}mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height={CANVAS_H}>
          <rect x="0" y="0" width="600" height={CANVAS_H} fill={`url(#${u}fade)`} />
        </mask>
        <linearGradient id={`${u}pad`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.32" />
          <stop offset="0.12" stopColor="#000" stopOpacity="0.06" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.07" />
          <stop offset="0.88" stopColor="#000" stopOpacity="0.06" />
          <stop offset="1" stopColor="#000" stopOpacity="0.36" />
        </linearGradient>
        <pattern id={`${u}mesh`} width="5" height="5" patternUnits="userSpaceOnUse">
          <path d="M0,5L5,0M-1,1L1,-1M4,6L6,4" stroke={m.deep} strokeOpacity="0.45" strokeWidth="0.9" />
        </pattern>
        <pattern id={`${u}sd`} width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.7" fill="#000" opacity="0.12" />
          <circle cx="4.5" cy="4" r="0.6" fill="#fff" opacity="0.12" />
        </pattern>
        <pattern id={`${u}tr`} width="16" height="16" patternUnits="userSpaceOnUse">
          <rect x="1" y="1" width="6" height="6" fill="#fff" opacity="0.07" />
          <rect x="9" y="9" width="6" height="6" fill="#fff" opacity="0.07" />
          <rect x="9" y="1" width="6" height="6" fill="#000" opacity="0.22" />
          <rect x="1" y="9" width="6" height="6" fill="#000" opacity="0.22" />
        </pattern>
        <pattern id={`${u}sc`} width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M0,0L4,4M4,0L0,4" stroke="#fff" strokeOpacity="0.07" strokeWidth="0.8" />
        </pattern>
        <pattern id={`${u}wv`} width="6" height="3" patternUnits="userSpaceOnUse">
          <rect width="6" height="1" fill="#000" opacity="0.12" />
        </pattern>
      </defs>
      <g mask={`url(#${u}mask)`}>
        <g clipPath={`url(#${clip})`}>
          {fill}
          {rear && <rect x="0" y="0" width="600" height={CANVAS_H} fill="#000" opacity="0.12" />}
        </g>
      </g>
      {!nato && !fitted && (
        <g fill={METAL[g.tone].deep} opacity="0.45">
          <rect x={CX - w1 / 2} y={CY - barY - 11} width={w1} height="2" />
          <rect x={CX - w1 / 2} y={CY + barY + 9} width={w1} height="2" />
        </g>
      )}
    </g>
  );
}

/* ── Rear: caseback and movement ────────────────────────────────────── */

function MovementIllustration({ r, u }: { r: number; u: string }) {
  const plate = "#cdc8be";
  const jewels = [
    [0.22, 30],
    [0.5, 140],
    [0.35, 250],
    [0.62, 205],
    [0.15, 310],
  ] as const;
  const [bx, by] = polar(r * 0.52, 215);
  return (
    <g>
      <defs>
        <pattern id={`${u}perl`} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="6" fill="none" stroke="#fff" strokeOpacity="0.25" />
          <circle cx="0" cy="0" r="6" fill="none" stroke="#000" strokeOpacity="0.06" />
        </pattern>
        <linearGradient id={`${u}rot`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e7e5e0" />
          <stop offset="0.5" stopColor="#a9a6a0" />
          <stop offset="1" stopColor="#d6d3cd" />
        </linearGradient>
      </defs>
      <circle cx={CX} cy={CY} r={r} fill={plate} />
      <circle cx={CX} cy={CY} r={r} fill={`url(#${u}perl)`} />
      <path d={`M${CX - r * 0.7},${CY + r * 0.1}Q${CX - r * 0.2},${CY + r * 0.75} ${CX + r * 0.55},${CY + r * 0.45}L${CX + r * 0.3},${CY + r * 0.05}Z`} fill="#bdb7ab" stroke="#fff" strokeOpacity="0.4" />
      <g>
        <circle cx={bx} cy={by} r={r * 0.2} fill="none" stroke="#c4a46a" strokeWidth="4" />
        {[0, 120, 240].map((a) => {
          const [x2, y2] = polar(r * 0.2, a, bx, by);
          return <line key={a} x1={bx} y1={by} x2={x2} y2={y2} stroke="#c4a46a" strokeWidth="2.4" />;
        })}
        <circle cx={bx} cy={by} r={4} fill="#9a2d34" />
      </g>
      {jewels.map(([k, a]) => {
        const [x, y] = polar(r * k, a);
        return <circle key={a} cx={x} cy={y} r={3.2} fill="#9a2d34" stroke="#d9c6a0" strokeWidth="1" />;
      })}
      {/* Rotor */}
      <g transform={`rotate(-38 ${CX} ${CY})`}>
        <path d={`M${CX - r * 0.96},${CY}A${r * 0.96},${r * 0.96} 0 0,1 ${CX + r * 0.96},${CY}L${CX + r * 0.2},${CY}A${r * 0.2},${r * 0.2} 0 0,0 ${CX - r * 0.2},${CY}Z`} fill={`url(#${u}rot)`} stroke="#7d7a74" strokeOpacity="0.4" />
        {[0.45, 0.62, 0.79].map((k) => (
          <path key={k} d={`M${CX - r * k},${CY}A${r * k},${r * k} 0 0,1 ${CX + r * k},${CY}`} fill="none" stroke="#fff" strokeOpacity="0.35" />
        ))}
      </g>
      <circle cx={CX} cy={CY} r={11} fill="#b9b5ad" stroke="#7d7a74" />
      <line x1={CX - 7} y1={CY} x2={CX + 7} y2={CY} stroke="#6f6b65" strokeWidth="2" />
    </g>
  );
}

export function CasebackRear({ b, u, showEngravingGuide = false }: { b: B; u: string; showEngravingGuide?: boolean }) {
  const g = caseGeometry(b.case);
  const cb = b.caseback;
  const tone = (cb?.spec.tone ?? g.tone) as Tone;
  const m = METAL[tone];
  const rBack = g.R * (g.shape === "round" ? 0.86 : 0.8);
  const exhibition = cb?.spec.kind === "exhibition";
  const window = rBack * 0.74;
  const text = b.engraving?.text?.trim() ?? "";
  const lines = wrapEngraving(text, 16);
  const size = lines.length > 2 ? 17 : 21;
  return (
    <g>
      <defs>
        <radialGradient id={`${u}cb`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor={m.hi} />
          <stop offset="0.5" stopColor={m.light} />
          <stop offset="1" stopColor={m.dark} />
        </radialGradient>
        <clipPath id={`${u}win`}>
          <circle cx={CX} cy={CY} r={window} />
        </clipPath>
      </defs>
      <circle cx={CX} cy={CY} r={rBack} fill={`url(#${u}cb)`} />
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={CX} cy={CY} r={rBack - 4 - i * ((rBack - (exhibition ? window : 20)) / 16)} fill="none" stroke={i % 2 ? "#fff" : "#000"} strokeOpacity={i % 2 ? 0.16 : 0.05} strokeWidth="2" />
      ))}
      <circle cx={CX} cy={CY} r={rBack} fill="none" stroke={m.deep} strokeOpacity="0.5" strokeWidth="1.5" />
      {exhibition ? (
        <g>
          <g clipPath={`url(#${u}win)`}>
            <MovementIllustration r={137} u={u} />
            <ellipse cx={CX - window * 0.4} cy={CY - window * 0.5} rx={window * 0.9} ry={window * 0.4} transform={`rotate(-30 ${CX} ${CY})`} fill="#fff" opacity="0.12" />
          </g>
          <circle cx={CX} cy={CY} r={window} fill="none" stroke={m.deep} strokeWidth="2.5" />
        </g>
      ) : (
        <g>
          {showEngravingGuide && !text && (
            <circle cx={CX} cy={CY} r={rBack * 0.55} fill="none" stroke={m.deep} strokeOpacity="0.35" strokeDasharray="4 5" />
          )}
          {lines.map((line, i) => (
            <text
              key={i}
              x={CX}
              y={CY + (i - (lines.length - 1) / 2) * size * 1.35}
              fontSize={size}
              textAnchor="middle"
              dominantBaseline="central"
              fill={m.deep}
              opacity="0.85"
              letterSpacing={b.engraving?.style === "sans" ? 2.5 : 0.5}
              style={b.engraving?.style === "sans" ? SANS : { ...SERIF, fontStyle: "italic" }}
            >
              {b.engraving?.style === "sans" ? line.toUpperCase() : line}
            </text>
          ))}
        </g>
      )}
    </g>
  );
}

export function wrapEngraving(text: string, perLine: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > perLine && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}
