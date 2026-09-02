import type { SolveBody } from "./api";
import type { AppLayer } from "./layer";
import { operatorLayer } from "./layer";
import { clampDiskRmm, clampDiskXm, clampProbeTw, clampTankPa, PROBE_TW_K } from "./physics";
import type { Mixture, PlumeMode, SolveMode } from "./types";

/** Odd so y=0 is a grid node. Colormap and marching-square isolines use this same posted field. */
export const SOLVE_NX = 97;
export const SOLVE_NY = 97;

export type SolveInput = {
  layer: AppLayer;
  plumeMode: PlumeMode;
  mode: SolveMode;
  mixture: Mixture;
  d_c_mm: number;
  d_t_mm: number;
  d_e_mm: number;
  nozzle_name: string;
  pinj_Pa: number;
  hinj_MJ_kg: number;
  mdot_mg_s: number;
  p_tank_Pa: number;
  probe_x_m?: number | null;
  probe_r_mm?: number;
  probe_Tw_K?: number;
};

/** Thesis always collisionless and omits p_tank_Pa. Advanced sends the chosen kernel and tank. */
export function buildSolveBody(input: SolveInput): SolveBody {
  const advanced = operatorLayer(input.layer) === "advanced";
  const body: SolveBody = {
    mode: input.mode,
    plume_mode: advanced ? input.plumeMode : "collisionless",
    mixture: input.mixture,
    basis: "mole",
    d_c_mm: input.d_c_mm,
    d_t_mm: input.d_t_mm,
    d_e_mm: input.d_e_mm,
    nozzle_name: input.nozzle_name,
    pinj_Pa: input.pinj_Pa,
    hinj_MJ_kg: input.mode === "enthalpy" ? input.hinj_MJ_kg : undefined,
    mdot_mg_s: input.mode === "generator" ? input.mdot_mg_s : undefined,
    nx: SOLVE_NX,
    ny: SOLVE_NY,
  };
  if (advanced) body.p_tank_Pa = clampTankPa(input.p_tank_Pa);
  if (input.probe_x_m != null && Number.isFinite(input.probe_x_m)) {
    body.probe_x_m = clampDiskXm(input.probe_x_m);
    body.probe_r_mm = clampDiskRmm(input.probe_r_mm ?? 20);
    body.probe_Tw_K = clampProbeTw(input.probe_Tw_K ?? PROBE_TW_K);
  }
  return body;
}

export function solveBodyJson(input: SolveInput): Record<string, unknown> {
  return JSON.parse(JSON.stringify(buildSolveBody(input))) as Record<string, unknown>;
}
