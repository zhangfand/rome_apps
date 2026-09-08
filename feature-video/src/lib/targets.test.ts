import { describe, expect, it } from "@rstest/core";
import { validateTargetSpec } from "./targets.js";
import type { TargetSpec } from "./types.js";

const NO_TARGETS: Record<string, TargetSpec> = {};

describe("validateTargetSpec", () => {
  it("accepts every way of picking an element", () => {
    const specs: TargetSpec[] = [
      { role: "button", name: "Create", exact: true },
      { label: "Name" },
      { text: "Jules Marchetti", exact: true },
      { placeholder: "Search" },
      { testId: "row" },
      { css: "div.row" },
      { xpath: "//form[1]" },
    ];
    for (const spec of specs) {
      expect(validateTargetSpec(spec, "target", NO_TARGETS)).toEqual([]);
    }
  });

  it("accepts the row-of-a-name helper", () => {
    const spec: TargetSpec = {
      css: "div",
      has: { text: "Jules Marchetti", exact: true },
      last: true,
    };
    expect(validateTargetSpec(spec, "target", NO_TARGETS)).toEqual([]);
  });

  it("rejects a spec that is not an object", () => {
    expect(validateTargetSpec("the button", "target", NO_TARGETS)).toEqual([
      'target: expected a target spec object, got "the button"',
    ]);
  });

  it("rejects a spec that picks no element", () => {
    expect(validateTargetSpec({ exact: true }, "target", NO_TARGETS)[0]).toContain(
      "needs one of role, label, text",
    );
  });

  it("rejects a spec that picks an element two ways", () => {
    expect(validateTargetSpec({ role: "button", css: "div" }, "target", NO_TARGETS)).toEqual([
      "target: picks an element 2 ways (role, css)",
    ]);
  });

  it("rejects nth and last together", () => {
    expect(validateTargetSpec({ css: "div", nth: 0, last: true }, "target", NO_TARGETS)).toContain(
      "target: nth and last both narrow the match; keep one",
    );
  });

  it("rejects a non-integer nth", () => {
    expect(validateTargetSpec({ css: "div", nth: 1.5 }, "target", NO_TARGETS)).toContain(
      "target: nth needs a whole number, got 1.5",
    );
  });

  it("rejects a malformed nested has", () => {
    expect(
      validateTargetSpec({ css: "div", has: { exact: true } }, "target", NO_TARGETS)[0],
    ).toContain("target has: needs one of");
  });

  it("resolves a within that names a target", () => {
    const targets: Record<string, TargetSpec> = { switch: { role: "radiogroup", name: "View" } };
    expect(validateTargetSpec({ role: "radio", within: "switch" }, "target", targets)).toEqual([]);
  });

  it("reports a within that names nothing", () => {
    expect(validateTargetSpec({ role: "radio", within: "switch" }, "target", NO_TARGETS)).toEqual([
      'target: within names no target "switch"',
    ]);
  });

  it("stops at a within cycle rather than recursing forever", () => {
    const targets: Record<string, TargetSpec> = {
      a: { css: "div", within: "b" },
      b: { css: "span", within: "a" },
    };
    const problems = validateTargetSpec(targets.a, 'target "a"', targets, new Set(["a"]));
    expect(problems.some((p) => p.includes("is inside itself"))).toBe(true);
  });
});
