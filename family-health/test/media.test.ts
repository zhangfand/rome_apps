import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as mupdf from "mupdf";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PAGE_LONG_EDGE, processUpload, renderPages, sniffMime } from "../src/lib/media.js";
import { reportDir, resolveStoredPath } from "../src/lib/storage.js";

/** Build a small multi-page A4 PDF in memory (vector shapes, no fonts needed). */
function makePdf(pages: number): Uint8Array {
  const buf = new mupdf.Buffer();
  const writer = new mupdf.DocumentWriter(buf, "pdf", "");
  for (let i = 0; i < pages; i++) {
    const dev = writer.beginPage([0, 0, 595, 842]);
    const path = new mupdf.Path();
    path.rect(50, 50 + i * 20, 300, 40);
    dev.fillPath(path, false, mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, [0.2, 0.2, 0.2], 1);
    writer.endPage();
  }
  writer.close();
  return buf.asUint8Array().slice();
}

function hasImageMagick(): boolean {
  try {
    execFileSync("convert", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

let dataDir: string;
beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), "fh-media-"));
  process.env.FAMILY_HEALTH_DATA_DIR = dataDir;
});
afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FAMILY_HEALTH_DATA_DIR;
});

describe("sniffMime", () => {
  it("detects types from magic bytes, not just the extension", () => {
    expect(sniffMime(new TextEncoder().encode("%PDF-1.7 ..."), "scan.jpg")).toBe("application/pdf");
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "x")).toBe("image/jpeg");
    expect(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "x")).toBe("image/png");
    const heic = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypheic")]);
    expect(sniffMime(heic, "IMG_0001")).toBe("image/heic");
    expect(sniffMime(new TextEncoder().encode("hello"), "notes.txt")).toBeNull();
  });
});

describe("renderPages", () => {
  it("rasterizes every PDF page to a JPEG with a 1600px long edge", async () => {
    const pages = [];
    for await (const p of renderPages(makePdf(3), "application/pdf")) pages.push(p);
    expect(pages).toHaveLength(3);
    for (const p of pages) {
      expect(Math.max(p.width, p.height)).toBe(PAGE_LONG_EDGE);
      expect([p.jpeg[0], p.jpeg[1]]).toEqual([0xff, 0xd8]);
    }
  });

  it("never upscales small images", async () => {
    const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 400, 300], false);
    pix.clear(255);
    const png = pix.asPNG();
    const out = [];
    for await (const p of renderPages(png, "image/png")) out.push(p);
    expect(out[0]).toMatchObject({ width: 400, height: 300 });
  });

  it("applies EXIF orientation from phone photos", async () => {
    const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 400, 300], false);
    pix.clear(200);
    const jpeg = pix.asJPEG(90, false);
    // Minimal big-endian EXIF APP1 with Orientation = 6 (rotate 90° CW).
    const exif = new Uint8Array([
      0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
      0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const rotated = new Uint8Array([...jpeg.subarray(0, 2), ...exif, ...jpeg.subarray(2)]);
    const out = [];
    for await (const p of renderPages(rotated, "image/jpeg")) out.push(p);
    expect(out[0]).toMatchObject({ width: 300, height: 400 });
  });
});

describe("processUpload", () => {
  it("stores the original and page images under the app data dir", async () => {
    const dir = reportDir("r-test");
    const out = await processUpload(makePdf(2), "体检报告.pdf", dir, "f00");
    expect(out.mime).toBe("application/pdf");
    expect(out.pages).toHaveLength(2);
    expect(resolveStoredPath(out.sourcePath)).not.toBeNull();
    for (const p of out.pages) expect(statSync(p.path).size).toBeGreaterThan(1000);
    expect(out.pages[1].path.endsWith("f00-p002.jpg")).toBe(true);
  });

  it("rejects unsupported files with a Chinese error", async () => {
    await expect(processUpload(new TextEncoder().encode("hi"), "a.txt", reportDir("r-bad"), "f00")).rejects.toThrow(/不支持/);
  });

  it.runIf(hasImageMagick())("converts HEIC photos to JPEG before rendering", async () => {
    const work = mkdtempSync(join(tmpdir(), "fh-heic-"));
    const heicPath = join(work, "photo.heic");
    execFileSync("convert", ["-size", "2400x3200", "gradient:white-gray", heicPath]);
    if (!existsSync(heicPath)) return;
    const out = await processUpload(new Uint8Array(readFileSync(heicPath)), "IMG_1234.HEIC", reportDir("r-heic"), "f00");
    expect(out.mime).toBe("image/heic");
    expect(out.sourcePath.endsWith(".jpg")).toBe(true);
    expect(out.pages[0]).toMatchObject({ width: 1200, height: 1600 });
    rmSync(work, { recursive: true, force: true });
  }, 30_000);

  it("refuses paths outside the data dir", () => {
    expect(resolveStoredPath("/etc/passwd")).toBeNull();
    expect(resolveStoredPath(join(dataDir, "..", "x"))).toBeNull();
  });
});
