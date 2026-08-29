import type { FieldId, ProbeSample, SolveResponse } from "../types";
import { K_EV } from "../format";
import { parseBarrel, type Xy } from "../physics";
import { colorize } from "./color";
import { fieldIsoLevels, fieldIsolines, fmtIsoValue, niceIsoLevels, pickIsoLabels, stitchIso } from "./isolines";
import { sampleGrid } from "./sample";
import { axisTicks, fmtTickMm, tickStep } from "./ticks";
import {
  clampIsoView,
  isoMinSpan,
  pinchFocusShift,
  zoomIsoAbout,
  type Pt,
} from "./viewZoom";

export type View = { x0: number; x1: number; y0: number; y1: number };

const N_FAINT = 8e-4;
const N_SOLID = 0.02;
const PLOT_BG: [number, number, number] = [12, 26, 40];

/** Fade the color map so vacuum stays the dark plot, not a noisy rectangle. */
export function fieldMaskAlpha(n: number): number {
  if (!Number.isFinite(n) || n < N_FAINT) return 0;
  if (n >= N_SOLID) return 1;
  return (n - N_FAINT) / (N_SOLID - N_FAINT);
}

/** On-canvas caption so barrel + Mach disk cannot be read as the color map. */
export const SHOCK_OVERLAY_CAPTION = "shock overlay";
export const MACH_DISK_LABEL = "Mach disk";

/** Overlay strokes only — never used to tint the bilinear field. */
export const SHOCK_OVERLAY = {
  barrelStroke: "rgba(214, 228, 240, 0.9)",
  barrelHalo: "rgba(10, 16, 24, 0.55)",
  barrelWidth: 1.7,
  barrelHaloWidth: 3.2,
  barrelDash: [4.2, 3.1] as const,
  diskStroke: "#ffd000",
  diskHalo: "rgba(16, 10, 2, 0.92)",
  diskWidth: 4.35,
  diskHaloWidth: 6.8,
} as const;

const FIELD_LABEL: Record<FieldId, string> = {
  t_ratio: "T / T0",
  n_ratio: "n / n0",
  h_tot: "h_tot  MJ/kg",
  speed: "U  m/s",
  mach: "Mach",
  e_kin: "E  eV",
};

function fieldArray(plume: SolveResponse["plume"], field: FieldId): number[] {
  switch (field) {
    case "t_ratio":
      return plume.t_ratio;
    case "n_ratio":
      return plume.n_ratio;
    case "h_tot":
      return plume.h_tot_MJ_kg;
    case "speed":
      return plume.speed;
    case "mach":
      return plume.mach;
    case "e_kin":
      return plume.e_kin_eV;
  }
}

function fieldRange(plume: SolveResponse["plume"], arr: number[]): [number, number] {
  const { nx, ny } = plume;
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < ny; j++) {
    if (plume.y[j] < 0) continue;
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (plume.n_ratio[k] < 1e-3) continue;
      const v = arr[k];
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (!Number.isFinite(lo)) return [0, 1];
  if (hi <= lo) return [lo, lo + 1];
  return [lo, hi];
}

/** Frame the barrel when Advanced returns a Mach disk, so xmax_m=2 m does not shrink it off a phone. */
export function shockFitExtents(plume: SolveResponse["plume"]): { x1: number; y1: number } | null {
  if (plume.shock_applied !== true) return null;
  const xm = plume.x_mach_disk_m;
  if (typeof xm !== "number" || !Number.isFinite(xm) || xm <= 0) return null;
  const barrel = parseBarrel(plume.barrel_xy);
  const r = barrelRadiusAt(barrel, xm, Math.max(plume.H || 0, 1e-4));
  return { x1: xm * 1.2, y1: Math.max(r * 1.2, 1e-4) };
}

/** Square world with y0 = −y1 (full jet). Expand x or |y| so dx === dy. Caps if the grid is smaller. */
export function squareWorld(view: View, capX?: number, capY?: number): View {
  const x0 = view.x0;
  let x1 = view.x1;
  const capHalf =
    typeof capY === "number" && Number.isFinite(capY) && capY > 0 ? capY : Infinity;
  let yHalf = Math.min(Math.max(Math.abs(view.y1), Math.abs(view.y0), 1e-6), capHalf);
  const dx0 = x1 - x0;
  if (2 * yHalf < dx0) yHalf = Math.min(dx0 / 2, capHalf);
  const dy = 2 * yHalf;
  if (x1 - x0 < dy) {
    x1 = x0 + dy;
    if (typeof capX === "number" && Number.isFinite(capX) && capX > 0) x1 = Math.min(x1, capX);
  }
  return { x0, x1, y0: -yHalf, y1: yHalf };
}

