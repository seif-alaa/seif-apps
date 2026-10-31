// Screenshots of /dev/layers. Usage: node e2e/layers-shots.mjs <outDir> [base]
import { chromium } from "playwright";
const [out, base = "http://localhost:3100"] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: Number(process.env.DPR ?? 1) });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
page.on("requestfailed", (r) => errors.push("FAILED " + r.url()));
page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
await page.goto(base + "/dev/layers", { waitUntil: "networkidle" });
await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
const stage = page.getByTestId("stage");
const snap = async (name) => { await page.waitForTimeout(250); await stage.screenshot({ path: `${out}/${name}.png` }); };
await snap("A_spec_D01_S02");
await page.getByTestId("guides").check(); await snap("A_spec_guides"); await page.getByTestId("guides").uncheck();
await page.getByTestId("placement-bars").click(); await page.getByTestId("order-under").click();
await snap("B_fixed_D01_S02");
await page.getByTestId("guides").check(); await snap("B_fixed_guides"); await page.getByTestId("guides").uncheck();
for (const d of ["dial_D02", "dial_D03", "dial_D04"]) { await page.getByTestId(`dial-${d}`).click(); await snap(`B_${d}`); }
await page.getByTestId("dial-dial_D01").click();
for (const s of ["bracelet_S01", "strap_S08", "strap_S09"]) { await page.getByTestId(`strap-${s}`).click(); await snap(`B_${s}`); }
// the same straps in the as-specified mode, for the record
await page.getByTestId("placement-spec").click(); await page.getByTestId("order-spec").click();
for (const s of ["bracelet_S02", "strap_S09"]) { await page.getByTestId(`strap-${s}`).click(); await snap(`A_${s}`); }
await page.screenshot({ path: `${out}/full_page.png` });
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no console or network errors");
await browser.close();
