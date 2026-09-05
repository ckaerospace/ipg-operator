import type { CeaExit, SolveResponse } from "./types";

export const P_TANK_MIN = 0.1;
export const P_TANK_MAX = 5000;
export const P_TANK_DEFAULT = 10;
export const TANK_SLIDER_STEPS = 1000;
export const PINJ_SLIDER_STEPS = 1000;
export const TANK_SOLVE_DEBOUNCE_MS = 350;
export const KN_EXIT_TRIGGER = 0.05;
export const KN_OBJ_TRIGGER = 0.05;
export const DISK_R_MM_DEFAULT = 20;
export const DISK_R_MM_MIN = 5;
export const DISK_R_MM_MAX = 50;
export const PROBE_TW_K = 300;

const K_B = 1.380649e-23;
const E_CHARGE = 1.602176634e-19;
const N_A = 6.02214076e23;

/** Incident free-stream ram pressure and energy flux. Not plate-face p_probe / q_probe. */
export function incidentRamFlux(opts: {
  n_ratio: number;
  n0: number;
  e_kin_eV?: number | null;
  U: number;
  MW?: number | null;
}): { p_ram_Pa: number; q_inc_W_m2: number } | null {
  const { n_ratio, n0, U } = opts;
  if (![n_ratio, n0, U].every(Number.isFinite) || !(n0 > 0) || n_ratio < 0) return null;
  const n = n_ratio * n0;
  const E = opts.e_kin_eV;
  if (typeof E === "number" && Number.isFinite(E) && E >= 0) {
    const eJ = E * E_CHARGE;
    return { p_ram_Pa: 2 * n * eJ, q_inc_W_m2: n * U * eJ };
  }
  const mw = opts.MW;
  if (typeof mw === "number" && Number.isFinite(mw) && mw > 0) {
    const m = (mw * 1e-3) / N_A;
    return { p_ram_Pa: n * m * U * U, q_inc_W_m2: 0.5 * n * m * U * U * U };
  }
  return null;
}

/**
 * Frozen-exit atomic oxygen mole fraction from CEA station 4.
 * Uses `x_O` or `mole_fractions.O`. Missing → null (do not invent 0).
 */
export function exitXO(exit: Pick<CeaExit, "x_O" | "mole_fractions"> | null | undefined): number | null {
  if (!exit) return null;
  const raw = exit.x_O ?? exit.mole_fractions?.O;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw;
  return null;
}

/** Frozen composition: n_O = (n/n0) · n0 · x_O. SI m⁻³. */
export function nOFromFrozen(n_ratio: number, n0: number, x_O: number): number {
  return n_ratio * n0 * x_O;
}

export function clampTankPa(p: number): number {
  if (!Number.isFinite(p)) return P_TANK_DEFAULT;
  return Math.min(P_TANK_MAX, Math.max(P_TANK_MIN, p));
}

/** Log slider so 10 Pa and 3000 Pa are both usable on 0.1–5000 Pa. */
export function tankPaToSlider(p: number): number {
  const v = clampTankPa(p);
  const a = Math.log10(P_TANK_MIN);
  const b = Math.log10(P_TANK_MAX);
  return Math.round(((Math.log10(v) - a) / (b - a)) * TANK_SLIDER_STEPS);
}

export function sliderToTankPa(t: number): number {
  const u = Math.min(TANK_SLIDER_STEPS, Math.max(0, t));
  const a = Math.log10(P_TANK_MIN);
  const b = Math.log10(P_TANK_MAX);
  return clampTankPa(10 ** (a + (u / TANK_SLIDER_STEPS) * (b - a)));
}

export function clampPinjPa(p: number, min: number, max: number): number {
  if (!Number.isFinite(p)) return min;
  return Math.min(max, Math.max(min, p));
}

