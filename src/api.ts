import type { CharacteristicsResponse, Mixture, SolveMode, SolveResponse } from "./types";

export const API_BASE: string = (import.meta.env.VITE_API as string | undefined) ?? "https://ipg-cea-api.onrender.com";

const WAKE_MS = 1400;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

function detailMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "Request failed";
  const d = (body as { detail?: unknown }).detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0] && typeof d[0] === "object" && "msg" in d[0]) {
    return String((d[0] as { msg: string }).msg);
  }
  return "Request failed";
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit,
  onSlow?: () => void,
): Promise<T> {
  const ctrl = new AbortController();
  const wake = window.setTimeout(() => onSlow?.(), WAKE_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const body = await parseBody(res);
    if (!res.ok) {
      throw new ApiError(detailMessage(body), res.status);
    }
    return body as T;
  } finally {
    window.clearTimeout(wake);
  }
}

export type SolveBody = {
  mode: SolveMode;
  plume_mode: string;
  mixture: Mixture;
  basis: "mole";
  d_c_mm: number;
  d_t_mm: number;
  d_e_mm: number;
  nozzle_name: string;
  pinj_Pa: number;
  hinj_MJ_kg?: number;
  mdot_mg_s?: number;
  nx: number;
  ny: number;
  p_tank_Pa?: number;
  probe_x_m?: number;
  probe_r_mm?: number;
  probe_Tw_K?: number;
};

export async function postSolve(body: SolveBody, onSlow?: () => void): Promise<SolveResponse> {
  try {
    return await apiFetch<SolveResponse>("/api/solve", { method: "POST", body: JSON.stringify(body) }, onSlow);
  } catch (e) {
    if (e instanceof ApiError && e.status === 422 && body.probe_x_m != null) {
      const { probe_x_m: _x, probe_r_mm: _r, probe_Tw_K: _t, ...rest } = body;
      return apiFetch<SolveResponse>("/api/solve", { method: "POST", body: JSON.stringify(rest) }, onSlow);
    }
    throw e;
  }
}

export type CharBody = {
  pinj_ref_Pa: number;
  mixture: Mixture;
  basis: "mole";
  d_c_mm: number;
  d_t_mm: number;
  d_e_mm: number;
  nozzle_name: string;
  n_h: number;
  hinj_min?: number;
  hinj_max?: number;
};

export function postCharacteristics(body: CharBody, onSlow?: () => void): Promise<CharacteristicsResponse> {
  return apiFetch<CharacteristicsResponse>(
    "/api/characteristics",
    { method: "POST", body: JSON.stringify(body) },
    onSlow,
  );
}
