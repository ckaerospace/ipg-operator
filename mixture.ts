import { mixtureFor } from "./facility";
import type { GasId, Mixture, NamedGasId } from "./types";

/** Stuttgart IPG editor species. No H2/CH4/NH3. */
export const CUSTOM_SPECIES = ["O2", "N2", "CO2", "He", "Ar"] as const;
export type CustomSpecies = (typeof CUSTOM_SPECIES)[number];
export type CustomMix = Record<CustomSpecies, number>;

export function isNamedGas(gas: GasId): gas is NamedGasId {
  return gas !== "custom";
}

export function emptyCustomMix(): CustomMix {
  return { O2: 0, N2: 0, CO2: 0, He: 0, Ar: 0 };
}

export function seedCustomMix(from: Mixture): CustomMix {
  const out = emptyCustomMix();
  for (const s of CUSTOM_SPECIES) {
    const v = from[s];
    out[s] = typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
  }
  return out;
}

export function mixtureSum(mix: CustomMix): number {
  let s = 0;
  for (const k of CUSTOM_SPECIES) {
    const v = mix[k];
    if (Number.isFinite(v) && v > 0) s += v;
  }
  return s;
}

function fmtMixNum(n: number): string {
  const t = Math.round(n * 1e6) / 1e6;
  return String(t);
}

/** Positive fractions only, canonical species order. */
export function encodeMixParam(mix: CustomMix): string {
  return CUSTOM_SPECIES.filter((s) => Number.isFinite(mix[s]) && mix[s] > 0)
    .map((s) => `${s}:${fmtMixNum(mix[s])}`)
    .join(",");
}

/** Ignores unknown species (H2, CH4, …). */
export function parseMixParam(raw: string | null | undefined): CustomMix | null {
  if (raw == null || raw.trim() === "") return null;
  const out = emptyCustomMix();
  let any = false;
  for (const part of raw.split(",")) {
    const colon = part.indexOf(":");
    if (colon < 1) continue;
    const name = part.slice(0, colon).trim();
    const key = CUSTOM_SPECIES.find((s) => s.toLowerCase() === name.toLowerCase());
    if (!key) continue;
    const n = Number(part.slice(colon + 1));
    if (!Number.isFinite(n) || n < 0) continue;
    out[key] = n;
    any = true;
  }
  return any ? out : null;
}

/** Normalize positive mole fractions to 1. Zeros omitted. Null if nothing to send. */
export function normalizeMixture(mix: CustomMix): Mixture | null {
  const pos: Partial<Record<CustomSpecies, number>> = {};
  let sum = 0;
  for (const s of CUSTOM_SPECIES) {
    const v = mix[s];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      pos[s] = v;
      sum += v;
    }
  }
  if (sum <= 0) return null;
  const out: Mixture = {};
  for (const s of CUSTOM_SPECIES) {
    const v = pos[s];
    if (v != null) out[s] = v / sum;
  }
  return out;
}

/** Named presets unchanged. Custom is the normalized editor mix. */
export function resolveMixture(gas: GasId, custom: CustomMix): Mixture | null {
  if (gas === "custom") return normalizeMixture(custom);
  return { ...mixtureFor(gas) };
}

export function mixLabel(mix: Mixture): string {
  return CUSTOM_SPECIES.filter((s) => (mix[s] ?? 0) > 0)
    .map((s) => `${s} ${(mix[s] as number).toFixed(2)}`)
    .join(" · ");
}
