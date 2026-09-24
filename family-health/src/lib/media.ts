/**
 * Upload processing for checkup reports: detect the file type, convert HEIC
 * photos to JPEG, rasterize PDFs page by page, and downscale everything to a
 * vision-friendly size. Pure JS/WASM only (mupdf + heic-convert): no system
 * binaries, no network.
 *
 * mupdf renders synchronously on the calling thread, so page rendering is an
 * async generator that yields to the event loop between pages — a 30-page scan
 * never blocks the host process for more than one page at a time.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { setImmediate as yieldToLoop } from "node:timers/promises";
import heicConvert from "heic-convert";
import * as mupdf from "mupdf";

/** Long edge in pixels for page images handed to the vision model. */
export const PAGE_LONG_EDGE = 1600;
export const PAGE_JPEG_QUALITY = 85;
/** Upper bound on pages rendered from one PDF (guards against huge files). */
export const MAX_PDF_PAGES = 80;

export type SupportedMime = "application/pdf" | "image/jpeg" | "image/png" | "image/heic" | "image/webp";

/** Detect the real file type from magic bytes, falling back to the extension. */
export function sniffMime(bytes: Uint8Array, filename = ""): SupportedMime | null {
  const b = bytes;
  const ascii = (start: number, len: number) => String.fromCharCode(...b.subarray(start, start + len));
  if (b.length >= 5 && ascii(0, 5) === "%PDF-") return "application/pdf";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 3) === "PNG") return "image/png";
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (b.length >= 12 && ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4).toLowerCase();
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) return "image/heic";
  }
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "heic" || ext === "heif") return "image/heic";
  return null;
}

/** Decode a HEIC/HEIF photo to JPEG bytes. */
export async function heicToJpeg(bytes: Uint8Array, quality = 0.92): Promise<Uint8Array> {
  const out = await heicConvert({ buffer: bytes, format: "JPEG", quality });
  return new Uint8Array(out);
}

export interface RenderedPage {
  /** 0-based page index within the source document. */
  index: number;
  jpeg: Uint8Array;
  width: number;
  height: number;
}

/** Number of pages mupdf sees in a PDF / image. */
export function countPages(bytes: Uint8Array, mime: SupportedMime): number {
  const doc = mupdf.Document.openDocument(bytes, mime);
  try {
    return doc.countPages();
  } finally {
    doc.destroy();
  }
}

/**
 * Render every page of a PDF (or a single image) to a JPEG whose long edge is
 * at most `longEdge` pixels. Images smaller than that are not upscaled.
 * HEIC must be converted with `heicToJpeg` first.
 */
export async function* renderPages(
  bytes: Uint8Array,
  mime: Exclude<SupportedMime, "image/heic">,
  opts: { longEdge?: number; quality?: number; maxPages?: number } = {},
): AsyncGenerator<RenderedPage> {
  const longEdge = opts.longEdge ?? PAGE_LONG_EDGE;
  const quality = opts.quality ?? PAGE_JPEG_QUALITY;
  // mupdf opens an image as a one-page document whose bounds are in points at
  // the image's DPI (96 by default) and already rotated by its EXIF
  // orientation. Use the true pixel size so photos are never upscaled.
  let imageLongPx: number | null = null;
  if (mime !== "application/pdf") {
    const img = new mupdf.Image(bytes);
    try {
      imageLongPx = Math.max(img.getWidth(), img.getHeight());
    } finally {
      img.destroy();
    }
  }
  const doc = mupdf.Document.openDocument(bytes, mime);
  try {
    const n = Math.min(doc.countPages(), opts.maxPages ?? MAX_PDF_PAGES);
    for (let i = 0; i < n; i++) {
      const page = doc.loadPage(i);
      try {
        const [x0, y0, x1, y1] = page.getBounds();
        const sizePt = Math.max(x1 - x0, y1 - y0);
        const targetPx = imageLongPx == null ? longEdge : Math.min(longEdge, imageLongPx);
        const scale = targetPx / sizePt;
        const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
        try {
          yield { index: i, jpeg: pix.asJPEG(quality, false), width: pix.getWidth(), height: pix.getHeight() };
        } finally {
          pix.destroy();
        }
      } finally {
        page.destroy();
      }
      await yieldToLoop();
    }
  } finally {
    doc.destroy();
  }
}

export interface ProcessedUpload {
  mime: SupportedMime;
  /** Absolute path of the stored original (HEIC stored as converted JPEG). */
  sourcePath: string;
  pages: Array<{ index: number; path: string; width: number; height: number }>;
}

/**
 * Store one uploaded file under `dir/sources` and its rendered pages under
 * `dir/pages`. `stem` must be unique within the report (e.g. `f03`).
 */
export async function processUpload(bytes: Uint8Array, filename: string, dir: string, stem: string): Promise<ProcessedUpload> {
  const mime = sniffMime(bytes, filename);
  if (!mime) throw new Error(`不支持的文件类型：${filename}（请上传 PDF、JPG、PNG 或 HEIC）`);

  let renderBytes = bytes;
  let renderMime: Exclude<SupportedMime, "image/heic">;
  let sourcePath: string;
  if (mime === "image/heic") {
    renderBytes = await heicToJpeg(bytes);
    renderMime = "image/jpeg";
    sourcePath = join(dir, "sources", `${stem}.jpg`);
  } else {
    renderMime = mime;
    const ext = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[mime];
    sourcePath = join(dir, "sources", `${stem}.${ext}`);
  }
  writeFileSync(sourcePath, renderBytes);

  const pages: ProcessedUpload["pages"] = [];
  for await (const p of renderPages(renderBytes, renderMime)) {
    const path = join(dir, "pages", `${stem}-p${String(p.index + 1).padStart(3, "0")}.jpg`);
    writeFileSync(path, p.jpeg);
    pages.push({ index: p.index, path, width: p.width, height: p.height });
  }
  if (pages.length === 0) throw new Error(`文件没有可识别的页面：${filename}`);
  return { mime, sourcePath, pages };
}
