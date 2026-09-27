/** Regenerate SOURCES.md from src/data (run: pnpm sources:md). */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { INDICATOR_DATA } from "../src/data/indicators.js";
import { renderSourcesMd } from "../src/data/sources-md.js";
import { LOINC_ATTRIBUTION, SOURCES } from "../src/data/sources.js";
import { THRESHOLDS } from "../src/data/thresholds.js";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "SOURCES.md");
writeFileSync(out, renderSourcesMd({ sources: SOURCES, indicators: INDICATOR_DATA, thresholds: THRESHOLDS, loincAttribution: LOINC_ATTRIBUTION }));
console.log(`wrote ${out}`);