/** Log slider so 100 Pa stays hittable on a 5–2000 Pa (or family) track. */
export function pinjPaToSlider(p: number, min: number, max: number): number {
  const v = clampPinjPa(p, min, max);
  const a = Math.log10(min);
  const b = Math.log10(max);
  return Math.round(((Math.log10(v) - a) / (b - a)) * PINJ_SLIDER_STEPS);
}

export function sliderToPinjPa(t: number, min: number, max: number, step: number): number {
  const u = Math.min(PINJ_SLIDER_STEPS, Math.max(0, t));
  const a = Math.log10(min);
  const b = Math.log10(max);
  const raw = 10 ** (a + (u / PINJ_SLIDER_STEPS) * (b - a));
  const snapped = step > 0 ? Math.round(raw / step) * step : raw;
  return clampPinjPa(snapped, min, max);
}

export function fmtTankPa(p: number): string {
  const v = clampTankPa(p);
  if (v >= 1000) return `${v >= 10000 ? v.toFixed(0) : v >= 3000 ? v.toFixed(0) : v.toFixed(0)} Pa`;
  if (v >= 10) return `${v >= 100 ? v.toFixed(0) : Number(v.toFixed(v >= 30 ? 0 : 1))} Pa`;
  if (v >= 1) return `${v.toFixed(1)} Pa`;
  return `${v.toFixed(2)} Pa`;
}

function finitePositive(...cands: unknown[]): number | null {
  for (const c of cands) {
    if (typeof c === "number" && Number.isFinite(c) && c > 0) return c;
  }
  return null;
}

export function exitPressurePa(solve: SolveResponse): number | null {
  const ex = solve.cea.exit;
  const pl = solve.plume;
  const hit = finitePositive(pl.p_e_Pa, ex.p_e_Pa, ex.p_Pa, ex.p, solve.p_e_Pa);
  if (hit != null) return hit;
  const n0 = pl.n0 ?? ex.n0;
  const T0 = pl.T0 ?? ex.T0;
  if (typeof n0 === "number" && n0 > 1e15 && typeof T0 === "number" && T0 > 0) {
    const p = n0 * K_B * T0;
    if (Number.isFinite(p) && p > 0) return p;
  }
  return null;
}

export function regimeFromNpr(npr: number): "underexpanded" | "overexpanded" | "matched" {
  if (npr > 1.05) return "underexpanded";
  if (npr < 0.95) return "overexpanded";
  return "matched";
}

export type JetMatch = {
  p_e: number | null;
  p_tank: number;
  npr: number | null;
  regime: string | null;
};

export function jetMatch(solve: SolveResponse, pTankFallback: number): JetMatch {
  const pl = solve.plume;
  const p_tank = finitePositive(pl.p_tank_Pa, solve.p_tank_Pa) ?? clampTankPa(pTankFallback);
  const p_e = exitPressurePa(solve);
  const nprApi = finitePositive(pl.npr, solve.npr);
  const npr = nprApi ?? (p_e != null && p_tank > 0 ? p_e / p_tank : null);
  const regimeApi = typeof pl.regime === "string" && pl.regime.trim() ? pl.regime.trim() : null;
  const topReg = typeof solve.regime === "string" && solve.regime.trim() ? solve.regime.trim() : null;
  const regime = npr != null ? regimeFromNpr(npr) : (regimeApi ?? topReg);
  return { p_e, p_tank, npr, regime };
}

export type Xy = { x: number; y: number };

export function clampDiskRmm(r: number): number {
  if (!Number.isFinite(r)) return DISK_R_MM_DEFAULT;
  return Math.min(DISK_R_MM_MAX, Math.max(DISK_R_MM_MIN, r));
}

export function clampDiskXm(x: number, xmax?: number): number {
  const hi = typeof xmax === "number" && Number.isFinite(xmax) && xmax > 0 ? xmax : 2;
  if (!Number.isFinite(x)) return 0;
  return Math.min(hi, Math.max(0, x));
}

