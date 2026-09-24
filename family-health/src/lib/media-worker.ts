/**
 * Worker-thread entry for upload processing. mupdf (WASM) and heic-convert
 * run synchronously, so the daemon offloads them here to keep its event loop
 * responsive. Receives one file per message and replies with the result.
 */
import { parentPort } from "node:worker_threads";
import { processUpload } from "./media.js";

interface Job {
  bytes: Uint8Array;
  filename: string;
  dir: string;
  stem: string;
}

parentPort?.on("message", async (job: Job) => {
  try {
    const result = await processUpload(job.bytes, job.filename, job.dir, job.stem);
    parentPort?.postMessage({ ok: true, result });
  } catch (err) {
    parentPort?.postMessage({ ok: false, error: (err as Error).message });
  }
});
