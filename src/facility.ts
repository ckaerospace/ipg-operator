import type { FacilityId, GasId, Mixture } from "./types";

export const FACILITY_META: Record<
  FacilityId,
  {
    label: string;
    dc: number;
    dt: number;
    de: number;
    nozzle: string;
    defaultGas: GasId;
    apiName: string;
  }
> = {
  "IPG6-S": {
    label: "IPG6-S",
    dc: 37,
    dt: 20,
    de: 40,
    nozzle: "de Laval",
    defaultGas: "O2",
    apiName: "IPG6-S",
  },
  IPG4: {
    label: "IPG4",
    dc: 84,
    dt: 50,
    de: 50,
    nozzle: "convergent",
    defaultGas: "CO2",
    apiName: "IPG4",
  },
  IPG3: {
    label: "IPG3",
    dc: 84,
    dt: 84,
    de: 84,
    nozzle: "tube, no throat",
    defaultGas: "O2",
    apiName: "IPG3",
  },
  Custom: {
    label: "Custom",
    dc: 37,
    dt: 20,
    de: 40,
    nozzle: "custom",
    defaultGas: "O2",
    apiName: "custom",
  },
};

export const GASES: { id: GasId; label: string; mixture: Mixture }[] = [
  { id: "O2", label: "O2", mixture: { O2: 1 } },
  { id: "CO2", label: "CO2", mixture: { CO2: 1 } },
  { id: "N2", label: "N2", mixture: { N2: 1 } },
  { id: "Air", label: "Air (0.79/0.21)", mixture: { N2: 0.79, O2: 0.21 } },
  { id: "HeO2", label: "He/O2 70/30", mixture: { He: 0.7, O2: 0.3 } },
  { id: "Ar", label: "Ar", mixture: { Ar: 1 } },
];

export function mixtureFor(gas: GasId): Mixture {
  return GASES.find((g) => g.id === gas)!.mixture;
}

export type AxisFamily = "IPG6-S" | "IPG4" | "IPG3";

export function axisFamily(facility: FacilityId, dt_mm: number): AxisFamily {
  if (facility === "Custom") {
    if (dt_mm >= 70) return "IPG3";
    if (dt_mm >= 45) return "IPG4";
    return "IPG6-S";
  }
  if (facility === "IPG4") return "IPG4";
  if (facility === "IPG3") return "IPG3";
  return "IPG6-S";
}

export function usesGrams(family: AxisFamily): boolean {
  return family !== "IPG6-S";
}

export function pinjLimits(family: AxisFamily): { min: number; max: number; step: number } {
  if (family === "IPG4") return { min: 50, max: 5000, step: 10 };
  if (family === "IPG3") return { min: 50, max: 3000, step: 10 };
  return { min: 5, max: 250, step: 1 };
}

export function mdotMgLimits(family: AxisFamily): { min: number; max: number } {
  if (family === "IPG4") return { min: 200, max: 5000 };
  if (family === "IPG3") return { min: 400, max: 8000 };
  return { min: 1, max: 50 };
}

export function coerceOperatingPoint(
  family: AxisFamily,
  pinj: number,
  mdot_mg_s: number,
): { pinj: number; mdot_mg_s: number } {
  const p = pinjLimits(family);
  const m = mdotMgLimits(family);
  let mdot = mdot_mg_s;
  if (mdot < m.min || mdot > m.max) {
    mdot = family === "IPG4" ? 2200 : family === "IPG3" ? 3210 : 13;
  }
  return {
    pinj: Math.min(p.max, Math.max(p.min, pinj)),
    mdot_mg_s: Math.min(m.max, Math.max(m.min, mdot)),
  };
}

export function defaultPoint(facility: FacilityId): {
  pinj: number;
  mdot_mg_s: number;
  hinj: number;
  gas: GasId;
} {
  if (facility === "IPG4") return { pinj: 2900, mdot_mg_s: 2200, hinj: 17.4, gas: "CO2" };
  if (facility === "IPG3") return { pinj: 1450, mdot_mg_s: 3210, hinj: 17.9, gas: "O2" };
  return { pinj: 100, mdot_mg_s: 13, hinj: 23, gas: "O2" };
}

export type KnownPoint = {
  id: string;
  label: string;
  facility: FacilityId;
  gas: GasId;
  pinj: number;
  hinj?: number;
  mdot_mg_s?: number;
  mode: "generator" | "enthalpy";
};

export const KNOWN_POINTS: KnownPoint[] = [
  { id: "p1", label: "①  15 MJ/kg", facility: "IPG6-S", gas: "O2", pinj: 100, hinj: 15, mode: "enthalpy" },
  { id: "p2", label: "②  23 MJ/kg", facility: "IPG6-S", gas: "O2", pinj: 100, hinj: 23, mode: "enthalpy" },
  { id: "p3", label: "③  30 MJ/kg", facility: "IPG6-S", gas: "O2", pinj: 100, hinj: 30, mode: "enthalpy" },
  { id: "o01", label: "O#01  3.21 g/s", facility: "IPG3", gas: "O2", pinj: 1450, mdot_mg_s: 3210, mode: "generator" },
  {
    id: "burghaus",
    label: "Burghaus  2.2 g/s",
    facility: "IPG4",
    gas: "CO2",
    pinj: 2900,
    mdot_mg_s: 2200,
    mode: "generator",
  },
];

export function geometryOf(
  facility: FacilityId,
  custom: { dc: number; dt: number; de: number },
): { d_c_mm: number; d_t_mm: number; d_e_mm: number; nozzle_name: string } {
  if (facility === "Custom") {
    return { d_c_mm: custom.dc, d_t_mm: custom.dt, d_e_mm: custom.de, nozzle_name: "custom" };
  }
  const m = FACILITY_META[facility];
  return { d_c_mm: m.dc, d_t_mm: m.dt, d_e_mm: m.de, nozzle_name: m.apiName };
}
