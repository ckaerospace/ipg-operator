import { describe, expect, it } from "vitest";
import {
  axisFamily,
  clampHinj,
  coerceOperatingPoint,
  geometryOf,
  HINJ_MJ_MAX,
  HINJ_MJ_MIN,
  KNOWN_POINTS,
  mdotMgLimits,
  pinjLimits,
} from "./facility";

describe("family editor clamps", () => {
  it("widens pinj and mdot without moving mins or known points", () => {
    expect(pinjLimits("IPG6-S")).toEqual({ min: 5, max: 2000, step: 1 });
    expect(pinjLimits("IPG4")).toEqual({ min: 50, max: 10000, step: 10 });
    expect(pinjLimits("IPG3")).toEqual({ min: 50, max: 8000, step: 10 });
    expect(mdotMgLimits("IPG6-S")).toEqual({ min: 1, max: 200 });
    expect(mdotMgLimits("IPG4")).toEqual({ min: 200, max: 10000 });
    expect(mdotMgLimits("IPG3")).toEqual({ min: 400, max: 15000 });

    expect(coerceOperatingPoint("IPG6-S", 100, 13)).toEqual({ pinj: 100, mdot_mg_s: 13 });
    expect(coerceOperatingPoint("IPG4", 2900, 2200)).toEqual({ pinj: 2900, mdot_mg_s: 2200 });
    expect(coerceOperatingPoint("IPG3", 1450, 3210)).toEqual({ pinj: 1450, mdot_mg_s: 3210 });
    expect(coerceOperatingPoint("IPG6-S", 9, 400).mdot_mg_s).toBe(13);

    for (const k of KNOWN_POINTS) {
      const family = k.facility === "Custom" ? "IPG6-S" : k.facility;
      const p = pinjLimits(family);
      const m = mdotMgLimits(family);
      expect(k.pinj).toBeGreaterThanOrEqual(p.min);
      expect(k.pinj).toBeLessThanOrEqual(p.max);
      if (k.mdot_mg_s != null) {
        expect(k.mdot_mg_s).toBeGreaterThanOrEqual(m.min);
        expect(k.mdot_mg_s).toBeLessThanOrEqual(m.max);
      }
    }
    expect(HINJ_MJ_MIN).toBe(1);
    expect(HINJ_MJ_MAX).toBe(70);
    expect(clampHinj(23)).toBe(23);
    expect(clampHinj(15)).toBe(15);
    expect(clampHinj(30)).toBe(30);
    expect(clampHinj(0)).toBe(1);
    expect(clampHinj(80)).toBe(70);
  });

  it("Custom IPG posts editor diameters and nozzle_name custom", () => {
    expect(geometryOf("Custom", { dc: 40, dt: 50, de: 60 })).toEqual({
      d_c_mm: 40,
      d_t_mm: 50,
      d_e_mm: 60,
      nozzle_name: "custom",
    });
    expect(geometryOf("IPG6-S", { dc: 40, dt: 50, de: 60 })).toEqual({
      d_c_mm: 37,
      d_t_mm: 20,
      d_e_mm: 40,
      nozzle_name: "IPG6-S",
    });
    expect(axisFamily("Custom", 70)).toBe("IPG3");
    expect(axisFamily("Custom", 45)).toBe("IPG4");
    expect(axisFamily("Custom", 20)).toBe("IPG6-S");
  });
});
