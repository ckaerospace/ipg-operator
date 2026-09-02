import type { CustomMix } from "./mixture";
import { emptyCustomMix, encodeMixParam, parseMixParam } from "./mixture";
import {
  clampDiskRmm,
  clampDiskXm,
  clampProbeYm,
  clampTankPa,
} from "./physics";
import type { FacilityId, GasId, JetObject, PlumeMode, SolveMode } from "./types";
import { NAMED_GASES } from "./types";

export type SharePoint = {
  layer?: "thesis" | "advanced";
  facility?: FacilityId;
  gas?: GasId;
  mix?: CustomMix;
  mode?: SolveMode;
  pinj?: number;
  mdot?: number;
  hinj?: number;
  ptank?: number;
  plume?: PlumeMode;
  object?: JetObject;
  probe_x?: number;
  probe_y?: number;
  probe_r?: number;
  run?: boolean;
};

export type ShareFields = {
  layer: "thesis" | "advanced";
  facility: FacilityId;
  gas: GasId;
  customMix?: CustomMix;
  mode: SolveMode;
  pinj: number;
  mdot_mg_s: number;
  hinj: number;
  pTank: number;
  plumeMode: PlumeMode;
  object: JetObject;
  diskX_m: number | null;
  diskY_m?: number | null;
  diskR_mm: number;
};

const FACILITIES: FacilityId[] = ["IPG6-S", "IPG4", "IPG3", "Custom"];
const GASES: GasId[] = [...NAMED_GASES, "custom"];
const MODES: SolveMode[] = ["generator", "enthalpy"];
const PLUMES: PlumeMode[] = ["auto", "collisionless", "sudden_freeze"];
const OBJECTS: JetObject[] = ["none", "disk"];

function num(q: URLSearchParams, key: string): number | undefined {
  const s = q.get(key);
  if (s == null || s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function pick<T extends string>(raw: string | null, allowed: readonly T[]): T | undefined {
  if (!raw) return undefined;
  const hit = allowed.find((a) => a.toLowerCase() === raw.toLowerCase());
  return hit;
}

export function parseShareSearch(search: string): SharePoint {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const out: SharePoint = {};
  const layer = q.get("layer");
  if (layer === "thesis" || layer === "advanced" || layer === "manual") out.layer = "thesis";
  const facility = pick(q.get("facility"), FACILITIES);
  if (facility) out.facility = facility;
  const gas = pick(q.get("gas"), GASES);
  if (gas) out.gas = gas;
  if (gas === "custom") {
    const mix = parseMixParam(q.get("mix"));
    if (mix) out.mix = mix;
  }
  const mode = pick(q.get("mode"), MODES);
  if (mode) out.mode = mode;
  const plume = pick(q.get("plume"), PLUMES);
  if (plume) out.plume = plume;
  const object = pick(q.get("object"), OBJECTS);
  if (object) out.object = object;
  const pinj = num(q, "pinj");
  if (pinj != null) out.pinj = pinj;
  const mdot = num(q, "mdot");
  if (mdot != null) out.mdot = mdot;
  const hinj = num(q, "hinj");
  if (hinj != null) out.hinj = hinj;
  const ptank = num(q, "ptank");
  if (ptank != null) out.ptank = clampTankPa(ptank);
  const probe_x = num(q, "probe_x");
  if (probe_x != null) out.probe_x = clampDiskXm(probe_x);
  const probe_y = num(q, "probe_y");
  if (probe_y != null) out.probe_y = clampProbeYm(probe_y);
  const probe_r = num(q, "probe_r");
  if (probe_r != null) out.probe_r = clampDiskRmm(probe_r);
  const run = q.get("run");
  if (run === "1" || run === "true") out.run = true;
  return out;
}

export function encodeShareSearch(fields: ShareFields): string {
  const q = new URLSearchParams();
  q.set("layer", "thesis");
  q.set("facility", fields.facility);
  q.set("gas", fields.gas);
  if (fields.gas === "custom") {
    const mix = encodeMixParam(fields.customMix ?? emptyCustomMix());
    if (mix) q.set("mix", mix);
  }
  q.set("mode", fields.mode);
  q.set("pinj", String(fields.pinj));
  if (fields.mode === "generator") q.set("mdot", String(fields.mdot_mg_s));
  if (fields.mode === "enthalpy") q.set("hinj", String(fields.hinj));
  q.set("plume", "collisionless");
  if (fields.diskX_m != null && Number.isFinite(fields.diskX_m)) {
    q.set("probe_x", String(clampDiskXm(fields.diskX_m)));
    q.set("probe_y", String(clampProbeYm(fields.diskY_m ?? 0)));
  }
  return q.toString();
}

/** Live page origin: https://ipg-operator.onrender.com when hosted. */
export function shareUrl(origin: string, fields: ShareFields): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/?${encodeShareSearch(fields)}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/** Station x/y come from probe_x / probe_y. Thesis has no calorimeter plate. */
export function hydrateShareObject(
  _layer: "thesis" | "advanced",
  share: SharePoint,
): { object: JetObject; diskX: number | null; probeY: number } {
  const probeY = share.probe_y != null && Number.isFinite(share.probe_y) ? share.probe_y : 0;
  return { object: "none", diskX: share.probe_x ?? null, probeY };
}

export function shareHasFields(p: SharePoint): boolean {
  return (
    p.layer != null ||
    p.facility != null ||
    p.gas != null ||
    p.mix != null ||
    p.mode != null ||
    p.pinj != null ||
    p.mdot != null ||
    p.hinj != null ||
    p.ptank != null ||
    p.plume != null ||
    p.object != null ||
    p.probe_x != null ||
    p.probe_y != null ||
    p.probe_r != null ||
    p.run === true
  );
}
