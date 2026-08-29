import { describe, expect, it } from "vitest";
import {
  fieldIsolines,
  fmtIsoValue,
  niceIsoLevels,
  pickIsoLabels,
  stitchIso,
} from "./isolines";

function rampX(nx = 9, ny = 5, xmax = 4, ymax = 1) {
  const xs = Array.from({ length: nx }, (_, i) => (i / (nx - 1)) * xmax);
  const ys = Array.from({ length: ny }, (_, j) => (j / (ny - 1)) * ymax);
  const field = Array.from({ length: nx * ny }, (_, k) => xs[k % nx]);
  const mask = Array.from({ length: nx * ny }, () => 0.2);
  return { xs, ys, field, nx, ny, mask };
}

describe("niceIsoLevels", () => {
  it("returns 4–6 interior ticks with 1–2–5 spacing", () => {
    const a = niceIsoLevels(0, 1);
    expect(a.length).toBeGreaterThanOrEqual(4);
    expect(a.length).toBeLessThanOrEqual(6);
    expect(a.every((v) => v > 0 && v < 1)).toBe(true);
    expect(a).toEqual([...a].sort((x, y) => x - y));
    expect(a).toContain(0.2);
    expect(a).toContain(0.8);

    const b = niceIsoLevels(500, 3460);
    expect(b.length).toBeGreaterThanOrEqual(4);
    expect(b.length).toBeLessThanOrEqual(6);
    expect(b.every((v) => v > 500 && v < 3460)).toBe(true);
    expect(b.every((v) => Math.abs(v / 500 - Math.round(v / 500)) < 1e-8)).toBe(true);
  });

  it("does not emit ugly raw values like 6.173", () => {
    const levels = niceIsoLevels(1.04, 6.173);
    expect(levels.length).toBeGreaterThanOrEqual(3);
    for (const v of levels) {
      expect(fmtIsoValue(v)).not.toMatch(/6\.173/);
      expect(String(v)).not.toMatch(/173/);
    }
  });

  it("is empty when the range is degenerate", () => {
    expect(niceIsoLevels(1, 1)).toEqual([]);
    expect(niceIsoLevels(2, 1)).toEqual([]);
  });
});

describe("marching squares", () => {
  it("puts a vertical isoline on a linear-in-x field", () => {
    const g = rampX();
    const segs = fieldIsolines(g.xs, g.ys, g.field, g.nx, g.ny, [2], g.mask);
    expect(segs.length).toBeGreaterThan(2);
    for (const s of segs) {
      expect(s.x0).toBeCloseTo(2, 8);
      expect(s.x1).toBeCloseTo(2, 8);
      expect(s.level).toBe(2);
    }
  });

  it("puts a horizontal isoline on a linear-in-y field", () => {
    const nx = 6;
    const ny = 7;
    const xs = Array.from({ length: nx }, (_, i) => i);
    const ys = Array.from({ length: ny }, (_, j) => j);
    const field = Array.from({ length: nx * ny }, (_, k) => ys[Math.floor(k / nx)]);
    const mask = field.map(() => 1);
    const segs = fieldIsolines(xs, ys, field, nx, ny, [3], mask);
    expect(segs.length).toBeGreaterThan(2);
    for (const s of segs) {
      expect(s.y0).toBeCloseTo(3, 8);
      expect(s.y1).toBeCloseTo(3, 8);
    }
  });

  it("skips vacuum cells", () => {
    const g = rampX();
    const mask = g.mask.map(() => 0);
    expect(fieldIsolines(g.xs, g.ys, g.field, g.nx, g.ny, [2], mask)).toEqual([]);
  });

  it("stitches a vertical isoline into one chain", () => {
    const g = rampX();
    const chains = stitchIso(fieldIsolines(g.xs, g.ys, g.field, g.nx, g.ny, [2], g.mask));
    expect(chains.length).toBe(1);
    expect(chains[0].pts.length).toBeGreaterThan(2);
    expect(chains[0].pts.every((p) => Math.abs(p.x - 2) < 1e-8)).toBe(true);
  });
});

describe("isoline labels", () => {
  it("places 2–4 labels off the nozzle and not stacked", () => {
    const g = rampX(11, 7, 4, 2);
    const levels = [1, 2, 3];
    const segs = fieldIsolines(g.xs, g.ys, g.field, g.nx, g.ny, levels, g.mask);
    const labels = pickIsoLabels(stitchIso(segs), levels, {
      xMin: 0.3,
      yMin: 0.15,
      xMax: 3.7,
      yMax: 1.8,
      toPx: (x, y) => ({ x: x * 80, y: 200 - y * 80 }),
    });
    expect(labels.length).toBeGreaterThanOrEqual(2);
    expect(labels.length).toBeLessThanOrEqual(4);
    expect(labels.every((l) => l.x >= 0.3 && l.y >= 0.15)).toBe(true);
    const texts = new Set(labels.map((l) => l.text));
    expect(texts.size).toBe(labels.length);
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const dx = (labels[i].x - labels[j].x) * 80;
        const dy = (labels[i].y - labels[j].y) * 80;
        expect(Math.hypot(dx, dy)).toBeGreaterThan(12);
      }
    }
  });
});
