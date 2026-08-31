import { rmSync } from "node:fs";
import { join } from "node:path";
import { createRslib } from "@rslib/core";
import { copyAppIconAsset, copyBackendAssets, createBuildContext } from "./createRslibConfig.js";

export async function runBuild(cwd: string = process.cwd()): Promise<void> {
  process.env.NODE_ENV ??= "production";
  const ctx = await createBuildContext({ cwd, mode: "production" });

  for (const dir of ctx.backendDirs) {
    rmSync(join(ctx.outDir, dir), { recursive: true, force: true });
  }

  const rslib = await createRslib({ config: ctx.rslibConfig });
  await rslib.build();

  copyBackendAssets({
    srcDir: ctx.srcDir,
    outDir: ctx.outDir,
  });
  copyAppIconAsset({
    appDir: ctx.appDir,
    outDir: ctx.outDir,
    iconPath: ctx.loaded.yaml.icon,
  });
}
