import type { SolveResponse } from "./types";

export const P_TANK_MIN = 0.1;
export const P_TANK_MAX = 5000;
export const P_TANK_DEFAULT = 10;
export const KN_EXIT_TRIGGER = 0.05;
export const KN_OBJ_TRIGGER = 0.05;
export const DISK_R_MM_DEFAULT = 20;
export const DISK_R_MM_MIN = 5;
export const DISK_R_MM_MAX = 50;
export const PROBE_TW_K = 300;

const K_B = 1.380649e-23;

export function clampTankPa(p: number): number {
  if (!Number.isFinite(p)) return P_TANK_DEFAULT;
  return Math.min(P_TANK_MAX, Math.max(P_TANK_MIN, p));
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
  const p_Pa = num("p_Pa", "p");
  const q_W_m2 = num("q_W_m2", "q");
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
