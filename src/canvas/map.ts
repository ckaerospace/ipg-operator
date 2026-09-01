import { pinjLimits, usesGrams, type AxisFamily } from "../facility";
import { fmtMdotLabel, fmtPinjTick, fmtPower, moleLabel, speciesColor } from "../format";
import type { CharacteristicsResponse, Isoline } from "../types";
import { mdotStroke } from "./color";
import { denseNiceLevels } from "./isolines";
import { sample1d } from "./sample";
import { axisTicks, fmtTickNum, tickStep } from "./ticks";
import {
  clampRectView,
  pinchFocusShift,
  rectMinSpans,
  zoomRectAbout,
  type Pt,
  type RectView,
} from "./viewZoom";

export type MapView = {
  p0: number;
  p1: number;
  h0: number;
  h1: number;
};

export function axesView(ch: CharacteristicsResponse, family: AxisFamily): MapView {
  const h = ch.axes.hinj_MJ_kg;
  return {
    p0: 0,
    p1: pinjLimits(family).max,
    h0: h[0] ?? ch.hinj_MJ_kg[0] ?? 1,
    h1: h[1] ?? ch.hinj_MJ_kg[ch.hinj_MJ_kg.length - 1] ?? 70,
  };
}

export type MapLayout = {
  l: number;
  t: number;
  w: number;
  h: number;
  toX: (p: number) => number;
  toY: (h: number) => number;
  fromP: (x: number) => number;
  fromH: (y: number) => number;
};

export function mapLayout(cssW: number, cssH: number, view: MapView): MapLayout {
  const l = 48;
  const r = 12;
  const t = 18;
  const b = 32;
  const w = Math.max(10, cssW - l - r);
  const h = Math.max(10, cssH - t - b);
  return {
    l,
    t,
    w,
    h,
    toX: (p) => l + ((p - view.p0) / (view.p1 - view.p0)) * w,
    toY: (hv) => t + h - ((hv - view.h0) / (view.h1 - view.h0)) * h,
    fromP: (x) => view.p0 + ((x - l) / w) * (view.p1 - view.p0),
    fromH: (y) => view.h0 + ((t + h - y) / h) * (view.h1 - view.h0),
  };
}

function clipLine(pinj: number[], hinj: number[]): { p: number; h: number }[] {
  const out: { p: number; h: number }[] = [];
  for (let i = 0; i < pinj.length; i++) {
    out.push({ p: pinj[i], h: hinj[i] });
  }
  return out.filter((pt) => Number.isFinite(pt.p) && Number.isFinite(pt.h));
}

/** k [kg/s/Pa] from the computed hinj column. No extra CEA. */
export function kKgSPaAt(ch: CharacteristicsResponse, hinj: number): number {
  if (ch.k_kg_s_Pa && ch.k_kg_s_Pa.length && ch.hinj_MJ_kg.length) {
    return sample1d(ch.hinj_MJ_kg, ch.k_kg_s_Pa, hinj);
  }
  if (!ch.chamber.mdot_mg_s.length || !(ch.pinj_ref_Pa > 0)) return NaN;
  const mRef = sample1d(ch.hinj_MJ_kg, ch.chamber.mdot_mg_s, hinj);
  return mRef / ch.pinj_ref_Pa / 1e6;
}

/** ṁ [mg/s] = k(h) × pinj. Same identity as the Map readout. */
export function mdotMgAt(ch: CharacteristicsResponse, pinj: number, hinj: number): number {
  const k = kKgSPaAt(ch, hinj);
  return Number.isFinite(k) ? k * pinj * 1e6 : NaN;
}

function mapAxesBox(ch: CharacteristicsResponse, family: AxisFamily): MapView {
  return axesView(ch, family);
}

function tracePinjOfH(
  box: { p0: number; p1: number; h0: number; h1: number },
  pinjOfH: (h: number) => number,
): Isoline | null {
  const pinj: number[] = [];
  const hinj: number[] = [];
  const n = 72;
  for (let i = 0; i < n; i++) {
    const h = box.h0 + ((box.h1 - box.h0) * i) / (n - 1);
    const p = pinjOfH(h);
    if (!Number.isFinite(p) || p < box.p0 || p > box.p1) continue;
    if (h < box.h0 || h > box.h1) continue;
    pinj.push(p);
    hinj.push(h);
  }
  if (pinj.length < 3) return null;
  return { pinj_Pa: pinj, hinj_MJ_kg: hinj };
}

