import type { Xy } from "../physics";

export type IsoSeg = { x0: number; y0: number; x1: number; y1: number; level: number };
export type IsoChain = { level: number; pts: Xy[] };
export type IsoLabel = { x: number; y: number; text: string; level: number };

const N_FAINT = 8e-4;

/** Nice 1–2–5 step aimed at `target` ticks across `span`. */
export function niceStep(span: number, target = 5): number {
  const raw = span / Math.max(target, 1);
  const pow = 10 ** Math.floor(Math.log10(Math.max(Math.abs(raw), 1e-12)));
  const n = raw / pow;
  if (n <= 1) return pow;
  if (n <= 2) return 2 * pow;
  if (n <= 5) return 5 * pow;
  return 10 * pow;
}
