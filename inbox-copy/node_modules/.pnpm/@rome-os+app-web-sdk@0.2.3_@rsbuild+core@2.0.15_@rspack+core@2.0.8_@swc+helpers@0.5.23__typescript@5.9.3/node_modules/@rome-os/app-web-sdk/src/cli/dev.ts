import { rmSync } from "node:fs";
import { join } from "node:path";
import { createRslib } from "@rslib/core";
import { copyAppIconAsset, copyBackendAssets, createBuildContext } from "./createRslibConfig.js";

export async function runDev(cwd: string = process.cwd()): Promise<void> {
  process.env.NODE_ENV ??= "development";
  const ctx = await createBuildContext({ cwd, mode: "development" });

  for (const dir of ctx.backendDirs) {
    rmSync(join(ctx.outDir, dir), { recursive: true, force: true });
  }

  copyBackendAssets({
    srcDir: ctx.srcDir,
    outDir: ctx.outDir,
  });
  copyAppIconAsset({
    appDir: ctx.appDir,
    outDir: ctx.outDir,
    iconPath: ctx.loaded.yaml.icon,
  });

  const rslib = await createRslib({ config: ctx.rslibConfig });
  await rslib.build({ watch: true });
}
