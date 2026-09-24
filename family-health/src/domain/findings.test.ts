import { describe, expect, it } from "vitest";
import { isNormalConclusion } from "./findings.js";

describe("isNormalConclusion", () => {
  it("recognizes normal-only conclusions", () => {
    for (const t of ["窦性心律", "窦性心律 正常心电图", "窦性心律；正常心电图。", "双肾未见明显异常", "胰、脾、双肾未见明显异常", "心电图大致正常"]) {
      expect(isNormalConclusion(t), t).toBe(true);
    }
  });
  it("keeps anything abnormal", () => {
    for (const t of ["窦性心动过缓", "窦性心律不齐", "脂肪肝（轻度）", "窦性心律 ST-T 改变", "甲状腺右叶结节（TI-RADS 3类）", "胆囊息肉（0.4cm）", ""]) {
      expect(isNormalConclusion(t), t).toBe(false);
    }
  });
});
