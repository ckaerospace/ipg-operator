import type { AxisFamily } from "./facility";
import { emptyCustomMix, type CustomMix } from "./mixture";
import type { GasId, SolveMode } from "./types";

export type LivePatch = {
  pinj?: number;
  hinj?: number;
  mdot?: number;
  mode?: SolveMode;
  gas?: GasId;
  customMix?: CustomMix;
};

/** Beta Plume Live sheet. Null when `VITE_CHANNEL` is not beta. */
export type LiveControls = {
  running: boolean;
  mode: SolveMode;
  gas: GasId;
  customMix: CustomMix;
  pinj: number;
  hinj: number;
  mdot_mg_s: number;
  family: AxisFamily;
  pinjLim: { min: number; max: number; step: number };
  mdotLim: { min: number; max: number };
  onPatch: (patch: LivePatch, flush?: boolean) => void;
  onFlush: () => void;
  onKick: () => void;
};

/** Same window as the Advanced tank slider — quiet period, then one solve. */
export const LIVE_SOLVE_DEBOUNCE_MS = 350;

export const LIVE_CONFIRM_KEY = "ipg-live-confirm";

/** Live chrome is beta-only (`VITE_CHANNEL=beta`). Production builds omit it. */
export function liveChromeVisible(isBeta: boolean): boolean {
  return isBeta === true;
}

export function readLiveConfirmSeen(): boolean {
  try {
    return localStorage.getItem(LIVE_CONFIRM_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeLiveConfirmSeen(): void {
  try {
    localStorage.setItem(LIVE_CONFIRM_KEY, "1");
  } catch {
    /* private mode */
  }
}

/**
 * He–O₂ mix slider: named HeO2, or custom that is only He and/or O2.
 * Other named gases and multi-species custom mixes stay locked to Setup.
 */
export function heO2MixOpen(gas: GasId, custom: CustomMix): boolean {
  if (gas === "HeO2") return true;
  if (gas !== "custom") return false;
  let heO2 = false;
  for (const s of ["O2", "N2", "CO2", "He", "Ar", "CF4"] as const) {
    const v = custom[s];
    if (!(typeof v === "number" && Number.isFinite(v) && v > 0)) continue;
    if (s === "He" || s === "O2") heO2 = true;
    else return false;
  }
  return heO2;
}

/** Mole fraction of He in a He–O₂ pair. Matches API `basis: "mole"` (He/O2 70/30). */
export function heMoleFrac(gas: GasId, custom: CustomMix): number {
  if (gas === "HeO2") return 0.7;
  const he = typeof custom.He === "number" && Number.isFinite(custom.He) && custom.He > 0 ? custom.He : 0;
  const o2 = typeof custom.O2 === "number" && Number.isFinite(custom.O2) && custom.O2 > 0 ? custom.O2 : 0;
  const sum = he + o2;
  return sum > 0 ? he / sum : 0.7;
}

export function customMixFromHeMole(heMole: number): CustomMix {
  const he = Math.min(1, Math.max(0, heMole));
  const out = emptyCustomMix();
  if (he > 0) out.He = he;
  if (1 - he > 0) out.O2 = 1 - he;
  return out;
}

export function heMixLabel(heMole: number): string {
  const he = Math.round(Math.min(1, Math.max(0, heMole)) * 100);
  return `${he}/${100 - he}`;
}

export type LiveAssign = "hinj" | "mdot";

export function assignFromMode(mode: SolveMode): LiveAssign {
  return mode === "generator" ? "mdot" : "hinj";
}

export function modeFromAssign(assign: LiveAssign): SolveMode {
  return assign === "mdot" ? "generator" : "enthalpy";
}

/** Ignore a finished request when a newer slider value already launched. */
export function solveStillCurrent(started: number, current: number): boolean {
  return started === current;
}
