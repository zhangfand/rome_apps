import { rmSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "@rstest/core";
import { freeDisplayNumber } from "./recorder.js";

describe("freeDisplayNumber", () => {
  it("skips a number whose X lock file is still on disk", () => {
    const first = freeDisplayNumber();
    const lock = `/tmp/.X${first}-lock`;
    writeFileSync(lock, "");
    try {
      expect(freeDisplayNumber()).toBeGreaterThan(first);
    } finally {
      rmSync(lock, { force: true });
    }
  });
});
