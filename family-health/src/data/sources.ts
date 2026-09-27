/**
 * Every source the knowledge base cites. Reviewable data: one object per
 * standard / guideline / code system, referenced by `sourceId` from
 * indicators.ts and thresholds.ts. SOURCES.md is generated from this file
 * (`pnpm sources:md`; a test keeps it in sync).
 *
 * `legacy-unverified` marks the original dictionary numbers and explanations
 * that are NOT yet checked against a standard. Every other source comes from
 * the verified research import (verified.ts, generated). Do not add a source
 * without a verifiable identifier.
 */
import type { Source } from "./schema.js";
import { VERIFIED_SOURCES } from "./verified.js";

export const LEGACY_SOURCE_ID = "legacy-unverified";

export const SOURCES: Source[] = [
  {
    id: LEGACY_SOURCE_ID,
    org: "家庭体检助手",
    title: "应用内置词典（初版，尚未与标准核对）",
    identifier: "内置词典 v0（2026-09）",
    scope: ["reference_range", "explanation", "decision_threshold"],
    level: "unverified",
    retrieved: "2026-09-23",
  },
  ...VERIFIED_SOURCES,
];

/**
 * LOINC attribution notice, required wherever LOINC codes are shown.
 * PLACEHOLDER: the exact wording comes from the verified research (r4/r5);
 * until then no LOINC codes are shown anywhere.
 */
export const LOINC_ATTRIBUTION: string | null = null;
