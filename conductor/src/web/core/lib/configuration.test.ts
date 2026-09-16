import { describe, expect, it } from "@rstest/core";
import { reconcileDefaultSelection, workspaceInspectionStatus } from "./configuration.js";

describe("configuration UI state", () => {
  it("follows a changed default-project response for an untouched row", () => {
    expect(reconcileDefaultSelection(true, true, false)).toBe(false);
  });

  it("preserves an unsaved local default toggle", () => {
    expect(reconcileDefaultSelection(true, false, false)).toBe(true);
  });

  it("labels workspace outcomes with generic marked status copy", () => {
    expect(workspaceInspectionStatus({ exists: true, isRepository: true }, null)).toBe("✓ Workspace is ready.");
    expect(workspaceInspectionStatus({ exists: false, isRepository: false }, null)).toBe("✗ Working directory does not exist.");
    expect(workspaceInspectionStatus({ exists: true, isRepository: false }, null)).toBe("⚠ Workspace is unusable.");
    expect(workspaceInspectionStatus({ exists: true, isRepository: false, problem: "Directory is empty." }, null))
      .toBe("⚠ Workspace is unusable: Directory is empty.");
  });
});