export function fitView(plume: SolveResponse["plume"], dc: number, dt: number, de: number): View {
  const H = Math.max(plume.H || de / 2000, de / 2000);
  const L = nozzleLength(dc, dt, de, H);
  const shock = shockFitExtents(plume);
  let raw: View;
  if (shock) {
    const capX = Number.isFinite(plume.xmax_m) && plume.xmax_m > 0 ? plume.xmax_m : shock.x1;
    const capY = Number.isFinite(plume.ymax_m) && plume.ymax_m > 0 ? plume.ymax_m : shock.y1;
    raw = {
      x0: -L,
      x1: Math.min(Math.max(shock.x1, 4 * H), capX),
      y0: 0,
      y1: Math.min(Math.max(shock.y1, 2 * H), capY),
    };
  } else {
    const nx = plume.nx;
    const ny = plume.ny;
    let xMax = 8 * H;
    let yMax = 3.5 * H;
    for (let j = 0; j < ny; j++) {
      if (plume.y[j] < 0) continue;
      for (let i = 0; i < nx; i++) {
        if (plume.n_ratio[j * nx + i] >= 0.04) {
          xMax = Math.max(xMax, plume.x[i]);
          yMax = Math.max(yMax, plume.y[j]);
        }
      }
    }
    xMax = Math.min(xMax * 1.15, plume.xmax_m);
    yMax = Math.min(Math.max(yMax * 1.25, 4 * H), plume.ymax_m);
    raw = { x0: -L, x1: xMax, y0: 0, y1: yMax };
  }
  const capX = Number.isFinite(plume.xmax_m) && plume.xmax_m > 0 ? plume.xmax_m : undefined;
  const capY = Number.isFinite(plume.ymax_m) && plume.ymax_m > 0 ? plume.ymax_m : undefined;
  return squareWorld(raw, capX, capY);
}

export function emptyView(dc: number, dt: number, de: number): View {
  const H = de / 2000;
  const L = nozzleLength(dc, dt, de, H);
  return squareWorld({ x0: -L, x1: 14 * H, y0: 0, y1: 5.5 * H });
}

function nozzleLength(dc: number, dt: number, de: number, H: number): number {
  const conv = Math.max(dc, dt, de) / 1000;
  return Math.max(3.2 * H, 0.7 * conv + 2.2 * H);
}

export type WorldMap = {
  toX: (x: number) => number;
  toY: (y: number) => number;
  fromX: (px: number) => number;
  fromY: (py: number) => number;
  plot: { l: number; t: number; w: number; h: number };
};

export function worldMap(w: number, h: number, view: View): WorldMap {
  const padL = 50;
  const padR = 52;
  const padT = 16;
  const padB = 28;
  const pw = Math.max(10, w - padL - padR);
  const ph = Math.max(10, h - padT - padB);
  const dx = view.x1 - view.x0 || 1;
  const dy = view.y1 - view.y0 || 1;
  const s = Math.min(pw / dx, ph / dy);
  const usedW = dx * s;
  const usedH = dy * s;
  const l = padL + (pw - usedW) / 2;
  const t = padT + (ph - usedH) / 2;
  return {
    plot: { l, t, w: usedW, h: usedH },
    toX: (x) => l + ((x - view.x0) / dx) * usedW,
    toY: (y) => t + usedH - ((y - view.y0) / dy) * usedH,
    fromX: (px) => view.x0 + ((px - l) / usedW) * dx,
    fromY: (py) => view.y0 + ((t + usedH - py) / usedH) * dy,
  };
}

