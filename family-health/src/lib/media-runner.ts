/**
 * Run upload processing in a worker thread with a timeout. Falls back to the
 * in-process implementation when the compiled worker file is not present
 * (unit tests import the TypeScript sources directly).
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { processUpload, type ProcessedUpload } from "./media.js";

/** Base budget per file plus a per-MB allowance (large scans render more pages). */
export function uploadTimeoutMs(bytes: number): number {
  return 60_000 + Math.ceil(bytes / 1_000_000) * 6_000;
}

function workerPath(): string | null {
  try {
    // Built from pieces on purpose: a literal `new URL("./x.js", import.meta.url)`
    // is treated as an asset by the bundler and rewritten to a copied .ts file.
    const file = ["media-worker", "js"].join(".");
    const path = join(dirname(fileURLToPath(import.meta.url)), file);
    return existsSync(path) ? path : null;
  } catch {
    return null;
  }
}

export async function processUploadIsolated(
  bytes: Uint8Array,
  filename: string,
  dir: string,
  stem: string,
  opts: { timeoutMs?: number } = {},
): Promise<ProcessedUpload> {
  const path = workerPath();
  if (!path) return processUpload(bytes, filename, dir, stem);
  const timeoutMs = opts.timeoutMs ?? uploadTimeoutMs(bytes.byteLength);
  const worker = new Worker(path, { resourceLimits: { maxOldGenerationSizeMb: 1024 } });
  try {
    return await new Promise<ProcessedUpload>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`文件处理超时（超过 ${Math.round(timeoutMs / 1000)} 秒）：${filename}`)), timeoutMs);
      worker.once("message", (msg: { ok: boolean; result?: ProcessedUpload; error?: string }) => {
        clearTimeout(timer);
        if (msg.ok && msg.result) resolve(msg.result);
        else reject(new Error(msg.error ?? "文件处理失败"));
      });
      worker.once("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`文件处理失败：${err.message}`));
      });
      worker.once("exit", (code) => {
        clearTimeout(timer);
        if (code !== 0) reject(new Error(`文件处理进程异常退出（${code}）`));
      });
      const copy = bytes.slice();
      worker.postMessage({ bytes: copy, filename, dir, stem }, [copy.buffer]);
    });
  } finally {
    await worker.terminate();
  }
}
