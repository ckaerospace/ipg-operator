import type { AxisFamily } from "../facility";
import { usesGrams } from "../facility";
import { fmtMdotLabel, fmtPower, moleLabel, speciesColor } from "../format";
import type { CharacteristicsResponse } from "../types";
import { mdotStroke } from "./color";
import { sample1d } from "./sample";

export type MapView = {
  p0: number;
  p1: number;
  h0: number;
  h1: number;
};

export function axesView(ch: CharacteristicsResponse): MapView {
  const p = ch.axes.pinj_Pa;
  const h = ch.axes.hinj_MJ_kg;
  return { p0: p[0] ?? 0, p1: p[1] ?? 250, h0: h[0] ?? 0, h1: h[1] ?? 40 };
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

export function drawCharacteristics(opts: {
  ctx: CanvasRenderingContext2D;
  cssW: number;
  cssH: number;
  dpr: number;
  ch: CharacteristicsResponse;
  family: AxisFamily;
  cursor: { pinj: number; hinj: number };
  marks?: { pinj: number; hinj: number; label: string }[];
}): MapLayout {
  const { ctx, cssW, cssH, dpr, ch, family, cursor, marks } = opts;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = "#0b1724";
  ctx.fillRect(0, 0, cssW, cssH);

  const view = axesView(ch);
  const lay = mapLayout(cssW, cssH, view);
  ctx.fillStyle = "#102033";
  ctx.fillRect(lay.l, lay.t, lay.w, lay.h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(lay.l, lay.t, lay.w, lay.h);
  ctx.clip();

  const dp = niceStep(view.p1 - view.p0);
  const dh = niceStep(view.h1 - view.h0);
  ctx.strokeStyle = "rgba(180,210,230,0.12)";
  ctx.lineWidth = 1;
  ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#8b9aab";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let p = Math.ceil(view.p0 / dp) * dp; p <= view.p1 + 1e-6; p += dp) {
    const x = lay.toX(p);
    ctx.beginPath();
    ctx.moveTo(x, lay.t);
    ctx.lineTo(x, lay.t + lay.h);
    ctx.stroke();
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let h = Math.ceil(view.h0 / dh) * dh; h <= view.h1 + 1e-6; h += dh) {
    const y = lay.toY(h);
    ctx.beginPath();
    ctx.moveTo(lay.l, y);
    ctx.lineTo(lay.l + lay.w, y);
    ctx.stroke();
  }

  for (const k of ch.kinks) {
    if (k.hinj_MJ_kg < view.h0 || k.hinj_MJ_kg > view.h1) continue;
    const y = lay.toY(k.hinj_MJ_kg);
    ctx.strokeStyle = "rgba(245, 215, 110, 0.55)";
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(lay.l, y);
    ctx.lineTo(lay.l + lay.w, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#f5d76e";
    ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(k.label, lay.l + 6, y - 2);
  }

  const nM = Math.max(1, ch.mdot_isolines.length - 1);
  ch.mdot_isolines.forEach((iso, i) => {
    const pts = clipLine(iso.pinj_Pa, iso.hinj_MJ_kg);
    if (pts.length < 2) return;
    ctx.strokeStyle = mdotStroke(i / nM);
    ctx.lineWidth = 1.8;
    ctx.setLineDash([]);
    ctx.beginPath();
    let started = false;
    let labelAt: { x: number; y: number } | null = null;
    let visible = 0;
    for (const pt of pts) {
      const x = lay.toX(pt.p);
      const y = lay.toY(pt.h);
      const inx = pt.p >= view.p0 && pt.p <= view.p1 && pt.h >= view.h0 && pt.h <= view.h1;
      if (!inx) {
        started = false;
        continue;
      }
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
      visible++;
      if (visible === Math.max(2, Math.floor(pts.length * 0.55))) labelAt = { x, y };
    }
    ctx.stroke();
    if (labelAt && iso.mdot_mg_s != null) {
      ctx.fillStyle = mdotStroke(i / nM);
      ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(fmtMdotLabel(iso.mdot_mg_s, family), labelAt.x + 3, labelAt.y - 1);
    }
  });

  const powerLabels: { x: number; y: number; text: string }[] = [];
  ch.power_isolines.forEach((iso) => {
    const pts = clipLine(iso.pinj_Pa, iso.hinj_MJ_kg);
    if (pts.length < 2) return;
    ctx.strokeStyle = "rgba(232,238,245,0.78)";
    ctx.lineWidth = 1.15;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    let started = false;
    const vis: { x: number; y: number }[] = [];
    for (const pt of pts) {
      if (pt.p < view.p0 || pt.p > view.p1 || pt.h < view.h0 || pt.h > view.h1) {
        started = false;
        continue;
      }
      const x = lay.toX(pt.p);
      const y = lay.toY(pt.h);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
      vis.push({ x, y });
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (iso.power_W != null) {
      const spot = insetLabelSpot(vis, lay, 12);
      if (spot) powerLabels.push({ x: spot.x + 3, y: spot.y - 1, text: fmtPower(iso.power_W) });
    }
  });

  if (marks) {
    ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
    for (const m of marks) {
      if (m.pinj < view.p0 || m.pinj > view.p1) continue;
      const x = lay.toX(m.pinj);
      const y = lay.toY(m.hinj);
      ctx.strokeStyle = "#e8eef5";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x + 6, y);
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x, y + 6);
      ctx.stroke();
      ctx.fillStyle = "#e8eef5";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(m.label, x + 8, y);
    }
  }

  const cx = lay.toX(cursor.pinj);
  const cy = lay.toY(cursor.hinj);
  ctx.strokeStyle = "#2ee6c5";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(lay.l, cy);
  ctx.lineTo(lay.l + lay.w, cy);
  ctx.moveTo(cx, lay.t);
  ctx.lineTo(cx, lay.t + lay.h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  drawPowerLabels(ctx, powerLabels, lay);

  ctx.strokeStyle = "rgba(232,238,245,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(lay.l, lay.t, lay.w, lay.h);

  ctx.fillStyle = "#8b9aab";
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let p = Math.ceil(view.p0 / dp) * dp; p <= view.p1 + 1e-6; p += dp) {
    ctx.fillText(String(Math.round(p)), lay.toX(p), lay.t + lay.h + 6);
  }
  ctx.fillText("p_inj  [Pa]", lay.l + lay.w / 2, cssH - 14);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let h = Math.ceil(view.h0 / dh) * dh; h <= view.h1 + 1e-6; h += dh) {
    ctx.fillText(String(Math.round(h)), lay.l - 6, lay.toY(h));
  }
  ctx.save();
  ctx.translate(12, lay.t + lay.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("h_inj  [MJ/kg]", 0, 0);
  ctx.restore();

  ctx.fillStyle = "#9aa8b7";
  ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const unit = usesGrams(family) ? "g/s" : "mg/s";
  ctx.fillText(`solid ṁ ${unit}   dashed coupled P`, lay.l, 4);

  return lay;
}

function insetLabelSpot(
  vis: { x: number; y: number }[],
  lay: MapLayout,
  pad: number,
): { x: number; y: number } | null {
  if (!vis.length) return null;
  const x0 = lay.l + pad;
  const x1 = lay.l + lay.w - pad;
  const y0 = lay.t + pad;
  const y1 = lay.t + lay.h - pad;
  const inset = vis.filter((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1);
  const pool = inset.length ? inset : vis;
  const pick = pool[Math.min(pool.length - 1, Math.max(0, Math.floor(pool.length * 0.55)))];
  return {
    x: Math.min(Math.max(pick.x, x0), x1),
    y: Math.min(Math.max(pick.y, y0), y1),
  };
}

function drawPowerLabels(
  ctx: CanvasRenderingContext2D,
  spots: { x: number; y: number; text: string }[],
  lay: MapLayout,
): void {
  if (!spots.length) return;
  spots.sort((a, b) => a.y - b.y || a.x - b.x);
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(232,238,245,0.92)";
  const yMax = lay.t + lay.h - 2;
  for (let i = 0; i < spots.length; i++) {
    const a = spots[i];
    for (let j = 0; j < i; j++) {
      const b = spots[j];
      if (Math.abs(a.x - b.x) < 48 && Math.abs(a.y - b.y) < 12) {
        a.y = b.y + 12;
        if (a.y > yMax) {
          a.y = b.y;
          a.x = b.x + 48;
        }
      }
    }
    a.y = Math.min(a.y, yMax);
    ctx.fillText(a.text, a.x, a.y);
  }
}

function niceStep(span: number): number {
  const raw = span / 8;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-6)));
  const n = raw / pow;
  if (n < 1.5) return pow;
  if (n < 3.5) return 2 * pow;
  if (n < 7.5) return 5 * pow;
  return 10 * pow;
}

