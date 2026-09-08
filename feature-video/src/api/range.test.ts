import { describe, expect, it } from "@rstest/core";
import { parseRange } from "./index.js";

describe("parseRange", () => {
  it("reads a closed range", () => {
    expect(parseRange("bytes=0-99", 500)).toEqual({ start: 0, end: 99 });
  });

  it("clamps an end past the file to its last byte", () => {
    expect(parseRange("bytes=400-9999", 500)).toEqual({ start: 400, end: 499 });
  });

  it("reads an open range to the end of the file", () => {
    expect(parseRange("bytes=400-", 500)).toEqual({ start: 400, end: 499 });
  });

  it("reads a suffix range as the last bytes", () => {
    expect(parseRange("bytes=-100", 500)).toEqual({ start: 400, end: 499 });
    expect(parseRange("bytes=-9999", 500)).toEqual({ start: 0, end: 499 });
  });

  it("calls a range that starts past the file unsatisfiable", () => {
    expect(parseRange("bytes=500-600", 500)).toBe("unsatisfiable");
    expect(parseRange("bytes=800-", 500)).toBe("unsatisfiable");
    expect(parseRange("bytes=0-0", 0)).toBe("unsatisfiable");
  });

  it("calls a backwards range unsatisfiable", () => {
    expect(parseRange("bytes=300-100", 500)).toBe("unsatisfiable");
  });

  it("asks for no range when the header is absent or not a form it reads", () => {
    expect(parseRange(undefined, 500)).toBeNull();
    expect(parseRange("bytes=-", 500)).toBeNull();
    expect(parseRange("items=0-99", 500)).toBeNull();
    expect(parseRange("bytes=0-99, 200-299", 500)).toBeNull();
  });
});
