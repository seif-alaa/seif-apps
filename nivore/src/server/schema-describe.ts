import "server-only";
import type { z } from "zod";

/**
 * Turn a Zod object schema into serialisable field descriptors so admin
 * forms are generated from the same schema that validates them. Adding a
 * field to a component spec automatically adds it to the admin form.
 */
export type FieldDesc =
  | { key: string; kind: "string"; nullable: boolean; multiline: boolean }
  | { key: string; kind: "number"; nullable: boolean; integer: boolean }
  | { key: string; kind: "boolean"; nullable: boolean }
  | { key: string; kind: "enum"; nullable: boolean; options: (string | number)[] }
  | { key: string; kind: "string[]" | "number[]"; nullable: boolean };

type Def = { type: string; innerType?: Def & { _zod?: { def: Def } }; entries?: Record<string, string>; options?: { _zod: { def: Def } }[]; values?: unknown[]; element?: { _zod: { def: Def } }; checks?: { _zod?: { def?: { check?: string; format?: string } } }[] };

function unwrap(schema: { _zod: { def: Def } }): { def: Def; nullable: boolean } {
  let def = schema._zod.def;
  let nullable = false;
  while (def.type === "nullable" || def.type === "optional" || def.type === "default") {
    nullable = true;
    def = (def.innerType as unknown as { _zod: { def: Def } })._zod.def;
  }
  return { def, nullable };
}

export function describeObject(schema: z.ZodObject): FieldDesc[] {
  return Object.entries(schema.shape).map(([key, field]) => {
    const { def, nullable } = unwrap(field as unknown as { _zod: { def: Def } });
    switch (def.type) {
      case "string":
        return { key, kind: "string", nullable, multiline: /description|instructions|note|body/i.test(key) };
      case "number":
        return { key, kind: "number", nullable, integer: Boolean(def.checks?.some((c) => c._zod?.def?.format === "safeint" || c._zod?.def?.check === "number_format")) };
      case "boolean":
        return { key, kind: "boolean", nullable };
      case "enum":
        return { key, kind: "enum", nullable, options: Object.values(def.entries ?? {}) };
      case "union":
        return { key, kind: "enum", nullable, options: (def.options ?? []).flatMap((o) => (o._zod.def.values as (string | number)[]) ?? []) };
      case "array": {
        const el = def.element?._zod.def.type;
        return { key, kind: el === "number" ? "number[]" : "string[]", nullable };
      }
      default:
        return { key, kind: "string", nullable, multiline: false };
    }
  });
}
