import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "./en";
import { ar } from "./ar";
import { SOURCES } from "@/engine/sources";
import { translate } from ".";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?)$/.test(f) && !f.endsWith(".test.ts") ? [p] : [];
  });
}

const has = (d: Record<string, string>, k: string) => k in d || `${k}.other` in d;

describe("i18n", () => {
  const src = files(join(__dirname, ".."));
  const used = new Set<string>();
  for (const f of src) for (const m of readFileSync(f, "utf8").matchAll(/\bt\("([a-zA-Z0-9_.]+)"/g)) used.add(m[1]);
  for (const s of SOURCES) [s.titleKey, s.bodyKey, s.accessKey].forEach((k) => used.add(k));

  it("every key used in the code exists in English and Arabic", () => {
    const missingEn = [...used].filter((k) => !has(en, k));
    const missingAr = [...used].filter((k) => !has(ar, k));
    expect(missingEn).toEqual([]);
    expect(missingAr).toEqual([]);
  });

  it("Arabic covers every English key", () => {
    const missing = Object.keys(en).filter((k) => !(k in ar));
    expect(missing).toEqual([]);
  });

  it("picks Arabic plural forms", () => {
    expect(translate("ar", "home.attention", { count: 1 })).toBe("معاملة واحدة تحتاجك");
    expect(translate("ar", "home.attention", { count: 2 })).toBe("معاملتان تحتاجانك");
    expect(translate("ar", "home.attention", { count: 5 })).toBe("5 معاملات تحتاجك");
    expect(translate("en", "home.attention", { count: 3 })).toBe("3 transactions need you");
  });
});
