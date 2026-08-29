import { describe, expect, it } from "vitest";
import type { CharacteristicsResponse } from "../types";
import { compositionDash, compositionDrawOrder, isElectron, isPositiveIon, packMapIsolines } from "./map";

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
  it("packs more ṁ / power curves inside the computed axes", () => {
    const ch = fakeCh();
    const packed = packMapIsolines(ch);
    expect(packed.mdot.length).toBeGreaterThan(ch.mdot_isolines.length);
    expect(packed.power.length).toBeGreaterThan(ch.power_isolines.length);
    const box = { p0: 50, p1: 400, h0: 5, h1: 37 };
    for (const iso of [...packed.mdot, ...packed.power]) {
      expect(iso.pinj_Pa.length).toBeGreaterThanOrEqual(3);
      expect(iso.pinj_Pa.every((p) => p >= box.p0 && p <= box.p1)).toBe(true);
      expect(iso.hinj_MJ_kg.every((h) => h >= box.h0 && h <= box.h1)).toBe(true);
    }
  });
});
