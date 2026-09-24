#!/usr/bin/env node
/**
 * Media pipeline smoke test against the BUILT app (`pnpm build` first).
 *
 * Imports dist/lib/media.js exactly the way the Rome daemon loads app code
 * (native import() with a cache-busting query), generates a synthetic
 * multi-page PDF (and a HEIC photo when ImageMagick is available), and
 * renders them into a scratch dir OUTSIDE the repo (FH_SCRATCH_DIR, default
 * ../../default/family-health-verification/scratch/spike-out). Nothing leaves the machine.
 *
 *   node scripts/media-smoke.mjs [pages=12]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.env.FH_SCRATCH_DIR ?? join(appDir, "../../default/family-health-verification/scratch/spike-out");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
process.env.FAMILY_HEALTH_DATA_DIR = join(out, "data");

const bust = `?v=${Date.now()}`;
const media = await import(pathToFileURL(join(appDir, "dist/lib/media.js")).href + bust);
const storage = await import(pathToFileURL(join(appDir, "dist/lib/storage.js")).href + bust);
const mupdf = await import("mupdf");

const pages = Number(process.argv[2] ?? 12);
const buf = new mupdf.Buffer();
const writer = new mupdf.DocumentWriter(buf, "pdf", "");
for (let i = 0; i < pages; i++) {
  const dev = writer.beginPage([0, 0, 595, 842]);
  const path = new mupdf.Path();
  // Table-like rules so the page is not blank.
  for (let r = 0; r < 20; r++) path.rect(50, 60 + r * 36, 495, 0.8);
  dev.fillPath(path, false, mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, [0, 0, 0], 1);
  writer.endPage();
}
writer.close();
const pdfPath = join(out, "synthetic.pdf");
writeFileSync(pdfPath, buf.asUint8Array());

const inputs = [pdfPath];
try {
  const heic = join(out, "photo.heic");
  execFileSync("convert", ["-size", "3024x4032", "gradient:white-gray", heic], { stdio: "ignore" });
  inputs.push(heic);
} catch {
  console.log("ImageMagick not found; skipping HEIC fixture");
}

const dir = storage.reportDir("smoke");
let maxStall = 0;
let last = performance.now();
const timer = setInterval(() => {
  const now = performance.now();
  maxStall = Math.max(maxStall, now - last - 10);
  last = now;
}, 10);
for (const [i, file] of inputs.entries()) {
  const t0 = performance.now();
  const res = await media.processUpload(new Uint8Array(readFileSync(file)), file, dir, `f${i}`);
  const ms = Math.round(performance.now() - t0);
  const kb = res.pages.map((p) => statSync(p.path).size / 1024);
  console.log(`${file.split("/").pop()}: ${res.mime}, ${res.pages.length} page(s), ${ms} ms, first ${res.pages[0].width}x${res.pages[0].height}, avg ${Math.round(kb.reduce((a, b) => a + b, 0) / kb.length)} KB`);
}
clearInterval(timer);
console.log(`max event-loop stall: ${Math.round(maxStall)} ms`);