/** Pinch/pan the isotropic millimetre window. Does not re-solve. */
export function pinchPlumeView(
  startView: View,
  cssW: number,
  cssH: number,
  startMid: Pt,
  startDist: number,
  nowMid: Pt,
  nowDist: number,
  bounds: View,
): View {
  const map0 = worldMap(cssW, cssH, startView);
  const focus = { x: map0.fromX(startMid.x), y: map0.fromY(startMid.y) };
  const scale = nowDist / Math.max(startDist, 1e-3);
  const zoomed = zoomIsoAbout(startView, focus, scale);
  const map1 = worldMap(cssW, cssH, zoomed);
  const nowW = { x: map1.fromX(nowMid.x), y: map1.fromY(nowMid.y) };
  return clampIsoView(pinchFocusShift(zoomed, focus, nowW), bounds, isoMinSpan(bounds));
}

export function wheelPlumeView(view: View, cssW: number, cssH: number, css: Pt, scale: number, bounds: View): View {
  const map = worldMap(cssW, cssH, view);
  const focus = { x: map.fromX(css.x), y: map.fromY(css.y) };
  return clampIsoView(zoomIsoAbout(view, focus, scale), bounds, isoMinSpan(bounds));
}


function drawNozzle(
  ctx: CanvasRenderingContext2D,
  map: WorldMap,
  dc: number,
  dt: number,
  de: number,
  view: View,
) {
  const rc = dc / 2000;
  const rt = dt / 2000;
  const re = de / 2000;
  const xExit = 0;
  const xThroat = -Math.max(view.x1 * 0.04, re * 1.1);
  const xConv = xThroat - Math.max(re * 1.6, (rc - rt) * 2);
  const xCh = view.x0;
  const fillSide = (sign: 1 | -1) => {
    const yOut = sign > 0 ? Math.max(view.y1 * 1.15, re * 4) : Math.min(view.y0 * 1.15, -re * 4);
    const pts = [
      [xCh, yOut],
      [xCh, sign * rc],
      [xConv, sign * rc],
      [xThroat, sign * rt],
      [xExit, sign * re],
      [xExit, yOut],
    ];
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const X = map.toX(x);
      const Y = map.toY(y);
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    });
    ctx.closePath();
    ctx.fillStyle = "#0b1016";
    ctx.fill();
  };
  fillSide(1);
  fillSide(-1);
  ctx.strokeStyle = "#2ee6c5";
  ctx.lineWidth = 1.6;
  const wall = [
    [xCh, rc],
    [xConv, rc],
    [xThroat, rt],
    [xExit, re],
  ];
  for (const sign of [1, -1] as const) {
    ctx.beginPath();
    wall.forEach(([x, y], i) => {
      const X = map.toX(x);
      const Y = map.toY(sign * y);
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    });
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(46,230,197,0.35)";
  ctx.beginPath();
  ctx.moveTo(map.toX(xCh), map.toY(0));
  ctx.lineTo(map.toX(xExit), map.toY(0));
  ctx.stroke();
}

function strokeXy(ctx: CanvasRenderingContext2D, map: WorldMap, pts: Xy[]) {
  if (pts.length < 2) return;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const X = map.toX(p.x);
    const Y = map.toY(p.y);
    if (i === 0) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
  });
  ctx.stroke();
}

function barrelRadiusAt(pts: Xy[], x: number, fallback: number): number {
  if (!pts.length) return fallback;
  let best = fallback;
  let near = Infinity;
  for (const p of pts) {
    const d = Math.abs(p.x - x);
    if (d < near) {
      near = d;
      best = Math.abs(p.y);
    }
    if (p.x <= x) best = Math.max(best, Math.abs(p.y));
  }
  return best > 0 ? best : fallback;
}

