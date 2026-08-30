import { describe, expect, it } from "vitest";
import { coupledPowerW, fmtN0, fmtPinjPa, fmtPinjTick, fmtPower } from "./format";

describe("fmtPinjPa", () => {
  it("stays in pascals and does not auto-promote at 1000", () => {
    expect(fmtPinjPa(100)).toBe("100 Pa");
    expect(fmtPinjPa(13)).toMatch(/13/);
    expect(fmtPinjPa(2000)).toMatch(/2,000 Pa|2000 Pa/);
    expect(fmtPinjPa(5000)).toMatch(/5,000 Pa|5000 Pa/);
    expect(fmtPinjPa(2000)).not.toMatch(/kPa/);
    expect(fmtPinjTick(2000, 500)).toMatch(/2,000|2000/);
    expect(fmtPinjTick(2000, 500)).not.toMatch(/kPa/);
  });
});

describe("fmtN0", () => {
  it("prints compact scientific exit number density", () => {
    expect(fmtN0(1.2e20)).toBe("1.2e20 m⁻³");
    expect(fmtN0(1e20)).toBe("1.0e20 m⁻³");
    expect(fmtN0(undefined)).toBe("—");
    expect(fmtN0(Number.NaN)).toBe("—");
  });
});

describe("coupledPowerW", () => {
  it("prefers cea.power_W and otherwise uses ṁ × hinj", () => {
    expect(coupledPowerW({ power_W: 296, mdot_mg_s: 13, hinj_MJ_kg: 23 })).toBe(296);
    expect(coupledPowerW({ mdot_mg_s: 12.9, hinj_MJ_kg: 23 })).toBeCloseTo(12.9 * 23);
    expect(fmtPower(296)).toBe("296 W");
    expect(fmtPower(2500)).toMatch(/2\.5 kW/);
  });
});