/**
 * Extra ṁ / power isolines on the family pinj box × CEA hinj sweep.
 * Packed 1–2–5 so a pinched-in view still has several curves. Not a new CEA solve.
 */
export function packMapIsolines(
  ch: CharacteristicsResponse,
  family: AxisFamily,
  view?: MapView,
): {
  mdot: Isoline[];
  power: Isoline[];
} {
  const fitted = mapAxesBox(ch, family);
  const box: MapView = view
    ? {
        p0: Math.max(fitted.p0, Math.min(view.p0, view.p1)),
        p1: Math.min(fitted.p1, Math.max(view.p0, view.p1)),
        h0: Math.max(fitted.h0, Math.min(view.h0, view.h1)),
        h1: Math.min(fitted.h1, Math.max(view.h0, view.h1)),
      }
    : fitted;
  if (!(box.p1 > box.p0) || !(box.h1 > box.h0)) return { mdot: ch.mdot_isolines, power: ch.power_isolines };
  const samples: { m: number; pwr: number }[] = [];
  const nh = 24;
  const np = 16;
  for (let j = 0; j < nh; j++) {
    const h = box.h0 + ((box.h1 - box.h0) * j) / Math.max(1, nh - 1);
    for (let i = 0; i < np; i++) {
      const p = box.p0 + ((box.p1 - box.p0) * i) / Math.max(1, np - 1);
      const m = mdotMgAt(ch, p, h);
      if (!Number.isFinite(m) || m <= 0) continue;
      samples.push({ m, pwr: m * h });
    }
  }
  const ms = samples.map((s) => s.m);
  const ps = samples.map((s) => s.pwr).filter((v) => v > 0);
  if (!ms.length) return { mdot: ch.mdot_isolines, power: ch.power_isolines };
  const mLevels = denseNiceLevels(Math.min(...ms), Math.max(...ms), 16);
  const pLevels = ps.length ? denseNiceLevels(Math.min(...ps), Math.max(...ps), 16) : [];

  const mdot: Isoline[] = [];
  for (const M of mLevels) {
    const iso = tracePinjOfH(box, (h) => {
      const k = kKgSPaAt(ch, h);
      return Number.isFinite(k) && k > 0 ? M / (k * 1e6) : NaN;
    });
    if (iso) mdot.push({ ...iso, mdot_mg_s: M });
  }
  const power: Isoline[] = [];
  for (const P of pLevels) {
    const iso = tracePinjOfH(box, (h) => {
      if (!(h > 0)) return NaN;
      const k = kKgSPaAt(ch, h);
      return Number.isFinite(k) && k > 0 ? P / (k * 1e6 * h) : NaN;
    });
    if (iso) power.push({ ...iso, power_W: P });
  }
  return {
    mdot: mdot.length ? mdot : ch.mdot_isolines,
    power: power.length ? power : ch.power_isolines,
  };
}

export function mapToRect(v: MapView): RectView {
  return { x0: v.p0, x1: v.p1, y0: v.h0, y1: v.h1 };
}

export function rectToMap(r: RectView): MapView {
  return { p0: r.x0, p1: r.x1, h0: r.y0, h1: r.y1 };
}

export function pinchMapView(
  start: MapView,
  cssW: number,
  cssH: number,
  startMid: Pt,
  startDist: number,
  nowMid: Pt,
  nowDist: number,
  bounds: MapView,
): MapView {
  const lay0 = mapLayout(cssW, cssH, start);
  const focus = { x: lay0.fromP(startMid.x), y: lay0.fromH(startMid.y) };
  const scale = nowDist / Math.max(startDist, 1e-3);
  const zoomed = rectToMap(zoomRectAbout(mapToRect(start), focus, scale));
  const lay1 = mapLayout(cssW, cssH, zoomed);
  const nowW = { x: lay1.fromP(nowMid.x), y: lay1.fromH(nowMid.y) };
  const mins = rectMinSpans(mapToRect(bounds));
  return rectToMap(clampRectView(pinchFocusShift(mapToRect(zoomed), focus, nowW), mapToRect(bounds), mins.minX, mins.minY));
}

export function wheelMapView(view: MapView, cssW: number, cssH: number, css: Pt, scale: number, bounds: MapView): MapView {
  const lay = mapLayout(cssW, cssH, view);
  const focus = { x: lay.fromP(css.x), y: lay.fromH(css.y) };
  const mins = rectMinSpans(mapToRect(bounds));
  return rectToMap(clampRectView(zoomRectAbout(mapToRect(view), focus, scale), mapToRect(bounds), mins.minX, mins.minY));
}