function drawDisk(
  ctx: CanvasRenderingContext2D,
  map: WorldMap,
  disk: { x: number; r: number },
  bow: Xy[],
) {
  const { x, r } = disk;
  if (!(r > 0) || !Number.isFinite(x)) return;
  const X = map.toX(x);
  const Y0 = map.toY(-r);
  const Y1 = map.toY(r);
  const hh = Math.abs(Y1 - Y0);
  const rx = Math.max(2.4, Math.abs(map.toX(x + Math.min(r * 0.18, 0.004)) - X));
  const cy = map.toY(0);

  ctx.save();
  if (bow.length >= 2) {
    ctx.strokeStyle = "rgba(255, 168, 120, 0.9)";
    ctx.lineWidth = 1.15;
    ctx.setLineDash([]);
    const upper = bow.filter((p) => p.y >= -1e-9);
    strokeXy(ctx, map, upper);
    strokeXy(
      ctx,
      map,
      upper.map((p) => ({ x: p.x, y: -p.y })),
    );
  }

  ctx.fillStyle = "rgba(214, 222, 232, 0.92)";
  ctx.strokeStyle = "#2ee6c5";
  ctx.lineWidth = 1.35;
  ctx.beginPath();
  ctx.ellipse(X, cy, rx, Math.max(2, hh / 2), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(X - Math.max(1.2, rx * 0.35), Math.min(Y0, Y1), Math.max(2.4, rx * 0.7), hh);
  ctx.restore();
}

function strokeBarrel(ctx: CanvasRenderingContext2D, map: WorldMap, barrel: Xy[]) {
  const mirror = barrel.map((p) => ({ x: p.x, y: -p.y }));
  ctx.setLineDash([...SHOCK_OVERLAY.barrelDash]);
  ctx.strokeStyle = SHOCK_OVERLAY.barrelHalo;
  ctx.lineWidth = SHOCK_OVERLAY.barrelHaloWidth;
  strokeXy(ctx, map, barrel);
  strokeXy(ctx, map, mirror);
  ctx.strokeStyle = SHOCK_OVERLAY.barrelStroke;
  ctx.lineWidth = SHOCK_OVERLAY.barrelWidth;
  strokeXy(ctx, map, barrel);
  strokeXy(ctx, map, mirror);
  ctx.setLineDash([]);
}

function strokeMachChord(ctx: CanvasRenderingContext2D, X: number, Y0: number, Y1: number) {
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(X, Y0);
  ctx.lineTo(X, Y1);
  ctx.strokeStyle = SHOCK_OVERLAY.diskHalo;
  ctx.lineWidth = SHOCK_OVERLAY.diskHaloWidth;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(X, Y0);
  ctx.lineTo(X, Y1);
  ctx.strokeStyle = SHOCK_OVERLAY.diskStroke;
  ctx.lineWidth = SHOCK_OVERLAY.diskWidth;
  ctx.stroke();
}

export type ShockOverlayPlan = {
  X: number;
  Y0: number;
  Y1: number;
  barrel: Xy[];
  align: CanvasTextAlign;
  title: { x: number; y: number };
  caption: { x: number; y: number };
  boxes: { x: number; y: number; w: number; h: number }[];
};

/** Pixel boxes and chord so isoline numbers stay off the Mach-disk overlay. */
export function shockOverlayPlan(map: WorldMap, solve: SolveResponse): ShockOverlayPlan | null {
  const pl = solve.plume;
  if (pl.shock_applied !== true) return null;
  const xm = pl.x_mach_disk_m;
  if (typeof xm !== "number" || !Number.isFinite(xm)) return null;
  const barrel = parseBarrel(pl.barrel_xy);
  const r = barrelRadiusAt(barrel, xm, Math.max(pl.H, 1e-4));
  const X = map.toX(xm);
  const Y0 = map.toY(-r);
  const Y1 = map.toY(r);
  const top = Math.min(Y0, Y1);
  const inX = X >= map.plot.l - 2 && X <= map.plot.l + map.plot.w + 2;
  if (!inX || map.plot.w < 140) {
    return { X, Y0, Y1, barrel, align: "left", title: { x: X, y: top }, caption: { x: X, y: top }, boxes: [] };
  }
  const roomLeft = X - map.plot.l >= 68;
  const roomRight = map.plot.l + map.plot.w - X >= 68;
  if (!roomLeft && !roomRight) {
    return { X, Y0, Y1, barrel, align: "left", title: { x: X, y: top }, caption: { x: X, y: top }, boxes: [] };
  }
  const align: CanvasTextAlign = roomLeft ? "right" : "left";
  const tx = roomLeft ? X - 8 : X + 8;
  const roomAbove = top > map.plot.t + 28;
  const titleY = roomAbove ? top - 14 : (Y0 + Y1) / 2 - 8;
  const capY = titleY + 13;
  const boxX = roomLeft ? tx - 72 : tx - 2;
  const boxes = [
    { x: boxX, y: titleY - 13, w: 74, h: 15 },
    { x: boxX, y: capY - 12, w: 74, h: 14 },
    { x: X - 7, y: Math.min(Y0, Y1) - 4, w: 14, h: Math.abs(Y1 - Y0) + 8 },
  ];
  return { X, Y0, Y1, barrel, align, title: { x: tx, y: titleY }, caption: { x: tx, y: capY }, boxes };
}

function paintShockLabels(ctx: CanvasRenderingContext2D, plan: ShockOverlayPlan) {
  if (!plan.boxes.length) return;
  ctx.textAlign = plan.align;
  ctx.textBaseline = "bottom";
  ctx.lineWidth = 3.1;
  ctx.strokeStyle = "rgba(10, 12, 16, 0.72)";
  ctx.fillStyle = "rgba(255, 224, 120, 0.98)";
  ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
  ctx.strokeText(MACH_DISK_LABEL, plan.title.x, plan.title.y);
  ctx.fillText(MACH_DISK_LABEL, plan.title.x, plan.title.y);
  ctx.font = "9px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255, 214, 140, 0.9)";
  ctx.strokeText(SHOCK_OVERLAY_CAPTION, plan.caption.x, plan.caption.y);
  ctx.fillText(SHOCK_OVERLAY_CAPTION, plan.caption.x, plan.caption.y);
}

function drawShocks(ctx: CanvasRenderingContext2D, map: WorldMap, plan: ShockOverlayPlan) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (plan.barrel.length >= 2) strokeBarrel(ctx, map, plan.barrel);
  strokeMachChord(ctx, plan.X, plan.Y0, plan.Y1);
  paintShockLabels(ctx, plan);
  ctx.restore();
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  map: WorldMap,
  view: View,
  cssH: number,
) {
  ctx.strokeStyle = "rgba(232,238,245,0.12)";
  ctx.lineWidth = 1;
  ctx.strokeRect(map.plot.l, map.plot.t, map.plot.w, map.plot.h);
  ctx.strokeStyle = "rgba(46,230,197,0.22)";
  ctx.beginPath();
  ctx.moveTo(map.plot.l, map.toY(0));
  ctx.lineTo(map.plot.l + map.plot.w, map.toY(0));
  ctx.stroke();
  ctx.fillStyle = "#8b9aab";
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  const xTicks = axisTicks(view.x0, view.x1, Math.max(3, Math.min(8, map.plot.w / 56)));
  const yTicks = axisTicks(view.y0, view.y1, Math.max(3, Math.min(8, map.plot.h / 44)));
  const xStep = tickStep(xTicks, (view.x1 - view.x0) / 5);
  const yStep = tickStep(yTicks, (view.y1 - view.y0) / 5);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const x of xTicks) {
    ctx.fillText(fmtTickMm(x, xStep), map.toX(x), map.plot.t + map.plot.h + 6);
  }
  ctx.fillText("x mm", map.plot.l + map.plot.w / 2, cssH - 14);
  ctx.save();
  ctx.translate(12, map.plot.t + map.plot.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("y mm", 0, 0);
  ctx.restore();
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const y of yTicks) {
    ctx.fillText(fmtTickMm(y, yStep), map.plot.l - 6, map.toY(y));
  }
}

