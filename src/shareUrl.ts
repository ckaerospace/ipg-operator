import type { CustomMix } from "./mixture";
import { emptyCustomMix, encodeMixParam, parseMixParam } from "./mixture";
import {
  clampDiskRmm,
  clampDiskXm,
  clampTankPa,
  DISK_R_MM_DEFAULT,
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
  if (layer === "thesis" || layer === "advanced") out.layer = layer;
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
  const probe_r = num(q, "probe_r");
  if (probe_r != null) out.probe_r = clampDiskRmm(probe_r);
  const run = q.get("run");
  if (run === "1" || run === "true") out.run = true;
  return out;
}

export function encodeShareSearch(fields: ShareFields): string {
  const q = new URLSearchParams();
  q.set("layer", fields.layer);
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
  const plume = fields.layer === "advanced" ? fields.plumeMode : "collisionless";
  q.set("plume", plume);
  if (fields.layer === "advanced") {
    q.set("ptank", String(clampTankPa(fields.pTank)));
    q.set("object", fields.object === "disk" ? "disk" : "none");
  }
  const advDisk = fields.layer === "advanced" && fields.object === "disk";
  const thesisPlate = fields.layer !== "advanced";
  if ((advDisk || thesisPlate) && fields.diskX_m != null && Number.isFinite(fields.diskX_m)) {
    q.set("probe_x", String(clampDiskXm(fields.diskX_m)));
    if (advDisk) q.set("probe_r", String(clampDiskRmm(fields.diskR_mm ?? DISK_R_MM_DEFAULT)));
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

/** Thesis always allows the disk. Advanced places one only when object=disk. */
export function hydrateShareObject(
  layer: "thesis" | "advanced",
  share: SharePoint,
): { object: JetObject; diskX: number | null } {
  if (layer === "advanced") {
    const object: JetObject = share.object === "disk" ? "disk" : "none";
    return { object, diskX: object === "disk" ? (share.probe_x ?? null) : null };
  }
  return { object: "none", diskX: share.probe_x ?? null };
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
    p.probe_r != null ||
    p.run === true
  );
}
