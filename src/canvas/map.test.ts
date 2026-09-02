import { describe, expect, it } from "vitest";
import type { CharacteristicsResponse } from "../types";
import { axesView, compositionDash, compositionDrawOrder, isElectron, isPositiveIon, mapLayout, mapOperatingPointCss, packMapIsolines } from "./map";

function fakeCh(): CharacteristicsResponse {
  const hinj_MJ_kg = Array.from({ length: 9 }, (_, i) => 5 + i * 4);
  return {
    pinj_ref_Pa: 100,
    hinj_MJ_kg,
    k_kg_s_Pa: hinj_MJ_kg.map(() => 2e-8),
    chamber: {
      T: hinj_MJ_kg.map(() => 3000),
      MW: hinj_MJ_kg.map(() => 0.016),
      mdot_mg_s: hinj_MJ_kg.map(() => 2000),
      x: {},
    },
    kinks: [],
    mdot_isolines: [{ mdot_mg_s: 2000, pinj_Pa: [80, 200], hinj_MJ_kg: [10, 20] }],
    power_isolines: [{ power_W: 4e4, pinj_Pa: [80, 200], hinj_MJ_kg: [10, 20] }],
    axes: { pinj_Pa: [50, 400], hinj_MJ_kg: [5, 37] },
  };
}

describe("composition stroke order", () => {
  it("draws neutrals, then cations, then dashed e- last", () => {
    expect(compositionDrawOrder(["e-", "O+", "O", "O2"])).toEqual(["O", "O2", "O+", "e-"]);
    expect(compositionDrawOrder(["N+", "e-", "N2", "Ar+", "Ar"])).toEqual(["N2", "Ar", "N+", "Ar+", "e-"]);
  });

  it("keeps O+ and paints dashed e- on top so red shows in the gaps", () => {
    const keys = compositionDrawOrder(["O2", "O", "e-", "O+"]);
    expect(keys).toContain("O+");
    expect(keys).toContain("e-");
    expect(keys.indexOf("e-")).toBeGreaterThan(keys.indexOf("O+"));
    expect(keys[keys.length - 1]).toBe("e-");
  });

  it("dashes only e-; ions stay solid", () => {
    expect(isElectron("e-")).toBe(true);
    expect(isPositiveIon("O+")).toBe(true);
    expect(isPositiveIon("N+")).toBe(true);
    expect(isPositiveIon("Ar+")).toBe(true);
    expect(isPositiveIon("C+")).toBe(true);
    expect(isPositiveIon("O2+")).toBe(true);
    expect(isPositiveIon("O")).toBe(false);
    expect(compositionDash("e-")).toEqual([4, 3]);
    expect(compositionDash("O+")).toEqual([]);
    expect(compositionDash("O")).toEqual([]);
  });
});

describe("packMapIsolines", () => {
  it("uses the family pinj clamp, not the API catalog clip", () => {
    const ch = fakeCh();
    expect(axesView(ch, "IPG6-S")).toEqual({ p0: 0, p1: 2000, h0: 5, h1: 37 });
    const packed = packMapIsolines(ch, "IPG6-S");
    expect(packed.mdot.length).toBeGreaterThan(ch.mdot_isolines.length);
    expect(packed.power.length).toBeGreaterThan(ch.power_isolines.length);
    const box = { p0: 0, p1: 2000, h0: 5, h1: 37 };
    let maxP = 0;
    for (const iso of [...packed.mdot, ...packed.power]) {
      expect(iso.pinj_Pa.length).toBeGreaterThanOrEqual(3);
      expect(iso.pinj_Pa.every((p) => p >= box.p0 && p <= box.p1)).toBe(true);
      expect(iso.hinj_MJ_kg.every((h) => h >= box.h0 && h <= box.h1)).toBe(true);
      maxP = Math.max(maxP, ...iso.pinj_Pa);
    }
    expect(maxP).toBeGreaterThan(400);
  });

  it("picks ṁ levels from the current Map window, not the fitted box", () => {
    const ch = fakeCh();
    const view = { p0: 40, p1: 160, h0: 12, h1: 22 };
    const packed = packMapIsolines(ch, "IPG6-S", view);
    expect(packed.mdot.length).toBeGreaterThanOrEqual(4);
    for (const iso of packed.mdot) {
      expect(iso.mdot_mg_s).toBeGreaterThan(0);
      expect(iso.pinj_Pa.every((p) => p >= view.p0 - 1e-9 && p <= view.p1 + 1e-9)).toBe(true);
      expect(iso.hinj_MJ_kg.every((h) => h >= view.h0 - 1e-9 && h <= view.h1 + 1e-9)).toBe(true);
    }
    const fitted = packMapIsolines(ch, "IPG6-S");
    const viewMax = Math.max(...packed.mdot.map((i) => i.mdot_mg_s ?? 0));
    const fitMax = Math.max(...fitted.mdot.map((i) => i.mdot_mg_s ?? 0));
    expect(viewMax).toBeLessThan(fitMax);
  });
});

describe("mapOperatingPointCss", () => {
  it("places the marker at exact pinj and hinj, not the nearest CEA hinj node", () => {
    const view = { p0: 0, p1: 2000, h0: 1, h1: 70 };
    const lay = mapLayout(400, 300, view);
    const ceaNodes = Array.from({ length: 29 }, (_, i) => 1 + (i * 69) / 28);
    const at = mapOperatingPointCss(lay, 150, 23);
    expect(at.x).toBe(lay.toX(150));
    expect(at.y).toBe(lay.toY(23));
    expect(at.x).not.toBe(lay.toX(100));
    for (const node of ceaNodes) {
      if (Math.abs(node - 23) < 1e-9) continue;
      expect(at.y).not.toBe(lay.toY(node));
    }
    const yLinear = lay.t + lay.h - ((23 - view.h0) / (view.h1 - view.h0)) * lay.h;
    expect(at.y).toBeCloseTo(yLinear, 12);
    const xLinear = lay.l + ((150 - view.p0) / (view.p1 - view.p0)) * lay.w;
    expect(at.x).toBeCloseTo(xLinear, 12);
  });
});