export function mapReadout(
  ch: CharacteristicsResponse,
  pinj: number,
  hinj: number,
): { mdot_mg_s: number; power_W: number; xs: { key: string; x: number }[] } {
  const k = ch.k_kg_s_Pa ? sample1d(ch.hinj_MJ_kg, ch.k_kg_s_Pa, hinj) : NaN;
  const mdot_mg_s = Number.isFinite(k) ? k * pinj * 1e6 : sample1d(ch.hinj_MJ_kg, ch.chamber.mdot_mg_s, hinj) * (pinj / ch.pinj_ref_Pa);
  const power_W = mdot_mg_s * hinj;
  const xs: { key: string; x: number }[] = [];
  for (const [key, arr] of Object.entries(ch.chamber.x)) {
    const max = Math.max(...arr);
    if (max < 0.001) continue;
    xs.push({ key, x: sample1d(ch.hinj_MJ_kg, arr, hinj) });
  }
  xs.sort((a, b) => b.x - a.x);
  return { mdot_mg_s, power_W, xs };
}

export function isElectron(key: string): boolean {
  return key === "e-";
}

export function isPositiveIon(key: string): boolean {
  return key.endsWith("+");
}

/** Neutrals, then cations, then dashed e- on top so O+ shows in the dash gaps. */
export function compositionDrawOrder(keys: string[]): string[] {
  const neutrals: string[] = [];
  const electrons: string[] = [];
  const ions: string[] = [];
  for (const key of keys) {
    if (isElectron(key)) electrons.push(key);
    else if (isPositiveIon(key)) ions.push(key);
    else neutrals.push(key);
  }
  return [...neutrals, ...ions, ...electrons];
}

