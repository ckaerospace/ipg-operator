import { describe, expect, it } from "vitest";
import { fmtPinjTick, fmtPinjUnit } from "./format";

describe("fmtPinjUnit", () => {
  it("keeps Pa mode in pascals and does not auto-switch at 1000", () => {
    expect(fmtPinjUnit(100, "Pa")).toBe("100 Pa");
    expect(fmtPinjUnit(13, "Pa")).toMatch(/13/);
    expect(fmtPinjUnit(2000, "Pa")).toMatch(/2,000 Pa|2000 Pa/);
  });

  it("shows compact kPa without trailing junk", () => {
    expect(fmtPinjUnit(100, "kPa")).toBe("0.1 kPa");
    expect(fmtPinjUnit(2900, "kPa")).toBe("2.9 kPa");
    expect(fmtPinjUnit(1000, "kPa")).toBe("1 kPa");
    expect(fmtPinjTick(100, "kPa", 50)).toBe("0.1");
    expect(fmtPinjTick(2900, "kPa", 100)).toBe("2.9");
    expect(fmtPinjTick(2000, "Pa", 500)).toMatch(/2,000|2000/);
  });
});
