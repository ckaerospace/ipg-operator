import { niceStep } from "./isolines";

/** 1–2–5 ticks that fit `lo…hi`. `target` is the desired count. */
export function axisTicks(lo: number, hi: number, target = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(hi > lo)) return [];
  const n = Math.max(2, Math.min(10, Math.round(target)));
  const step = niceStep(hi - lo, n);
  if (!(step > 0)) return [];
  const start = Math.ceil(lo / step - 1e-9) * step;
  const out: number[] = [];
  for (let k = 0; k < 16; k++) {
    const v = Number((start + k * step).toPrecision(10));
    if (v < lo - step * 1e-8) continue;
    if (v > hi + step * 1e-8) break;
    out.push(v);
  }
  return out;
}

export function tickStep(ticks: number[], fallback: number): number {
  if (ticks.length >= 2) return Math.abs(ticks[1] - ticks[0]);
  return fallback > 0 ? fallback : 1;
}

/** Format a metre coordinate as millimetres for the current tick step. */
export function fmtTickMm(v_m: number, step_m: number): string {
  const mm = v_m * 1000;
  const stepMm = Math.abs(step_m) * 1000;
  if (stepMm >= 0.95) return String(Math.round(mm));
  if (stepMm >= 0.095) return mm.toFixed(1);
  return mm.toFixed(2);
}

export function fmtTickNum(v: number, step: number): string {
  const s = Math.abs(step);
  if (s >= 0.95) return String(Math.round(v));
  if (s >= 0.095) return v.toFixed(1);
  if (s >= 0.0095) return v.toFixed(2);
  return v.toPrecision(3);
}
