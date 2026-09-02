import { describe, expect, it } from "vitest";
import { DEFAULT_LAYER, LAYER_LABEL, operatorLayer, parseLayer } from "./layer";
import { BUG_REPORT_URL, routeForPath } from "./routes";
import { buildSolveBody, solveBodyJson } from "./solveBody";
import type { SolveInput } from "./solveBody";

const base: SolveInput = {
  layer: "thesis",
  plumeMode: "auto",
  mode: "generator",
  mixture: { O2: 1 },
  d_c_mm: 37,
  d_t_mm: 20,
  d_e_mm: 40,
  nozzle_name: "IPG6-S",
  pinj_Pa: 100,
  hinj_MJ_kg: 23,
  mdot_mg_s: 13,
  p_tank_Pa: 25,
};

describe("layers", () => {
  it("defaults to Thesis and treats Advanced as Thesis", () => {
    expect(DEFAULT_LAYER).toBe("thesis");
    expect(parseLayer(null)).toBe("thesis");
    expect(parseLayer(undefined)).toBe("thesis");
    expect(parseLayer("nope")).toBe("thesis");
    expect(parseLayer("advanced")).toBe("thesis");
    expect(operatorLayer("advanced")).toBe("thesis");
    expect(operatorLayer("manual")).toBe("thesis");
    expect(parseLayer("manual")).toBe("manual");
    expect(LAYER_LABEL.manual).toBe("Model");
    expect(operatorLayer("thesis")).toBe("thesis");
  });
});

describe("solve body", () => {
  it("always posts collisionless and omits p_tank_Pa and probe fields", () => {
    for (const plumeMode of ["auto", "collisionless", "sudden_freeze"] as const) {
      const json = solveBodyJson({ ...base, layer: "thesis", plumeMode, p_tank_Pa: 25 });
      expect(json.plume_mode).toBe("collisionless");
      expect(json).not.toHaveProperty("p_tank_Pa");
    }
    const locked = buildSolveBody({ ...base, layer: "manual", plumeMode: "sudden_freeze" });
    expect(locked.plume_mode).toBe("collisionless");
    expect(locked.p_tank_Pa).toBeUndefined();

    const withProbe = solveBodyJson({
      ...base,
      layer: "advanced",
      plumeMode: "sudden_freeze",
      p_tank_Pa: 40,
      probe_x_m: 0.12,
      probe_r_mm: 20,
      probe_Tw_K: 300,
    });
    expect(withProbe.plume_mode).toBe("collisionless");
    expect(withProbe).not.toHaveProperty("p_tank_Pa");
    expect(withProbe).not.toHaveProperty("probe_x_m");
    expect(withProbe).not.toHaveProperty("probe_r_mm");
    expect(withProbe).not.toHaveProperty("probe_Tw_K");
  });
});

describe("routes", () => {
  it("has a Model notes route at /model", () => {
    expect(routeForPath("/model")).toBe("model");
    expect(routeForPath("/model/")).toBe("model");
    expect(routeForPath("/")).toBe("app");
    expect(routeForPath("/plume")).toBe("app");
  });

  it("points bug reports at the public issue form", () => {
    expect(BUG_REPORT_URL).toBe("https://github.com/ckaerospace/ipg-operator/issues/new?template=bug.yml");
  });
});
