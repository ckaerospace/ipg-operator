import { describe, expect, it } from "vitest";
import { stripItems } from "./App";
import type { SolveResponse } from "./types";

function fakeSolve(over: Partial<SolveResponse["cea"]> = {}): SolveResponse {
  const nx = 3;
  const ny = 3;
  const n = Array.from({ length: nx * ny }, () => 0.2);
  return {
    cea: {
      pinj_Pa: 100,
      hinj_MJ_kg: 23,
      mdot_mg_s: 12.9,
      power_W: 296,
      exit: {
        T0: 2613,
        U0: 3490,
        MW: 0.016,
        gamma: 1.4,
        R: 520,
        mole_fractions: { O: 0.94, "e-": 0.001 },
        x_O: 0.944,
      },
      ...over,
    },
    plume: {
      T0: 2613,
      U0: 3490,
      n0: 1.2e20,
      H: 0.025,
      mode: "collisionless",
      kn_gll_exit: 0.2,
      xmax_m: 1,
      ymax_m: 0.4,
      nx,
      ny,
      x: [0, 0.5, 1],
      y: [0, 0.2, 0.4],
      n_ratio: n,
      u: n,
      v: n,
      t_ratio: n,
      speed: n,
      mach: n,
      e_kin_eV: n,
      e_O_eV: n,
      h_tot_MJ_kg: n,
      h_tot_ratio: n,
    },
  };
}

describe("header strip", () => {
  it("shows n0 and power after hinj, never a p/pinj key", () => {
    const rows = stripItems(fakeSolve(), "IPG6-S", 10, false, null);
    const keys = rows.map((r) => r.k);
    expect(keys.slice(0, 4)).toEqual(["hinj", "n0", "power", "T_exit"]);
    expect(keys).toContain("ṁ");
    expect(keys).not.toContain("p");
    expect(keys).not.toContain("pinj");
    expect(keys).not.toContain("p_tank");
    expect(keys).not.toContain("p_probe");
    expect(keys).not.toContain("NPR");
    expect(keys).not.toContain("Kn_exit");
    expect(rows.find((r) => r.k === "n0")?.v).toBe("1.2e20 m⁻³");
    expect(rows.find((r) => r.k === "power")?.v).toMatch(/296 W|W/);
  });

  it("falls back to ṁ × hinj when power_W is missing", () => {
    const cea = fakeSolve().cea;
    delete cea.power_W;
    const rows = stripItems(fakeSolve({ ...cea, power_W: undefined }), "IPG6-S", 10, false, null);
    const power = rows.find((r) => r.k === "power");
    expect(power?.k).toBe("power");
    expect(power?.v).toMatch(/W/);
    expect(power?.v).not.toMatch(/Pa/);
  });
});
