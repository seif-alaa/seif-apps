"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Structured editor for nested settings/content objects. Conventions:
 *  - keys ending in "Minor" are edited in EGP and stored as piastres;
 *  - keys ending in "Bp" are edited as percentages and stored as basis points;
 *  - long text keys get a textarea; arrays of objects become repeatable groups.
 */
type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

const humanize = (k: string) =>
  k
    .replace(/Minor$/, "")
    .replace(/Bp$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

const NUMERIC_KEY = /(Mm|Hours|Bph|jewels|Minor|Bp|Days|Limit|Count)$/;
const LONG = /body|description|instructions|note|message|headline|disclosure|subheadline|announcement|paragraph|\ba\b|text/i;

export function ObjectEditor({ value, onChange, path = "", templates = {} }: { value: Json; onChange: (v: Json) => void; path?: string; templates?: Record<string, Json> }) {
  if (Array.isArray(value)) {
    const template = templates[path] ?? (value[0] !== undefined ? blank(value[0]) : "");
    return (
      <div className="space-y-3">
        {value.map((item, i) => (
          <div key={i} className={cn(typeof item === "object" && item !== null ? "border border-line p-4" : "flex items-start gap-2")}>
            <div className="flex-1">
              <ObjectEditor value={item} path={`${path}[]`} templates={templates} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} />
            </div>
            <div className="mt-2 flex gap-3 text-[12px]">
              {i > 0 && <button type="button" className="text-taupe-ink hover:text-espresso" onClick={() => onChange(move(value, i, i - 1))}>Up</button>}
              <button type="button" className="text-err" onClick={() => onChange(value.filter((_, j) => j !== i))}>Remove</button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-outline !min-h-9 !text-[10px]" onClick={() => onChange([...value, template])}>Add</button>
      </div>
    );
  }
  if (value && typeof value === "object") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(value).map(([k, v]) => {
          const wide = Array.isArray(v) || (v && typeof v === "object") || (typeof v === "string" && (LONG.test(k) || v.length > 60));
          return (
            <div key={k} className={cn(wide && "md:col-span-2")}>
              {v && typeof v === "object" ? (
                <fieldset className="border-t border-line pt-4">
                  <legend className="eyebrow pr-3">{humanize(k)}</legend>
                  <div className="mt-3">
                    <ObjectEditor value={v} path={path ? `${path}.${k}` : k} templates={templates} onChange={(nv) => onChange({ ...value, [k]: nv })} />
                  </div>
                </fieldset>
              ) : (
                <Leaf k={k} v={v} onChange={(nv) => onChange({ ...value, [k]: nv })} />
              )}
            </div>
          );
        })}
      </div>
    );
  }
  return <Leaf k={path.split(".").pop()?.replace("[]", "") ?? ""} v={value} onChange={onChange} hideLabel />;
}

function Leaf({ k, v, onChange, hideLabel }: { k: string; v: Json; onChange: (v: Json) => void; hideLabel?: boolean }) {
  const label = humanize(k) + (k.endsWith("Minor") ? " (EGP)" : k.endsWith("Bp") ? " (%)" : "");
  const [text, setText] = useState(() => (k.endsWith("Minor") && typeof v === "number" ? String(v / 100) : k.endsWith("Bp") && typeof v === "number" ? String(v / 100) : v == null ? "" : String(v)));
  if (typeof v === "boolean") {
    return (
      <label className="flex min-h-11 items-center gap-3 text-[13.5px]">
        <input type="checkbox" className="h-4 w-4 accent-[var(--color-espresso)]" checked={v} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    );
  }
  const numeric = typeof v === "number" || k.endsWith("Minor") || k.endsWith("Bp") || (v === null && NUMERIC_KEY.test(k));
  const multiline = typeof v === "string" && (LONG.test(k) || v.length > 80);
  const commit = (raw: string) => {
    setText(raw);
    if (numeric) {
      if (raw.trim() === "") return onChange(v === null || typeof v !== "number" ? null : 0);
      const n = Number(raw.replace(/,/g, ""));
      if (!Number.isFinite(n)) return;
      onChange(k.endsWith("Minor") || k.endsWith("Bp") ? Math.round(n * 100) : n);
    } else onChange(raw === "" && v === null ? null : raw);
  };
  return (
    <label className="block">
      {!hideLabel && <span className="field-label">{label}</span>}
      {multiline ? (
        <textarea className="field text-[14px]" value={text} onChange={(e) => commit(e.target.value)} />
      ) : (
        <input className={cn("field text-[14px]", numeric && "tabular")} inputMode={numeric ? "decimal" : undefined} value={text} placeholder={v === null ? "Not set" : undefined} onChange={(e) => commit(e.target.value)} />
      )}
    </label>
  );
}

function blank(v: Json): Json {
  if (Array.isArray(v)) return [];
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blank(x)]));
  if (typeof v === "number") return 0;
  if (typeof v === "boolean") return false;
  return v === null ? null : "";
}

function move<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [x] = copy.splice(from, 1);
  copy.splice(to, 0, x);
  return copy;
}

export type { Json };