function drawColorbar(
  ctx: CanvasRenderingContext2D,
  map: WorldMap,
  lo: number,
  hi: number,
  label: string,
) {
  const x = map.plot.l + map.plot.w + 10;
  const y = map.plot.t;
  const w = 10;
  const h = map.plot.h;
  for (let i = 0; i < h; i++) {
    const t = 1 - i / h;
    const [r, g, b] = colorize(t);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y + i, w, 1);
  }
  ctx.strokeStyle = "rgba(232,238,245,0.25)";
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#c5d0dc";
  ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(fmtBar(hi), x + w + 4, y);
  ctx.fillText(fmtBar(lo), x + w + 4, y + h);
  ctx.save();
  ctx.translate(x + w + 16, y + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillStyle = "#8b9aab";
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function fmtBar(v: number): string {
  return fmtIsoValue(v);
}

let fieldScratch: HTMLCanvasElement | null = null;

/** Bilinear color of the selected field only. Never tints cells by barrel / Mach disk. */
function drawFieldMap(
  ctx: CanvasRenderingContext2D,
  map: WorldMap,
  plume: SolveResponse["plume"],
  field: FieldId,
  lo: number,
  hi: number,
) {
  const { l, t, w: pw, h: ph } = map.plot;
  const w = Math.max(1, Math.round(pw));
  const h = Math.max(1, Math.round(ph));
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const span = hi - lo || 1;
  const arr = fieldArray(plume, field);
  const [bgR, bgG, bgB] = PLOT_BG;

  for (let j = 0; j < h; j++) {
    const py = t + ((j + 0.5) * ph) / h;
    const y = map.fromY(py);
    for (let i = 0; i < w; i++) {
      const px = l + ((i + 0.5) * pw) / w;
      const x = map.fromX(px);
      const off = (j * w + i) * 4;
      data[off] = bgR;
      data[off + 1] = bgG;
      data[off + 2] = bgB;
      data[off + 3] = 255;
      if (x < 0) continue;
      const yy = Math.abs(y);
      const n = sampleGrid(plume.n_ratio, plume.nx, plume.ny, plume.x, plume.y, x, yy);
      const a = fieldMaskAlpha(n);
      if (a <= 0) continue;
      const fv = sampleGrid(arr, plume.nx, plume.ny, plume.x, plume.y, x, yy);
      if (!Number.isFinite(fv)) continue;
      const [r, g, b] = colorize((fv - lo) / span);
      data[off] = Math.round(bgR + (r - bgR) * a);
      data[off + 1] = Math.round(bgG + (g - bgG) * a);
      data[off + 2] = Math.round(bgB + (b - bgB) * a);
    }
  }

  if (typeof document === "undefined") return;
  if (!fieldScratch) fieldScratch = document.createElement("canvas");
  if (fieldScratch.width !== w || fieldScratch.height !== h) {
    fieldScratch.width = w;
    fieldScratch.height = h;
  }
  const sctx = fieldScratch.getContext("2d");
  if (!sctx) return;
  sctx.putImageData(img, 0, 0);
  ctx.drawImage(fieldScratch, l, t, pw, ph);
}

function drawIsolines(
  ctx: CanvasRenderingContext2D,
  map: WorldMap,
  plume: SolveResponse["plume"],
  field: FieldId,
  lo: number,
  hi: number,
  view: View,
  de: number,
  avoid: { x: number; y: number; w: number; h: number }[] = [],
) {
  const arr = fieldArray(plume, field);
  const used = fieldIsoLevels(lo, hi);
  const fallback = used.length ? used : niceIsoLevels(lo, hi);
  if (!fallback.length) return;
  const segs = fieldIsolines(plume.x, plume.y, arr, plume.nx, plume.ny, fallback, plume.n_ratio);
  const chains = stitchIso(segs);
  const strokeChain = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const X = map.toX(p.x);
      const Y = map.toY(p.y);
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    });
    ctx.strokeStyle = "rgba(6, 12, 20, 0.38)";
    ctx.lineWidth = 2.15;
    ctx.stroke();
    ctx.strokeStyle = "rgba(244, 248, 252, 0.82)";
    ctx.lineWidth = 1.05;
    ctx.stroke();
  };
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.setLineDash([]);
  for (const chain of chains) {
    strokeChain(chain.pts);
    strokeChain(chain.pts.map((p) => ({ x: p.x, y: -p.y })));
  }
  const re = de / 2000;
  const padX = Math.max((view.x1 - view.x0) * 0.06, 0.002);
  const padY = Math.max((view.y1 - view.y0) * 0.06, 0.002);
  const nozzleClear = re * 1.6;
  const labelChains = [
    ...chains,
    ...chains.map((c) => ({ level: c.level, pts: c.pts.map((p) => ({ x: p.x, y: -p.y })) })),
  ];
  const labels = pickIsoLabels(labelChains, fallback, {
    xMin: Math.max(view.x0 + padX, view.x0 < nozzleClear ? nozzleClear : view.x0 + padX),
    yMin: view.y0 + padY,
    xMax: view.x1 - padX,
    yMax: view.y1 - padY,
    toPx: (x, y) => ({ x: map.toX(x), y: map.toY(y) }),
    fmt: fmtIsoValue,
    avoid,
  });
  ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const lab of labels) {
    const X = map.toX(lab.x);
    const Y = map.toY(lab.y);
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = "rgba(8, 16, 24, 0.62)";
    ctx.strokeText(lab.text, X, Y);
    ctx.fillStyle = "rgba(244, 248, 252, 0.94)";
    ctx.fillText(lab.text, X, Y);
  }
  ctx.restore();
}

