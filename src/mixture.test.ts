import { describe, expect, it } from "vitest";
import { GASES, mixtureFor } from "./facility";
import {
  emptyCustomMix,
  encodeMixParam,
  mixLabel,
  mixtureSum,
  normalizeMixture,
  parseMixParam,
  resolveMixture,
  seedCustomMix,
} from "./mixture";
import { buildSolveBody } from "./solveBody";

const solveBase = {
  layer: "thesis" as const,
  plumeMode: "auto" as const,
  mode: "generator" as const,
  d_c_mm: 37,
  d_t_mm: 20,
  d_e_mm: 40,
  nozzle_name: "IPG6-S",
  pinj_Pa: 100,
  hinj_MJ_kg: 23,
  mdot_mg_s: 13,
  p_tank_Pa: 10,
};

describe("normalizeMixture", () => {
  it("normalizes positive fractions to 1 and omits zeros", () => {
    const n = normalizeMixture({ O2: 0.3, N2: 0, CO2: 0, He: 0.7, Ar: 0 });
    expect(n).toEqual({ O2: 0.3, He: 0.7 });
    expect(Object.keys(n!)).toEqual(["O2", "He"]);
  });

  it("scales a 70/30 editor entry that already sums to 1", () => {
    const n = normalizeMixture(seedCustomMix({ He: 0.7, O2: 0.3 }));
    expect(n).toEqual({ O2: 0.3, He: 0.7 });
  });

  it("scales unnormalized positives", () => {
    const n = normalizeMixture({ O2: 1, N2: 1, CO2: 0, He: 0, Ar: 0 });
    expect(n).toEqual({ O2: 0.5, N2: 0.5 });
  });

  it("returns null when the sum is 0", () => {
    expect(normalizeMixture(emptyCustomMix())).toBeNull();
    expect(normalizeMixture({ O2: 0, N2: -1, CO2: Number.NaN, He: 0, Ar: 0 })).toBeNull();
    expect(mixtureSum(emptyCustomMix())).toBe(0);
  });
});

describe("mix share tokens", () => {
  it("encodes compact canonical order and round-trips", () => {
    const seeded = seedCustomMix({ He: 0.7, O2: 0.3 });
    expect(encodeMixParam(seeded)).toBe("O2:0.3,He:0.7");
    expect(parseMixParam("He:0.7,O2:0.3")).toEqual(seeded);
    expect(parseMixParam("O2:0.3,He:0.7")).toEqual(seeded);
  });

  it("ignores H2 and other non-IPG species", () => {
    const parsed = parseMixParam("H2:0.5,O2:0.5,CH4:0.1");
    expect(parsed).toEqual({ O2: 0.5, N2: 0, CO2: 0, He: 0, Ar: 0 });
    expect(parseMixParam("H2:1,NH3:1")).toBeNull();
  });
});

describe("preset mixtures", () => {
  it("still sends the catalog mole maps for named gases", () => {
    expect(mixtureFor("O2")).toEqual({ O2: 1 });
    expect(mixtureFor("CO2")).toEqual({ CO2: 1 });
    expect(mixtureFor("N2")).toEqual({ N2: 1 });
    expect(mixtureFor("Air")).toEqual({ N2: 0.79, O2: 0.21 });
    expect(mixtureFor("HeO2")).toEqual({ He: 0.7, O2: 0.3 });
    expect(mixtureFor("Ar")).toEqual({ Ar: 1 });
    for (const g of GASES) {
      const body = buildSolveBody({ ...solveBase, mixture: resolveMixture(g.id, emptyCustomMix())! });
      expect(body.mixture).toEqual(g.mixture);
      expect(body.basis).toBe("mole");
    }
  });

  it("seeds Custom from a preset and normalizes that seed", () => {
    const seeded = seedCustomMix(mixtureFor("HeO2"));
    expect(seeded).toEqual({ O2: 0.3, N2: 0, CO2: 0, He: 0.7, Ar: 0 });
    expect(resolveMixture("custom", seeded)).toEqual({ O2: 0.3, He: 0.7 });
    expect(mixLabel({ O2: 0.3, He: 0.7 })).toBe("O2 0.30 · He 0.70");
  });
});
