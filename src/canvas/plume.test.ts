import { describe, expect, it } from "vitest";
import { fieldMaskAlpha, fitView, shockFitExtents, squareWorld, worldMap } from "./plume";
import type { SolveResponse } from "../types";

function gridPlume(over: Partial<SolveResponse["plume"]> = {}): SolveResponse["plume"] {
  const nx = 11;
  const ny = 6;
  const xmax = 2;
  const ymax = 0.4;
  const x = Array.from({ length: nx }, (_, i) => (i / (nx - 1)) * xmax);
  const y = Array.from({ length: ny }, (_, j) => (j / (ny - 1)) * ymax);
  const n_ratio = Array.from({ length: nx * ny }, () => 0.2);
  const barrel = Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    return [0.45 * t, 0.08 * (0.25 + 0.75 * t)];
  });
  return {
    T0: 2000,
    U0: 3000,
    n0: 1e20,
    H: 0.025,
    mode: "sudden_freeze",
    kn_gll_exit: 0.01,
    xmax_m: xmax,
    ymax_m: ymax,
    nx,
    ny,
    x,
    y,
    n_ratio,
    u: n_ratio,
    v: n_ratio,
    t_ratio: n_ratio,
    speed: n_ratio,
    mach: n_ratio,
    e_kin_eV: n_ratio,
    e_O_eV: n_ratio,
    h_tot_MJ_kg: n_ratio,
    h_tot_ratio: n_ratio,
    shock_applied: true,
    x_mach_disk_m: 0.433,
    barrel_xy: barrel,
    ...over,
  };
}

describe("field map mask", () => {
  it("keeps vacuum and NaN fully dark", () => {
    expect(fieldMaskAlpha(0)).toBe(0);
    expect(fieldMaskAlpha(1e-4)).toBe(0);
    expect(fieldMaskAlpha(Number.NaN)).toBe(0);
  });

  it("fades in before n/n0 is solid and is opaque in the jet core", () => {
    expect(fieldMaskAlpha(8e-4)).toBe(0);
    expect(fieldMaskAlpha(0.01)).toBeGreaterThan(0);
    expect(fieldMaskAlpha(0.01)).toBeLessThan(1);
    expect(fieldMaskAlpha(0.02)).toBe(1);
    expect(fieldMaskAlpha(1)).toBe(1);
  });
});

describe("shock overlay framing", () => {
  it("frames the barrel at ~1.2× Mach-disk station, not xmax_m=2 m", () => {
    const pl = gridPlume();
    const ext = shockFitExtents(pl);
    expect(ext).not.toBeNull();
    expect(ext!.x1).toBeCloseTo(0.433 * 1.2, 6);
    expect(ext!.y1).toBeGreaterThan(0.05);
    expect(ext!.y1).toBeLessThan(0.2);

    const view = fitView(pl, 84, 50, 50);
    expect(view.x0).toBeLessThan(0);
    expect(view.x1).toBeCloseTo(0.433 * 1.2, 5);
    expect(view.x1).toBeLessThan(0.8);
    expect(view.y0).toBe(0);
    // Shock-fit y is ~0.1; square would grow y to match x, then ymax_m = 0.4 caps it.
    expect(view.y1).toBeCloseTo(0.4, 6);
  });

  it("puts the Mach disk on a readable fraction of a phone-width square canvas", () => {
    const view = fitView(gridPlume(), 84, 50, 50);
    const map = worldMap(390, 390, view);
    const diskPx = map.toX(0.433);
    const left = map.toX(0);
    expect(diskPx - left).toBeGreaterThan(0.55 * map.plot.w);
    expect(map.plot.w).toBeGreaterThan(200);
  });

  it("maps millimetres isotropically and draws a square plot in a square canvas", () => {
    const view = { x0: 0, x1: 0.4, y0: 0, y1: 0.4 };
    const map = worldMap(390, 390, view);
    expect(map.plot.w).toBeCloseTo(map.plot.h, 5);
    const o = { x: map.toX(0), y: map.toY(0) };
    const dx = map.toX(0.05) - o.x;
    const dy = o.y - map.toY(0.05);
    expect(dx).toBeCloseTo(dy, 5);
    expect(map.toX(view.x1) - map.toX(view.x0)).toBeCloseTo(map.plot.w);
    expect(map.toY(view.y0) - map.toY(view.y1)).toBeCloseTo(map.plot.h);
  });

  it("letterboxes instead of stretching when the canvas is not square", () => {
    const view = { x0: 0, x1: 0.4, y0: 0, y1: 0.4 };
    const map = worldMap(390, 260, view);
    expect(map.plot.w).toBeCloseTo(map.plot.h, 5);
    const o = { x: map.toX(0), y: map.toY(0) };
    expect(map.toX(0.05) - o.x).toBeCloseTo(o.y - map.toY(0.05), 5);
  });

  it("does not frame shocks without shock_applied and x_mach_disk_m", () => {
    expect(shockFitExtents(gridPlume({ shock_applied: false }))).toBeNull();
    expect(shockFitExtents(gridPlume({ shock_applied: undefined, x_mach_disk_m: 0.433 }))).toBeNull();
    expect(shockFitExtents(gridPlume({ x_mach_disk_m: null }))).toBeNull();
    const clean = fitView(gridPlume({ shock_applied: false, mode: "collisionless" }), 84, 50, 50);
    expect(clean.x1).toBeGreaterThan(1);
  });
});

describe("square world window", () => {
  it("expands the shorter span and keeps y0 = 0", () => {
    expect(squareWorld({ x0: 0, x1: 0.5, y0: 0, y1: 0.12 })).toEqual({
      x0: 0,
      x1: 0.5,
      y0: 0,
      y1: 0.5,
    });
    expect(squareWorld({ x0: -0.1, x1: 0.4, y0: 0, y1: 0.2 })).toEqual({
      x0: -0.1,
      x1: 0.4,
      y0: 0,
      y1: 0.5,
    });
  });

  it("caps to the API grid when a square would exceed xmax_m / ymax_m", () => {
    const capped = squareWorld({ x0: 0, x1: 0.8, y0: 0, y1: 0.2 }, 2, 0.4);
    expect(capped.y0).toBe(0);
    expect(capped.y1).toBeCloseTo(0.4, 8);
    expect(capped.x1).toBeCloseTo(0.8, 8);
  });

  it("squares a shallow collisionless envelope when ymax_m allows", () => {
    const nx = 8;
    const ny = 8;
    const xmax = 0.4;
    const ymax = 1.2;
    const x = Array.from({ length: nx }, (_, i) => (i / (nx - 1)) * xmax);
    const y = Array.from({ length: ny }, (_, j) => (j / (ny - 1)) * ymax);
    const n_ratio = Array.from({ length: nx * ny }, (_, k) => {
      const i = k % nx;
      const j = Math.floor(k / nx);
      return x[i] <= 0.15 && y[j] <= 0.08 ? 0.2 : 0;
    });
    const view = fitView(
      gridPlume({
        shock_applied: false,
        mode: "collisionless",
        xmax_m: xmax,
        ymax_m: ymax,
        nx,
        ny,
        x,
        y,
        n_ratio,
      }),
      84,
      50,
      50,
    );
    expect(view.y0).toBe(0);
    expect(view.x1 - view.x0).toBeCloseTo(view.y1 - view.y0, 8);
    expect(view.y1).toBeGreaterThan(0.2);
  });
});