export function compositionDash(key: string): number[] {
  return isElectron(key) ? [4, 3] : [];
}

export function drawComposition(opts: {
  ctx: CanvasRenderingContext2D;
  cssW: number;
  cssH: number;
  dpr: number;
  ch: CharacteristicsResponse;
  hinjMark: number;
}): void {
  const { ctx, cssW, cssH, dpr, ch, hinjMark } = opts;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = "#0b1218";
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
  const keys = Object.keys(ch.chamber.x).filter((key) => Math.max(...ch.chamber.x[key]) >= 0.001);
  const legendKeys = compositionDrawOrder(keys);
  const gap = 10;
  const rowH = 12;
  const swatchW = 12;
  const l = 40;
  const r = 8;
  const b = 24;
  const maxLegendW = Math.max(40, cssW - l - r);
  const itemW = (key: string) => swatchW + 4 + ctx.measureText(moleLabel(key)).width + gap;
  const rows: string[][] = [];
  let cur: string[] = [];
  let curW = 0;
  for (const key of legendKeys) {
    const tw = itemW(key);
    if (cur.length > 0 && curW + tw > maxLegendW) {
      rows.push(cur);
      cur = [key];
      curW = tw;
    } else {
      cur.push(key);
      curW += tw;
    }
  }
  if (cur.length) rows.push(cur);

  const legendTop = 4;
  const t = legendTop + Math.max(1, rows.length) * rowH + 2;
  const w = Math.max(10, cssW - l - r);
  const h = Math.max(10, cssH - t - b);
  const h0 = ch.axes.hinj_MJ_kg[0] ?? ch.hinj_MJ_kg[0] ?? 0;
  const h1 = ch.axes.hinj_MJ_kg[1] ?? ch.hinj_MJ_kg[ch.hinj_MJ_kg.length - 1] ?? 40;
  const toX = (hv: number) => l + ((hv - h0) / (h1 - h0)) * w;
  const toY = (x: number) => t + h - x * h;

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  rows.forEach((row, ri) => {
    let lx = l;
    const ly = legendTop + ri * rowH;
    for (const key of row) {
      const lab = moleLabel(key);
      ctx.strokeStyle = speciesColor(key);
      ctx.lineWidth = 1.6;
      ctx.setLineDash(compositionDash(key));
      ctx.beginPath();
      ctx.moveTo(lx, ly + 6);
      ctx.lineTo(lx + swatchW, ly + 6);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = speciesColor(key);
      ctx.fillText(lab, lx + swatchW + 4, ly);
      lx += itemW(key);
    }
  });

  ctx.fillStyle = "#101820";
  ctx.fillRect(l, t, w, h);
  ctx.strokeStyle = "rgba(180,210,230,0.12)";
  for (const xv of [0.25, 0.5, 0.75, 1]) {
    ctx.beginPath();
    ctx.moveTo(l, toY(xv));
    ctx.lineTo(l + w, toY(xv));
    ctx.stroke();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(l, t, w, h);
  ctx.clip();
  for (const k of ch.kinks) {
    ctx.strokeStyle = "rgba(245,215,110,0.4)";
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(toX(k.hinj_MJ_kg), t);
    ctx.lineTo(toX(k.hinj_MJ_kg), t + h);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const key of compositionDrawOrder(keys)) {
    const arr = ch.chamber.x[key];
    ctx.strokeStyle = speciesColor(key);
    ctx.lineWidth = 1.5;
    ctx.setLineDash(compositionDash(key));
    ctx.beginPath();
    ch.hinj_MJ_kg.forEach((hv, i) => {
      const x = toX(hv);
      const y = toY(arr[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.strokeStyle = "#2ee6c5";
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(toX(hinjMark), t);
  ctx.lineTo(toX(hinjMark), t + h);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(232,238,245,0.3)";
  ctx.strokeRect(l, t, w, h);
  ctx.fillStyle = "#8b9aab";
  ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const xv of [0, 0.5, 1]) ctx.fillText(String(xv), l - 6, toY(xv));
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("h_inj  [MJ/kg]", l + w / 2, cssH - 12);
}
