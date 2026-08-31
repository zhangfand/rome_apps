#!/usr/bin/env node
import("../dist/cli/index.js").catch((err) => {
  process.stderr.write(
    `rome CLI is not built yet. Run: pnpm --filter @rome-os/app-web-sdk build\n`,
  );
  process.stderr.write(`${err?.message ?? err}\n`);
  process.exit(1);
});
