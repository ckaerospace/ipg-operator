import type { SolveBody } from "./api";
import type { AppLayer } from "./layer";
import type { Mixture, PlumeMode, SolveMode } from "./types";

export const SOLVE_NX = 49;
export const SOLVE_NY = 49;

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

/** Thesis-only: always collisionless. Omit tank, probe, and freeze fields. */
export function buildSolveBody(input: SolveInput): SolveBody {
  return {
    mode: input.mode,
    plume_mode: "collisionless",
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
}

export function solveBodyJson(input: SolveInput): Record<string, unknown> {
  return JSON.parse(JSON.stringify(buildSolveBody(input))) as Record<string, unknown>;
}
