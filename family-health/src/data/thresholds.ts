/**
 * Decision thresholds (not reference ranges): BMI 分类, 血压分级, 糖尿病诊断切点,
 * 血脂分层, 腰围 腹型肥胖, 尿酸, baPWV / ABI 切点 …
 *
 * Every threshold cites a verified source; they are generated from the
 * research import (verified.ts, see scripts/import-research.mjs for the
 * editorial choices: skipped items, condition-only thresholds, complements).
 */
import type { ThresholdInput } from "./schema.js";
import { VERIFIED_THRESHOLDS } from "./verified.js";

export const THRESHOLDS: ThresholdInput[] = VERIFIED_THRESHOLDS;
