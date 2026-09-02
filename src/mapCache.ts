import { HINJ_MJ_MAX, HINJ_MJ_MIN } from "./facility";

/** Characteristics cache key. ṁ rebuilds the Map; pinj is not in the key (moves the point only). */
export function mapCharacteristicsKey(opts: {
  facility: string;
  mixKey: string;
  d_c_mm: number;
  d_t_mm: number;
  d_e_mm: number;
  mdot_mg_s: number;
}): string {
  const m = Number.isFinite(opts.mdot_mg_s) ? opts.mdot_mg_s.toFixed(3) : "nan";
  return `${opts.facility}|${opts.mixKey}|${opts.d_c_mm}|${opts.d_t_mm}|${opts.d_e_mm}|m${m}|h${HINJ_MJ_MIN}-${HINJ_MJ_MAX}|n29`;
}