export function drawPlumeFrame(opts: {
  ctx: CanvasRenderingContext2D;
  cssW: number;
  cssH: number;
  dpr: number;
  solve: SolveResponse | null;
  field: FieldId;
  view: View;
  dc: number;
  dt: number;
  de: number;
  probe: { x: number; y: number } | null;
  disk?: { x: number; r: number } | null;
  bow?: Xy[];
  showShocks?: boolean;
}): { map: WorldMap } {
  const { ctx, cssW, cssH, dpr, solve, field, view, dc, dt, de, probe, disk, bow, showShocks } = opts;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = "#0a1520";
  ctx.fillRect(0, 0, cssW, cssH);

  const map = worldMap(cssW, cssH, view);
  ctx.save();
  ctx.beginPath();
  ctx.rect(map.plot.l, map.plot.t, map.plot.w, map.plot.h);
  ctx.clip();
  ctx.fillStyle = "#0c1a28";
  ctx.fillRect(map.plot.l, map.plot.t, map.plot.w, map.plot.h);

  let lo = 0;
  let hi = 1;
  if (solve) {
    const pl = solve.plume;
    [lo, hi] = fieldRange(pl, fieldArray(pl, field));
    drawFieldMap(ctx, map, pl, field, lo, hi);
    const shockPlan = showShocks ? shockOverlayPlan(map, solve) : null;
    drawIsolines(ctx, map, pl, field, lo, hi, view, de, shockPlan?.boxes ?? []);
    if (shockPlan) drawShocks(ctx, map, shockPlan);
  }

  drawNozzle(ctx, map, dc, dt, de, view);
  // Probe plate is a filled glyph; station (green pick) is drawn after the clip.
  if (disk) drawDisk(ctx, map, disk, bow ?? []);

  if (!solve) {
    const tx = map.toX(Math.max(view.x1 * 0.42, 4 * (de / 2000)));
    const ty = map.toY(Math.max(view.y1 * 0.35, de / 2000));
    ctx.fillStyle = "rgba(196, 210, 222, 0.92)";
    ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Empty nozzle field", tx, ty);
    ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "rgba(139,154,171,0.95)";
    ctx.fillText("Run a point to fill the jet", tx, ty + 18);
  }

  ctx.restore();
  drawAxes(ctx, map, view, cssH);
  if (solve) drawColorbar(ctx, map, lo, hi, FIELD_LABEL[field]);

  if (probe) {
    const px = map.toX(probe.x);
    const py = map.toY(probe.y);
    ctx.strokeStyle = "#3dff8a";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px - 10, py);
    ctx.lineTo(px + 10, py);
    ctx.moveTo(px, py - 10);
    ctx.lineTo(px, py + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  return { map };
}

export function sampleProbe(solve: SolveResponse, x: number, y: number): ProbeSample | null {
  const pl = solve.plume;
  const yy = Math.abs(y);
  const n = sampleGrid(pl.n_ratio, pl.nx, pl.ny, pl.x, pl.y, x, yy);
  const tR = sampleGrid(pl.t_ratio, pl.nx, pl.ny, pl.x, pl.y, x, yy);
  const U = sampleGrid(pl.speed, pl.nx, pl.ny, pl.x, pl.y, x, yy);
  const M = sampleGrid(pl.mach, pl.nx, pl.ny, pl.x, pl.y, x, yy);
  const E = sampleGrid(pl.e_kin_eV, pl.nx, pl.ny, pl.x, pl.y, x, yy);
  const EO = sampleGrid(pl.e_O_eV, pl.nx, pl.ny, pl.x, pl.y, x, yy);
  const h = sampleGrid(pl.h_tot_MJ_kg, pl.nx, pl.ny, pl.x, pl.y, x, yy);
  if (![n, tR, U, M, E, h].every(Number.isFinite)) return null;
  const T = tR * pl.T0;
  const xO = solve.cea.exit.x_O ?? solve.cea.exit.mole_fractions?.O ?? 0;
  return {
    x_m: x,
    y_m: yy,
    T,
    t_ratio: tR,
    n_ratio: n,
    U,
    mach: M,
    e_kin: E,
    e_O: xO > 1e-4 && Number.isFinite(EO) ? EO : null,
    e_th: 1.5 * K_EV * T,
    h_tot: h,
    kn: pl.kn_gll_exit / Math.max(n, 1e-12),
  };
}
