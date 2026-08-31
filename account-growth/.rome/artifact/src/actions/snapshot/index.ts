import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import {
  createAppLogger,
  defineAction,
  z,
  type Action,
  type ActionConfig,
  type AppActionRuntimeDeps,
} from "@rome-os/app-runtime";

const execFileAsync = promisify(execFile);
const log = createAppLogger("account-growth:snapshot");
const CDP_ENDPOINT = "http://127.0.0.1:9223";

const snapshotSchema = z.object({
  xLimit: z.number().int().min(10).max(100).optional().describe("Number of recent X posts to read"),
  linkedInLimit: z
    .number()
    .int()
    .min(5)
    .max(50)
    .optional()
    .describe("Number of recent LinkedIn posts to read"),
});

async function runOpenCli(site: string, args: string[]): Promise<unknown> {
  const { stdout } = await execFileAsync(
    "opencli",
    [
      "--cdp-endpoint",
      CDP_ENDPOINT,
      site,
      ...args,
      "-f",
      "json",
      "--window",
      "background",
      "--site-session",
      "persistent",
      "--keep-tab",
      "false",
    ],
    { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

interface SnapshotData {
  capturedAt: string;
  xProfile: unknown;
  xPosts: unknown;
  linkedInProfile: unknown;
  linkedInPosts: unknown;
  linkedInAnalytics: unknown;
}

async function readInitialSnapshot(): Promise<SnapshotData> {
  const path = new URL("../../assets/initial-snapshot.json", import.meta.url);
  return JSON.parse(await readFile(path, "utf8")) as SnapshotData;
}

export function createAction(config: ActionConfig, _deps: AppActionRuntimeDeps): Action {
  return defineAction({
    config,
    schema: snapshotSchema,
    execute: async ({ xLimit = 50, linkedInLimit = 30 }) => {
      const snapshot = await readInitialSnapshot();
      const freshness: Record<string, "live" | "baseline"> = {
        xProfile: "baseline",
        xPosts: "baseline",
        linkedInProfile: "baseline",
        linkedInPosts: "baseline",
        linkedInAnalytics: "baseline",
      };
      const warnings: string[] = [];

      async function refresh(key: keyof Omit<SnapshotData, "capturedAt">, task: () => Promise<unknown>) {
        try {
          snapshot[key] = await task();
          freshness[key] = "live";
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          warnings.push(`${key}: ${message}`);
          log.warn("using baseline snapshot component", { key, error: message });
        }
      }

      await refresh("xProfile", () => runOpenCli("twitter", ["profile", "realYunfanYe"]));
      await refresh("xPosts", () =>
        runOpenCli("twitter", [
          "tweets",
          "realYunfanYe",
          "--limit",
          String(xLimit),
          "--page-delay",
          "1",
        ]),
      );
      await refresh("linkedInProfile", () =>
        runOpenCli("linkedin", [
          "profile-read",
          "--profile-url",
          "https://www.linkedin.com/in/yunfanye/",
        ]),
      );
      await refresh("linkedInPosts", () =>
        runOpenCli("linkedin", [
          "posts",
          "--profile-url",
          "https://www.linkedin.com/in/yunfanye/",
          "--limit",
          String(linkedInLimit),
        ]),
      );
      await refresh("linkedInAnalytics", () =>
        runOpenCli("linkedin", [
          "post-analytics",
          "--profile-url",
          "https://www.linkedin.com/in/yunfanye/",
          "--limit",
          String(linkedInLimit),
        ]),
      );

      const anyLive = Object.values(freshness).some((value) => value === "live");
      return {
        status: "ok",
        data: {
          ...snapshot,
          capturedAt: anyLive ? new Date().toISOString() : snapshot.capturedAt,
          freshness,
          warnings,
          note:
            warnings.length > 0
              ? "Some live reads were unavailable or rate-limited; baseline values are explicitly marked."
              : "All account signals were refreshed live.",
        },
      };
    },
  });
}
