import { describe, expect, it } from "vitest";
import { DEFAULT_LAYER, LAYER_LABEL, operatorLayer, parseLayer } from "./layer";
import { BUG_REPORT_URL, routeForPath } from "./routes";
import { buildSolveBody, SOLVE_NX, SOLVE_NY, solveBodyJson } from "./solveBody";
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
  it("defaults to Thesis", () => {
    expect(DEFAULT_LAYER).toBe("thesis");
    expect(parseLayer(null)).toBe("thesis");
    expect(parseLayer(undefined)).toBe("thesis");
    expect(parseLayer("nope")).toBe("thesis");
    expect(operatorLayer("manual")).toBe("thesis");
    expect(parseLayer("manual")).toBe("manual");
    expect(LAYER_LABEL.manual).toBe("Model");
    expect(operatorLayer("thesis")).toBe("thesis");
  });

  it("keeps Advanced as the operator layer", () => {
    expect(parseLayer("advanced")).toBe("advanced");
    expect(operatorLayer("advanced")).toBe("advanced");
  });
});

describe("solve body", () => {
  it("posts an odd 97×97 plume field so y=0 can sit on a grid node", () => {
    expect(SOLVE_NX).toBe(97);
    expect(SOLVE_NY).toBe(97);
    expect(SOLVE_NX % 2).toBe(1);
    expect(SOLVE_NY % 2).toBe(1);
    const json = solveBodyJson(base);
    expect(json.nx).toBe(97);
    expect(json.ny).toBe(97);
  });

  it("Thesis always posts collisionless and omits p_tank_Pa", () => {
    for (const plumeMode of ["auto", "collisionless", "sudden_freeze"] as const) {
      const json = solveBodyJson({ ...base, layer: "thesis", plumeMode, p_tank_Pa: 25 });
      expect(json.plume_mode).toBe("collisionless");
      expect(json).not.toHaveProperty("p_tank_Pa");
    }
    const locked = buildSolveBody({ ...base, layer: "manual", plumeMode: "sudden_freeze" });
    expect(locked.plume_mode).toBe("collisionless");
    expect(locked.p_tank_Pa).toBeUndefined();
  });

  it("posts probe disk fields on Thesis and Advanced, and still omits tank on Thesis", () => {
    const thesis = solveBodyJson({
      ...base,
      layer: "thesis",
      probe_x_m: 0.12,
      probe_r_mm: 20,
      probe_Tw_K: 300,
    });
    expect(thesis.plume_mode).toBe("collisionless");
    expect(thesis.probe_x_m).toBe(0.12);
    expect(thesis.probe_r_mm).toBe(20);
    expect(thesis.probe_Tw_K).toBe(300);
    expect(thesis).not.toHaveProperty("p_tank_Pa");

    const adv = solveBodyJson({
      ...base,
      layer: "advanced",
      probe_x_m: 0.08,
      probe_r_mm: 50,
      probe_Tw_K: 300,
    });
    expect(adv.probe_x_m).toBe(0.08);
    expect(adv.probe_r_mm).toBe(50);
    expect(adv.p_tank_Pa).toBe(25);
  });

  it("omits probe fields when the disk is not placed", () => {
    const json = solveBodyJson({ ...base, layer: "advanced" });
    expect(json).not.toHaveProperty("probe_x_m");
    expect(json).not.toHaveProperty("probe_r_mm");
    expect(json).not.toHaveProperty("probe_Tw_K");
  });

  it("posts pinj plus either hinj or ṁ — never power as a free key", () => {
    const hinj = solveBodyJson({ ...base, mode: "enthalpy" });
    expect(hinj.hinj_MJ_kg).toBe(23);
    expect(hinj).not.toHaveProperty("mdot_mg_s");
    expect(hinj).not.toHaveProperty("power_W");
    expect(hinj).not.toHaveProperty("power");
    const gen = solveBodyJson({ ...base, mode: "generator" });
    expect(gen.mdot_mg_s).toBe(13);
    expect(gen).not.toHaveProperty("hinj_MJ_kg");
    expect(gen).not.toHaveProperty("power_W");
  });

  it("Advanced can post auto or sudden_freeze and p_tank_Pa", () => {
    const auto = solveBodyJson({ ...base, layer: "advanced", plumeMode: "auto", p_tank_Pa: 10 });
    expect(auto.plume_mode).toBe("auto");
    expect(auto.p_tank_Pa).toBe(10);

    const freeze = solveBodyJson({ ...base, layer: "advanced", plumeMode: "sudden_freeze", p_tank_Pa: 40 });
    expect(freeze.plume_mode).toBe("sudden_freeze");
    expect(freeze.p_tank_Pa).toBe(40);

    const coll = buildSolveBody({ ...base, layer: "advanced", plumeMode: "collisionless", p_tank_Pa: 0.1 });
    expect(coll.plume_mode).toBe("collisionless");
    expect(coll.p_tank_Pa).toBe(0.1);
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