export function clampProbeYm(y: number, ymax?: number): number {
  const lim = typeof ymax === "number" && Number.isFinite(ymax) && ymax > 0 ? ymax : 2;
  if (!Number.isFinite(y)) return 0;
  return Math.min(lim, Math.max(-lim, y));
}

export function clampProbeTw(t: number): number {
  if (!Number.isFinite(t)) return PROBE_TW_K;
  return Math.min(2000, Math.max(200, t));
}

export function regimeFromKnObj(kn: number): "kinetic" | "continuum" {
  return kn >= KN_OBJ_TRIGGER ? "kinetic" : "continuum";
}

/** λ_local / (2 R) from the grid sample when the API has not returned Kn_obj. */
export function estimateKnObj(knLocal: number, H: number, r_m: number): number | null {
  if (!(knLocal > 0) || !(H > 0) || !(r_m > 0)) return null;
  const kn = (knLocal * H) / (2 * r_m);
  return Number.isFinite(kn) ? kn : null;
}

export function parsePlumeProbe(raw: unknown): {
  x_m?: number;
  r_mm?: number;
  Tw_K?: number;
  p_Pa?: number | null;
  q_W_m2?: number | null;
  Kn_obj?: number | null;
  regime?: string | null;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const num = (...keys: string[]): number | null => {
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
    return null;
  };
  const x_m = num("x_m", "probe_x_m") ?? undefined;
  const r_mm = num("r_mm", "probe_r_mm") ?? undefined;
  const Tw_K = num("Tw_K", "probe_Tw_K") ?? undefined;
  const p_Pa = num("p_w_Pa", "p_stag_Pa", "p_Pa", "p");
  const q_W_m2 = num("q_w_W_m2", "q_stag_W_m2", "q_W_m2", "q");
  const Kn_obj = num("Kn_obj", "kn_obj");
  const regime = typeof o.regime === "string" && o.regime.trim() ? o.regime.trim() : null;
  if (
    x_m == null &&
    r_mm == null &&
    p_Pa == null &&
    q_W_m2 == null &&
    Kn_obj == null &&
    regime == null
  ) {
    return null;
  }
  return { x_m, r_mm, Tw_K, p_Pa, q_W_m2, Kn_obj, regime };
}

export function probeMatchesDisk(
  api: { x_m?: number; r_mm?: number } | null,
  x_m: number,
  r_mm: number,
): boolean {
  if (!api) return false;
  if (api.x_m != null && Math.abs(api.x_m - x_m) > 1e-4) return false;
  if (api.r_mm != null && Math.abs(api.r_mm - r_mm) > 0.05) return false;
  return true;
}

/** True when the last solve posted this station, so face p/q may be shown. */
export function faceMatchesSolve(
  solved: { x: number; r: number } | null,
  x_m: number | null,
  r_mm: number,
): boolean {
  if (solved == null || x_m == null || !Number.isFinite(x_m)) return false;
  if (Math.abs(solved.x - x_m) > 1e-4) return false;
  if (Math.abs(solved.r - r_mm) > 0.05) return false;
  return true;
}

export function parseBarrel(raw: unknown): Xy[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    const out: Xy[] = [];
    for (const p of raw) {
      if (Array.isArray(p) && p.length >= 2) {
        const x = Number(p[0]);
        const y = Number(p[1]);
        if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
      } else if (p && typeof p === "object" && "x" in p && "y" in p) {
        const x = Number((p as { x: unknown }).x);
        const y = Number((p as { y: unknown }).y);
        if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
      }
    }
    return out;
  }
  if (typeof raw === "object") {
    const o = raw as { x?: unknown; y?: unknown; xy?: unknown };
    if (o.xy != null) return parseBarrel(o.xy);
    if (Array.isArray(o.x) && Array.isArray(o.y)) {
      const out: Xy[] = [];
      const n = Math.min(o.x.length, o.y.length);
      for (let i = 0; i < n; i++) {
        const x = Number(o.x[i]);
        const y = Number(o.y[i]);
        if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
      }
      return out;
    }
  }
  return [];
}
