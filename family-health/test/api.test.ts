import { describe, expect, it } from "vitest";
import { statusFor } from "../src/api/index.js";

describe("api error status mapping", () => {
  it("maps codes to HTTP statuses", () => {
    expect(statusFor("member_not_found")).toBe(404);
    expect(statusFor("report_not_found")).toBe(404);
    expect(statusFor("busy")).toBe(409);
    expect(statusFor("report_confirmed")).toBe(409);
    expect(statusFor("invalid_date")).toBe(400);
  });
});
