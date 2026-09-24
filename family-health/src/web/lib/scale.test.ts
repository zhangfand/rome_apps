import { describe, expect, it } from "vitest";
import { niceScale } from "./scale";
import { formatDelta, formatRange, formatUnit, flagVariant } from "./format";
import { parseRoute, paths } from "./router-parse";

describe("niceScale", () => {
  it("rounds bounds to readable steps", () => {
    expect(niceScale(1.35, 3.35)).toEqual({ min: 1, max: 3.5, ticks: [1, 1.5, 2, 2.5, 3, 3.5] });
    const s = niceScale(78.2, 90.6);
    expect(s.ticks.every((t) => Number.isInteger(t) || Math.abs(t * 2 - Math.round(t * 2)) < 1e-9)).toBe(true);
    expect(s.min).toBeLessThanOrEqual(78.2);
    expect(s.max).toBeGreaterThanOrEqual(90.6);
  });
  it("handles degenerate input", () => {
    expect(niceScale(5, 5).ticks).toEqual([]);
  });
});

describe("format helpers", () => {
  it("formats units, ranges and deltas", () => {
    expect(formatUnit("10^9/L")).toBe("10⁹/L");
    expect(formatUnit("10^12/L")).toBe("10¹²/L");
    expect(formatRange({ high: 5.2, highInclusive: false })).toBe("<5.2");
    expect(formatDelta(-0.6)).toBe("↓ 0.6");
    expect(formatDelta(1.25)).toBe("↑ 1.25");
  });
  it("colors flags by direction", () => {
    expect(flagVariant("H", "lower_worse")).toBe("info");
    expect(flagVariant("L", "lower_worse")).toBe("destructive");
    expect(flagVariant("H", "higher_worse")).toBe("destructive");
    expect(flagVariant("normal", "higher_worse")).toBe("muted");
  });
});

describe("routes", () => {
  it("round-trips paths", () => {
    expect(parseRoute(paths.member("demo-self", "all"))).toEqual({ name: "member", id: "demo-self", tab: "all" });
    expect(parseRoute(paths.indicator("m1", "TG"))).toEqual({ name: "indicator", memberId: "m1", code: "TG" });
    expect(parseRoute(paths.reports("m1"))).toEqual({ name: "reports", memberId: "m1" });
    expect(parseRoute(paths.report("r1"))).toEqual({ name: "report", id: "r1" });
    expect(parseRoute("")).toEqual({ name: "overview" });
    expect(parseRoute("nope/x")).toEqual({ name: "notFound", path: "nope/x" });
  });
});
