import { usesGrams, type AxisFamily } from "./facility";

export function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function fmtFixed(n: number, digits: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function fmtPinj(pa: number): string {
  if (pa >= 1000) return `${fmt(pa / 1000, 2)} kPa`;
  return `${fmt(pa, pa >= 100 ? 0 : 1)} Pa`;
}

export function fmtMdot(mdot_mg_s: number, family: AxisFamily): string {
  if (usesGrams(family)) return `${fmt(mdot_mg_s / 1000, 2)} g/s`;
  return `${fmt(mdot_mg_s, mdot_mg_s >= 10 ? 1 : 2)} mg/s`;
}

export function fmtPower(w: number): string {
  if (Math.abs(w) >= 1000) return `${fmt(w / 1000, 1)} kW`;
  return `${fmt(w, w >= 100 ? 0 : 1)} W`;
}

export function fmtPa(p: number): string {
  if (!Number.isFinite(p)) return "—";
  if (Math.abs(p) >= 1000) return `${fmtFixed(p / 1000, 2)} kPa`;
  if (Math.abs(p) >= 1) return `${fmtFixed(p, p >= 10 ? 1 : 2)} Pa`;
  if (Math.abs(p) >= 1e-3) return `${fmtFixed(p * 1000, 2)} mPa`;
  return `${p.toExponential(2)} Pa`;
}

export function fmtHeatFlux(q: number): string {
  if (!Number.isFinite(q)) return "—";
  if (Math.abs(q) >= 1e6) return `${fmtFixed(q / 1e6, 2)} MW/m²`;
  if (Math.abs(q) >= 1000) return `${fmtFixed(q / 1000, 2)} kW/m²`;
  return `${fmtFixed(q, 1)} W/m²`;
}

export function fmtMdotLabel(mdot_mg_s: number, family: AxisFamily): string {
  if (usesGrams(family)) {
    const g = mdot_mg_s / 1000;
    return Number.isInteger(g) ? String(g) : g.toFixed(1).replace(/\.0$/, "");
  }
  return Number.isInteger(mdot_mg_s)
    ? String(mdot_mg_s)
    : mdot_mg_s.toFixed(1).replace(/\.0$/, "");
}

export function moleLabel(key: string): string {
  if (key === "e-") return "e⁻";
  return key;
}

export function speciesColor(key: string): string {
  const map: Record<string, string> = {
    O2: "#5b9dff",
    O: "#ff7a45",
    "O+": "#ff4d6d",
    "O2+": "#fb7185",
    "O-": "#fdba74",
    CO2: "#c084fc",
    CO: "#f472b6",
    C: "#94a3b8",
    "C+": "#e2e8f0",
    N2: "#38bdf8",
    N: "#34d399",
    "N+": "#6ee7b7",
    NO: "#fbbf24",
    He: "#a5b4fc",
    Ar: "#f9a8d4",
    "Ar+": "#f0abfc",
    "e-": "#f5d76e",
  };
  if (map[key]) return map[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 33 + key.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 62%)`;
}

export const K_EV = 8.617333262145e-5;
