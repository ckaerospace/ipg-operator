import type { FieldId, ProbeSample, SolveResponse } from "../types";
import { K_EV } from "../format";
import { colorize } from "./color";
import { sampleGrid } from "./sample";

export type View = { x0: number; x1: number; y0: number; y1: number };

export type Particle = { x: number; y: number; age: number };

const N_PARTICLES = 720;
const CROSS_SEC = 3.2;
const N_FAINT = 4e-4;

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

/** Lift the navy end of the ramp so dots stay visible on the dark plot. */
function fieldColor(t: number): [number, number, number] {
  return colorize(0.3 + 0.7 * Math.min(1, Math.max(0, t)));
}

export function fitView(plume: SolveResponse["plume"], dc: number, dt: number, de: number): View {
  const H = Math.max(plume.H || de / 2000, de / 2000);
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
  const L = nozzleLength(dc, dt, de, H);
  return { x0: -L, x1: xMax, y0: 0, y1: yMax };
}

export function emptyView(dc: number, dt: number, de: number): View {
  const H = de / 2000;
  const L = nozzleLength(dc, dt, de, H);
  return { x0: -L, x1: 14 * H, y0: 0, y1: 5.5 * H };
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
  const padL = 46;
  const padR = 52;
  const padT = 16;
  const padB = 28;
  const pw = Math.max(10, w - padL - padR);
  const ph = Math.max(10, h - padT - padB);
  const dx = view.x1 - view.x0;
  const dy = view.y1 - view.y0;
  const s = Math.min(pw / dx, ph / dy);
  const usedW = dx * s;
  const usedH = dy * s;
  const l = padL + (pw - usedW) * 0.15;
  const t = padT + (ph - usedH) * 0.2;
  return {
    plot: { l, t, w: usedW, h: usedH },
    toX: (x) => l + ((x - view.x0) / dx) * usedW,
    toY: (y) => t + usedH - ((y - view.y0) / dy) * usedH,
    fromX: (px) => view.x0 + ((px - l) / usedW) * dx,
    fromY: (py) => view.y0 + ((t + usedH - py) / usedH) * dy,
  };
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
  const pts = [
    [xCh, 0],
    [xCh, rc],
    [xConv, rc],
    [xThroat, rt],
    [xExit, re],
    [xExit, Math.max(view.y1 * 1.2, re * 4)],
    [xCh - 0.01, Math.max(view.y1 * 1.2, re * 4)],
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
  ctx.strokeStyle = "#2ee6c5";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const wall = [
    [xCh, rc],
    [xConv, rc],
    [xThroat, rt],
    [xExit, re],
  ];
  wall.forEach(([x, y], i) => {
    const X = map.toX(x);
    const Y = map.toY(y);
    if (i === 0) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
  });
  ctx.stroke();
  ctx.strokeStyle = "rgba(46,230,197,0.35)";
  ctx.beginPath();
  ctx.moveTo(map.toX(xCh), map.toY(0));
  ctx.lineTo(map.toX(xExit), map.toY(0));
  ctx.stroke();
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
  ctx.fillStyle = "#8b9aab";
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const nx = 4;
  for (let i = 0; i <= nx; i++) {
    const x = view.x0 + ((view.x1 - view.x0) * i) / nx;
    const px = map.toX(x);
    ctx.fillText(`${Math.round(x * 1000)}`, px, map.plot.t + map.plot.h + 6);
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
  const ny = 3;
  for (let i = 0; i <= ny; i++) {
    const y = view.y0 + ((view.y1 - view.y0) * i) / ny;
      ctx.fillText(`${Math.round(y * 1000)}`, map.plot.l - 6, map.toY(y));
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
    const [r, g, b] = fieldColor(t);
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
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

function exitX(plume: SolveResponse["plume"]): number {
  for (let i = 0; i < plume.x.length; i++) {
    if (plume.x[i] >= 0) return plume.x[i] + 1e-7;
  }
  return 1e-6;
}

function spawnExit(p: Particle, plume: SolveResponse["plume"]) {
  p.x = exitX(plume);
  const H = Math.max(plume.H, 1e-6);
  p.y = Math.random() * H * 0.998;
  p.age = 0;
}

function physStep(wallDt: number, plume: SolveResponse["plume"], view: View): number {
  const U0 = Math.max(plume.U0, 1);
  const L = Math.max(view.x1, plume.H);
  return Math.min(Math.max(wallDt, 0), 0.05) * (L / (CROSS_SEC * U0));
}

function advect(p: Particle, plume: SolveResponse["plume"], dt: number, view: View, recycle = true): boolean {
  const u = sampleGrid(plume.u, plume.nx, plume.ny, plume.x, plume.y, p.x, p.y);
  const v = sampleGrid(plume.v, plume.nx, plume.ny, plume.x, plume.y, p.x, p.y);
  if (!Number.isFinite(u) || !Number.isFinite(v)) {
    if (recycle) spawnExit(p, plume);
    return false;
  }
  p.x += u * dt;
  p.y += v * dt;
  p.age += dt;
  if (p.y < 0) p.y = -p.y;
  const n = sampleGrid(plume.n_ratio, plume.nx, plume.ny, plume.x, plume.y, p.x, p.y);
  const gone =
    p.x > view.x1 ||
    p.y > view.y1 ||
    p.x < -0.05 * plume.H ||
    !Number.isFinite(n) ||
    n < N_FAINT;
  if (gone) {
    if (recycle) spawnExit(p, plume);
    return false;
  }
  return true;
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
  particles: Particle[];
  probe: { x: number; y: number } | null;
}): { map: WorldMap } {
  const { ctx, cssW, cssH, dpr, solve, field, view, dc, dt, de, particles, probe } = opts;
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
    const arr = fieldArray(pl, field);
    [lo, hi] = fieldRange(pl, arr);
    const span = hi - lo || 1;
    ctx.globalCompositeOperation = "lighter";
    for (const p of particles) {
      if (p.y < 0 || p.x < -1e-6) continue;
      const n = sampleGrid(pl.n_ratio, pl.nx, pl.ny, pl.x, pl.y, p.x, p.y);
      if (!Number.isFinite(n) || n < N_FAINT) continue;
      const fv = sampleGrid(arr, pl.nx, pl.ny, pl.x, pl.y, p.x, p.y);
      const t = Number.isFinite(fv) ? (fv - lo) / span : 0.5;
      const [r, g, b] = fieldColor(t);
      const nn = Math.min(1, Math.max(0, n));
      const alpha = 0.28 + 0.72 * Math.pow(nn, 0.35);
      const rad = 0.6 + 1.9 * Math.sqrt(nn);
      const px = map.toX(p.x);
      const py = map.toY(p.y);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  drawNozzle(ctx, map, dc, dt, de, view);

  if (!solve) {
    const tx = map.toX(Math.max(view.x1 * 0.42, 4 * (de / 2000)));
    const ty = map.toY(view.y1 * 0.62);
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

export function seedParticles(plume: SolveResponse["plume"], view: View, n = N_PARTICLES): Particle[] {
  const out: Particle[] = [];
  const transit = Math.max(view.x1, plume.H) / Math.max(plume.U0, 1);
  const sub = 36;
  for (let i = 0; i < n; i++) {
    const p: Particle = { x: 0, y: 0, age: 0 };
    spawnExit(p, plume);
    const frac = (i + Math.random()) / n;
    const dt = (frac * transit) / sub;
    for (let k = 0; k < sub; k++) {
      const ox = p.x;
      const oy = p.y;
      const oa = p.age;
      if (!advect(p, plume, dt, view, false)) {
        p.x = ox;
        p.y = oy;
        p.age = oa;
        break;
      }
    }
    out.push(p);
  }
  return out;
}

export function stepParticles(plume: SolveResponse["plume"], parts: Particle[], wallDt: number, view: View) {
  const dt = physStep(wallDt, plume, view);
  for (const p of parts) advect(p, plume, dt, view);
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
