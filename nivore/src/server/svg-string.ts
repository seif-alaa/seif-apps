import "server-only";
import { Fragment, isValidElement, type ReactNode } from "react";

/**
 * Minimal serialiser for the watch renderer's SVG trees (plain SVG elements
 * and hook-free function components). Used by /api/render, where Next.js
 * disallows react-dom/server. Attribute values and text are escaped.
 */
const KEEP_CAMEL = new Set(["viewBox", "preserveAspectRatio", "gradientUnits", "gradientTransform", "patternUnits", "patternTransform", "maskUnits", "clipPathUnits", "textLength", "lengthAdjust"]);
const VOID = new Set(["stop", "circle", "rect", "path", "line", "ellipse", "image", "polygon", "polyline"]);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function attr(name: string, value: unknown): string {
  if (value == null || value === false || name === "children" || name === "key") return "";
  if (name === "className") return ` class="${esc(String(value))}"`;
  if (name === "style" && typeof value === "object") {
    const css = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k.startsWith("--") ? k : kebab(k)}:${String(v)}`)
      .join(";");
    return css ? ` style="${esc(css)}"` : "";
  }
  if (typeof value === "function") return "";
  const n = KEEP_CAMEL.has(name) ? name : name.startsWith("aria") || name.startsWith("data") ? kebab(name) : kebab(name);
  return ` ${n}="${esc(String(value))}"`;
}

export function svgToString(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return esc(String(node));
  if (Array.isArray(node)) return node.map(svgToString).join("");
  if (!isValidElement(node)) return "";
  const { type, props } = node as { type: unknown; props: Record<string, unknown> & { children?: ReactNode } };
  if (type === Fragment) return svgToString(props.children);
  if (typeof type === "function") return svgToString((type as (p: unknown) => ReactNode)(props));
  if (typeof type !== "string") return "";
  const attrs = Object.entries(props).map(([k, v]) => attr(k, v)).join("");
  const children = svgToString(props.children);
  return children || !VOID.has(type) ? `<${type}${attrs}>${children}</${type}>` : `<${type}${attrs}/>`;
}
