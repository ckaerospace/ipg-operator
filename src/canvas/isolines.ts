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

function snapLevel(v: number, step: number): number {
  const s = Math.round(v / step) * step;
  const dec = Math.max(0, Math.ceil(-Math.log10(step)) + 1);
  return Number(s.toFixed(Math.min(dec, 8)));
}

/**
 * 4–6 interior colorbar ticks with 1–2–5 spacing. Never returns a raw 6.173-style value.
 */
export function niceIsoLevels(lo: number, hi: number): number[] {
  const span = hi - lo;
  if (!Number.isFinite(span) || span <= 0) return [];
  for (const target of [5, 4, 6, 3, 7]) {
    const step = niceStep(span, target);
    if (!(step > 0)) continue;
    const start = snapLevel(Math.ceil((lo + step * 0.15) / step) * step, step);
    const levels: number[] = [];
    for (let k = 0; k < 12; k++) {
      const v = snapLevel(start + k * step, step);
      if (v >= hi - step * 0.08) break;
      if (v <= lo + step * 0.08) continue;
      levels.push(v);
    }
    if (levels.length >= 4 && levels.length <= 6) return levels;
    if (target === 7 && levels.length >= 3) return levels.slice(0, 6);
  }
  const step = niceStep(span, 5);
  const mid = snapLevel(lo + span / 2, step);
  return [mid].filter((v) => v > lo && v < hi);
}

export function fmtIsoValue(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  if (Math.abs(v) >= 1) return Number(v.toFixed(2)).toString();
  return Number(v.toFixed(2)).toString();
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function edgePoint(
  edge: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  v00: number,
  v10: number,
  v01: number,
  v11: number,
  level: number,
): Xy | null {
  const t = (a: number, b: number) => (level - a) / (b - a);
  if (edge === 0) {
    if (v10 === v00) return null;
    return { x: lerp(x0, x1, t(v00, v10)), y: y0 };
  }
  if (edge === 1) {
    if (v11 === v10) return null;
    return { x: x1, y: lerp(y0, y1, t(v10, v11)) };
  }
  if (edge === 2) {
    if (v11 === v01) return null;
    return { x: lerp(x0, x1, t(v01, v11)), y: y1 };
  }
  if (v01 === v00) return null;
  return { x: x0, y: lerp(y0, y1, t(v00, v01)) };
}

/** SW=1, SE=2, NE=4, NW=8. Edges: 0 bottom, 1 right, 2 top, 3 left. */
const MS_EDGES: [number, number][][] = [
  [],
  [[0, 3]],
  [[0, 1]],
  [[3, 1]],
  [[1, 2]],
  [[0, 1], [3, 2]],
  [[0, 2]],
  [[3, 2]],
  [[2, 3]],
  [[0, 2]],
  [[0, 3], [1, 2]],
  [[1, 2]],
  [[1, 3]],
  [[0, 1]],
  [[0, 3]],
  [],
];

function bit(v: number, level: number): 0 | 1 {
  return v >= level ? 1 : 0;
}

/**
 * Marching squares on the bilinear grid. `mask` is n/n0 (or any visibility field);
 * cells with all corners below the faint cutoff are skipped.
 */
export function fieldIsolines(
  xs: number[],
  ys: number[],
  field: number[],
  nx: number,
  ny: number,
  levels: number[],
  mask?: number[],
): IsoSeg[] {
  const out: IsoSeg[] = [];
  if (nx < 2 || ny < 2) return out;
  for (const level of levels) {
    if (!Number.isFinite(level)) continue;
    for (let j = 0; j < ny - 1; j++) {
      const y0 = ys[j];
      const y1 = ys[j + 1];
      if (y1 < 0 && y0 < 0) continue;
      for (let i = 0; i < nx - 1; i++) {
        const x0 = xs[i];
        const x1 = xs[i + 1];
        if (x1 < 0 && x0 < 0) continue;
        const i00 = j * nx + i;
        const i10 = i00 + 1;
        const i01 = (j + 1) * nx + i;
        const i11 = i01 + 1;
        if (mask) {
          const nMax = Math.max(mask[i00], mask[i10], mask[i01], mask[i11]);
          if (!Number.isFinite(nMax) || nMax < N_FAINT) continue;
        }
        const v00 = field[i00];
        const v10 = field[i10];
        const v01 = field[i01];
        const v11 = field[i11];
        if (![v00, v10, v01, v11].every(Number.isFinite)) continue;
        const code =
          bit(v00, level) | (bit(v10, level) << 1) | (bit(v11, level) << 2) | (bit(v01, level) << 3);
        for (const [e0, e1] of MS_EDGES[code]) {
          const a = edgePoint(e0, x0, x1, y0, y1, v00, v10, v01, v11, level);
          const b = edgePoint(e1, x0, x1, y0, y1, v00, v10, v01, v11, level);
          if (!a || !b) continue;
          if (a.y < 0 && b.y < 0) continue;
          if (a.x < 0 && b.x < 0) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          if (dx * dx + dy * dy < 1e-20) continue;
          out.push({ x0: a.x, y0: Math.max(a.y, 0), x1: b.x, y1: Math.max(b.y, 0), level });
        }
      }
    }
  }
  return out;
}

/** Join shared-edge segments into polylines for stroking and labels. */
export function stitchIso(segs: IsoSeg[]): IsoChain[] {
  const byLevel = new Map<number, IsoSeg[]>();
  for (const s of segs) {
    const list = byLevel.get(s.level);
    if (list) list.push(s);
    else byLevel.set(s.level, [s]);
  }
  const near = (ax: number, ay: number, bx: number, by: number) =>
    Math.abs(ax - bx) <= 1e-9 && Math.abs(ay - by) <= 1e-9;
  const chains: IsoChain[] = [];
  for (const [level, list] of byLevel) {
    const unused = list.map((s) => ({ ...s, used: false }));
    const findNext = (x: number, y: number) => {
      for (const s of unused) {
        if (s.used) continue;
        if (near(s.x0, s.y0, x, y)) return { s, x: s.x1, y: s.y1 };
        if (near(s.x1, s.y1, x, y)) return { s, x: s.x0, y: s.y0 };
      }
      return null;
    };
    for (const start of unused) {
      if (start.used) continue;
      start.used = true;
      const pts: Xy[] = [
        { x: start.x0, y: start.y0 },
        { x: start.x1, y: start.y1 },
      ];
      let tip = { x: start.x1, y: start.y1 };
      let n = findNext(tip.x, tip.y);
      while (n) {
        n.s.used = true;
        pts.push({ x: n.x, y: n.y });
        tip = { x: n.x, y: n.y };
        n = findNext(tip.x, tip.y);
      }
      const head: Xy[] = [];
      let h = { x: start.x0, y: start.y0 };
      n = findNext(h.x, h.y);
      while (n) {
        n.s.used = true;
        head.push({ x: n.x, y: n.y });
        h = { x: n.x, y: n.y };
        n = findNext(h.x, h.y);
      }
      chains.push({ level, pts: [...head.reverse(), ...pts] });
    }
  }
  return chains;
}

function chainLength(pts: Xy[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    L += Math.hypot(dx, dy);
  }
  return L;
}

function pointAt(pts: Xy[], frac: number): Xy | null {
  if (pts.length < 2) return null;
  const total = chainLength(pts);
  if (!(total > 0)) return pts[Math.floor(pts.length / 2)] ?? null;
  let want = total * Math.min(1, Math.max(0, frac));
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (want <= d) {
      const t = d > 0 ? want / d : 0;
      return { x: lerp(pts[i - 1].x, pts[i].x, t), y: lerp(pts[i - 1].y, pts[i].y, t) };
    }
    want -= d;
  }
  return pts[pts.length - 1];
}

function boxesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

/**
 * Place 2–4 labels on longer isolines. `xMin` keeps them off the nozzle (x≈0).
 * Coordinates are world metres; `toPx` is used only for overlap in pixel space.
 */
export function pickIsoLabels(
  chains: IsoChain[],
  levels: number[],
  opts: {
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
    toPx: (x: number, y: number) => { x: number; y: number };
    fmt?: (v: number) => string;
  },
): IsoLabel[] {
  const fmt = opts.fmt ?? fmtIsoValue;
  const n = levels.length;
  if (n === 0 || chains.length === 0) return [];
  const want = n <= 3 ? n : n >= 6 ? 4 : 3;
  const pick: number[] = [];
  if (n <= 3) {
    for (let i = 0; i < n; i++) pick.push(i);
  } else {
    for (let k = 0; k < want; k++) {
      pick.push(Math.round(((k + 1) * (n + 1)) / (want + 1)) - 1);
    }
  }
  const idx = [...new Set(pick.filter((i) => i >= 0 && i < n))];
  const labels: IsoLabel[] = [];
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  const fracs = [0.48, 0.36, 0.62, 0.28, 0.72];

  for (const i of idx) {
    const level = levels[i];
    const cands = chains
      .filter((c) => c.level === level)
      .map((c) => ({ c, L: chainLength(c.pts) }))
      .sort((a, b) => b.L - a.L);
    let placed = false;
    for (const { c, L } of cands) {
      if (L < 1e-4) continue;
      for (const f of fracs) {
        const p = pointAt(c.pts, f);
        if (!p) continue;
        if (p.x < opts.xMin || p.y < opts.yMin) continue;
        if (p.x > opts.xMax || p.y > opts.yMax) continue;
        const px = opts.toPx(p.x, p.y);
        const box = { x: px.x - 16, y: px.y - 9, w: 36, h: 16 };
        if (boxes.some((b) => boxesOverlap(box, b))) continue;
        boxes.push(box);
        labels.push({ x: p.x, y: p.y, text: fmt(level), level });
        placed = true;
        break;
      }
      if (placed) break;
    }
    if (labels.length >= 4) break;
  }
  return labels.slice(0, 4);
}
