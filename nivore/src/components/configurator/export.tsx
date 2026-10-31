"use client";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { StaticWatch, type Layer } from "@/components/watch/layers";

/** Render the composition to a PNG (client-side, no server round trip). */
export async function downloadBuildImage(layers: Layer[], opts: { name: string; reference: string; illustrative: boolean }) {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:600px;height:860px;";
  document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(<StaticWatch layers={layers} idPrefix="export" />));
  const svg = host.querySelector("svg");
  if (!svg) throw new Error("Render failed");
  svg.setAttribute("width", "1200");
  svg.setAttribute("height", "1720");
  const markup = new XMLSerializer().serializeToString(svg);
  root.unmount();
  host.remove();

  const img = new Image();
  img.decoding = "async";
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await img.decode();

  const W = 1200;
  const H = 1600;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e8e2d6";
  ctx.fillRect(0, 0, W, H);
  const watchH = 1300;
  const watchW = watchH * (600 / 860);
  ctx.drawImage(img, (W - watchW) / 2, 40, watchW, watchH);

  const fam = getComputedStyle(document.body).fontFamily;
  const serif = getComputedStyle(document.documentElement).getPropertyValue("--font-newsreader") || "Georgia";
  ctx.textAlign = "center";
  ctx.fillStyle = "#3a322e";
  ctx.font = `600 34px ${fam}`;
  ctx.fillText("NIVORÉ", W / 2, H - 170);
  ctx.font = `300 44px ${serif}, Georgia, serif`;
  ctx.fillText(opts.name, W / 2, H - 108);
  ctx.fillStyle = "#5f5549";
  ctx.font = `400 20px ${fam}`;
  ctx.fillText(`${opts.reference}${opts.illustrative ? "  ·  Illustrative rendering" : ""}`, W / 2, H - 62);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Could not create image");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nivore-${opts.reference.toLowerCase()}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
