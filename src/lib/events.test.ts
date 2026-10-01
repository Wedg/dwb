import { describe, expect, it } from "vitest";
import { parseEventName, suggestEventName } from "./events";

describe("parseEventName", () => {
  it("trims and collapses spaces", () => {
    expect(parseEventName("  Spring   Champs 2026 ")).toEqual({ name: "Spring Champs 2026" });
  });

  it("rejects blank, missing and overlong names", () => {
    expect(parseEventName("   ")).toHaveProperty("error");
    expect(parseEventName(undefined)).toHaveProperty("error");
    expect(parseEventName("x".repeat(81))).toHaveProperty("error");
  });
});

describe("suggestEventName", () => {
  it("bumps an older year", () => {
    expect(suggestEventName("Spring Champs 2026", 2027)).toBe("Spring Champs 2027");
  });

  it("keeps a current or future year", () => {
    expect(suggestEventName("Spring Champs 2026", 2026)).toBe("Spring Champs 2026");
    expect(suggestEventName("Spring Champs 2027", 2026)).toBe("Spring Champs 2027");
  });

  it("keeps names without a year, and has a default", () => {
    expect(suggestEventName("Test run", 2027)).toBe("Test run");
    expect(suggestEventName(null, 2027)).toBe("Spring Champs 2027");
  });
});
