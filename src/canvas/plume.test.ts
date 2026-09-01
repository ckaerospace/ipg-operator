import { describe, expect, it } from "vitest";
import {
  fieldMaskAlpha,
  fieldRangeInView,
  fitView,
  MACH_DISK_LABEL,
  pinchPlumeView,
  panPlumeView,
  snapStationYCss,
  AXIS_SNAP_PX,
  SHOCK_OVERLAY,
  SHOCK_OVERLAY_CAPTION,
  shockFitExtents,
  shockOverlayPlan,
  squareWorld,
  wheelPlumeView,
  worldMap,
} from "./plume";
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

describe("fieldRangeInView", () => {
  it("uses the selected field only at nodes inside the millimetre window", () => {
    const nx = 11;
    const ny = 6;
    const pl = gridPlume({
      n_ratio: Array.from({ length: nx * ny }, () => 0.2),
      t_ratio: Array.from({ length: nx * ny }, (_, k) => {
        const i = k % nx;
        return (i / (nx - 1)) * 2;
      }),
    });
    const full = fieldRangeInView(pl, pl.t_ratio, { x0: 0, x1: 2, y0: -0.4, y1: 0.4 });
    const near = fieldRangeInView(pl, pl.t_ratio, { x0: 0, x1: 0.45, y0: -0.2, y1: 0.2 });
    expect(full).not.toBeNull();
    expect(near).not.toBeNull();
    expect(near![1]).toBeLessThan(full![1]);
    expect(near![1]).toBeLessThan(0.7);
  });

  it("does not pull a cell corner that sits outside the window", () => {
    const nx = 6;
    const ny = 3;
    const x = [0, 0.2, 0.4, 0.6, 0.8, 1];
    const y = [0, 0.1, 0.2];
    const n_ratio = Array.from({ length: nx * ny }, () => 0.2);
    const t_ratio = Array.from({ length: nx * ny }, (_, k) => ((k % nx) === 0 ? 1 : 0.15));
    const pl = gridPlume({ nx, ny, x, y, xmax_m: 1, ymax_m: 0.2, n_ratio, t_ratio });
    // Overlaps cell [0, 0.2] — bilinear in the clip, not the exit node at x=0 (t=1).
    const mid = fieldRangeInView(pl, pl.t_ratio, { x0: 0.15, x1: 0.35, y0: -0.15, y1: 0.15 });
    expect(mid).not.toBeNull();
    expect(mid![1]).toBeLessThan(0.5);
    expect(mid![1]).toBeGreaterThan(0.15);
    expect(mid![0]).toBeGreaterThanOrEqual(0.15);
  });
});

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
    expect(view.y0).toBeCloseTo(-view.y1, 8);
    expect(view.y1).toBeGreaterThan(0.2);
    expect(view.y1).toBeLessThanOrEqual(0.4);
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
    const view = { x0: 0, x1: 0.4, y0: -0.2, y1: 0.2 };
    const map = worldMap(390, 390, view);
    expect(map.plot.w).toBeCloseTo(map.plot.h, 5);
    const o = { x: map.toX(0), y: map.toY(0) };
    const dx = map.toX(0.05) - o.x;
    const dy = o.y - map.toY(0.05);
    expect(dx).toBeCloseTo(dy, 5);
    expect(map.toY(-0.05) - map.toY(0.05)).toBeCloseTo(2 * dy, 5);
    expect(map.toX(view.x1) - map.toX(view.x0)).toBeCloseTo(map.plot.w);
    expect(map.toY(view.y0) - map.toY(view.y1)).toBeCloseTo(map.plot.h);
  });

  it("letterboxes instead of stretching when the canvas is not square", () => {
    const view = { x0: 0, x1: 0.4, y0: -0.2, y1: 0.2 };
    const map = worldMap(390, 260, view);
    expect(map.plot.w).toBeCloseTo(map.plot.h, 5);
    const o = { x: map.toX(0), y: map.toY(0) };
    expect(map.toX(0.05) - o.x).toBeCloseTo(o.y - map.toY(0.05), 5);
  });

  it("stays isotropic on the phone figure (full width, fixed height)", () => {
    const view = { x0: 0, x1: 0.4, y0: -0.2, y1: 0.2 };
    const map = worldMap(390, 340, view);
    expect(map.plot.w).toBeCloseTo(map.plot.h, 5);
    const o = { x: map.toX(0), y: map.toY(0) };
    expect(map.toX(0.05) - o.x).toBeCloseTo(o.y - map.toY(0.05), 5);
    expect(map.plot.w + map.plot.l).toBeLessThanOrEqual(390);
    expect(map.plot.h).toBeLessThan(340);
  });

  it("does not frame shocks without shock_applied and x_mach_disk_m", () => {
    expect(shockFitExtents(gridPlume({ shock_applied: false }))).toBeNull();
    expect(shockFitExtents(gridPlume({ shock_applied: undefined, x_mach_disk_m: 0.433 }))).toBeNull();
    expect(shockFitExtents(gridPlume({ x_mach_disk_m: null }))).toBeNull();
    const clean = fitView(gridPlume({ shock_applied: false, mode: "collisionless" }), 84, 50, 50);
    expect(clean.x1).toBeGreaterThan(1);
    expect(clean.y0).toBeCloseTo(-clean.y1, 8);
  });

  it("strokes a gold Mach-disk chord distinct from a pale barrel outline", () => {
    expect(SHOCK_OVERLAY_CAPTION).toBe("shock overlay");
    expect(MACH_DISK_LABEL).toBe("Mach disk");
    expect(SHOCK_OVERLAY.diskWidth).toBeGreaterThan(SHOCK_OVERLAY.barrelWidth);
    expect(SHOCK_OVERLAY.diskStroke).toBe("#ffd000");
    expect(SHOCK_OVERLAY.barrelStroke.startsWith("rgba(")).toBe(true);
    expect(SHOCK_OVERLAY.barrelStroke).not.toContain("255, 244, 214");
    expect(SHOCK_OVERLAY.barrelDash[0]).toBeGreaterThan(0);
  });

  it("reserves pixel boxes beside the Mach-disk chord", () => {
    const pl = gridPlume();
    const view = fitView(pl, 84, 50, 50);
    const map = worldMap(390, 340, view);
    const plan = shockOverlayPlan(map, { cea: { pinj_Pa: 100, hinj_MJ_kg: 20, mdot_mg_s: 13, exit: { T0: 2000, U0: 3000, MW: 0.016, gamma: 1.4, R: 520, mole_fractions: {} } }, plume: pl });
    expect(plan).not.toBeNull();
    expect(plan!.boxes.length).toBeGreaterThanOrEqual(2);
    expect(plan!.X).toBeCloseTo(map.toX(0.433), 5);
  });
});

describe("square world window", () => {
  it("mirrors y about the centerline and keeps dx === dy", () => {
    expect(squareWorld({ x0: 0, x1: 0.5, y0: 0, y1: 0.12 })).toEqual({
      x0: 0,
      x1: 0.5,
      y0: -0.25,
      y1: 0.25,
    });
    expect(squareWorld({ x0: -0.1, x1: 0.4, y0: 0, y1: 0.2 })).toEqual({
      x0: -0.1,
      x1: 0.4,
      y0: -0.25,
      y1: 0.25,
    });
  });

  it("caps |y| to ymax_m when a square would exceed the API grid", () => {
    const capped = squareWorld({ x0: 0, x1: 0.8, y0: 0, y1: 0.2 }, 2, 0.4);
    expect(capped.y0).toBeCloseTo(-0.4, 8);
    expect(capped.y1).toBeCloseTo(0.4, 8);
    expect(capped.x1 - capped.x0).toBeCloseTo(capped.y1 - capped.y0, 8);
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
    expect(view.y0).toBeCloseTo(-view.y1, 8);
    expect(view.x1 - view.x0).toBeCloseTo(view.y1 - view.y0, 8);
    expect(view.y1).toBeGreaterThan(0.1);
  });
});

describe("pinchPlumeView", () => {
  it("zooms about the pinch midpoint and stays isotropic inside the fitted window", () => {
    const bounds = { x0: -0.1, x1: 0.9, y0: -0.5, y1: 0.5 };
    const start = { ...bounds };
    const map0 = worldMap(390, 390, start);
    const mid = { x: map0.toX(0.2), y: map0.toY(0.05) };
    const next = pinchPlumeView(start, 390, 390, mid, 80, mid, 160, bounds);
    expect(next.x1 - next.x0).toBeCloseTo(next.y1 - next.y0, 8);
    expect(next.x1 - next.x0).toBeLessThan(start.x1 - start.x0 - 1e-6);
    const map1 = worldMap(390, 390, next);
    expect(map1.fromX(mid.x)).toBeCloseTo(0.2, 3);
    expect(map1.fromY(mid.y)).toBeCloseTo(0.05, 3);
    expect(next.x0).toBeGreaterThanOrEqual(bounds.x0 - 1e-9);
    expect(next.x1).toBeLessThanOrEqual(bounds.x1 + 1e-9);
  });

  it("refuses to zoom out past the fitted field", () => {
    const bounds = { x0: -0.1, x1: 0.9, y0: -0.5, y1: 0.5 };
    const mid = { x: 195, y: 195 };
    const out = pinchPlumeView(bounds, 390, 390, mid, 160, mid, 40, bounds);
    expect(out.x1 - out.x0).toBeCloseTo(1);
    expect(out.x0).toBeCloseTo(bounds.x0);
  });
});

describe("station millimetres stay put under zoom and pan", () => {
  const bounds = { x0: -0.1, x1: 0.9, y0: -0.5, y1: 0.5 };

  it("keeps a station under the wheel cursor when zooming about it", () => {
    const start = { ...bounds };
    const station = { x: 0.2, y: 0.05 };
    const map0 = worldMap(390, 390, start);
    const css = { x: map0.toX(station.x), y: map0.toY(station.y) };
    const next = wheelPlumeView(start, 390, 390, css, 2, bounds);
    const map1 = worldMap(390, 390, next);
    expect(map1.fromX(css.x)).toBeCloseTo(station.x, 3);
    expect(map1.fromY(css.y)).toBeCloseTo(station.y, 3);
    expect(map1.toX(station.x)).toBeCloseTo(css.x, 1);
    expect(map1.toY(station.y)).toBeCloseTo(css.y, 1);
  });

  it("slides the window so the grabbed point stays under the drag", () => {
    const view = { x0: 0.1, x1: 0.5, y0: -0.2, y1: 0.2 };
    const map0 = worldMap(390, 390, view);
    const from = { x: 200, y: 200 };
    const to = { x: 230, y: 180 };
    const world = { x: map0.fromX(from.x), y: map0.fromY(from.y) };
    const next = panPlumeView(view, 390, 390, from, to, bounds);
    const map1 = worldMap(390, 390, next);
    expect(map1.fromX(to.x)).toBeCloseTo(world.x, 5);
    expect(map1.fromY(to.y)).toBeCloseTo(world.y, 5);
    expect(next.x1 - next.x0).toBeCloseTo(view.x1 - view.x0);
  });

  it("keeps the pinch centroid on the same millimetre when the midpoint moves", () => {
    const start = { x0: 0, x1: 1, y0: -0.5, y1: 0.5 };
    const map0 = worldMap(390, 390, start);
    const station = { x: 0.2, y: 0.05 };
    const mid0 = { x: map0.toX(station.x), y: map0.toY(station.y) };
    const mid1 = { x: mid0.x + 24, y: mid0.y - 18 };
    const next = pinchPlumeView(start, 390, 390, mid0, 80, mid1, 160, bounds);
    const map1 = worldMap(390, 390, next);
    expect(map1.fromX(mid1.x)).toBeCloseTo(station.x, 3);
    expect(map1.fromY(mid1.y)).toBeCloseTo(station.y, 3);
    expect(map1.toX(station.x)).toBeCloseTo(mid1.x, 1);
    expect(map1.toY(station.y)).toBeCloseTo(mid1.y, 1);
  });
});

describe("snapStationYCss", () => {
  it("snaps to y = 0 inside a 12 px band and leaves farther picks free", () => {
    expect(snapStationYCss(100, 100, 0.04)).toBe(0);
    expect(snapStationYCss(100 + AXIS_SNAP_PX, 100, 0.04)).toBe(0);
    expect(snapStationYCss(100 - AXIS_SNAP_PX, 100, -0.03)).toBe(0);
    expect(snapStationYCss(100 + AXIS_SNAP_PX + 0.5, 100, 0.04)).toBeCloseTo(0.04);
    expect(snapStationYCss(80, 100, -0.08)).toBeCloseTo(-0.08);
  });
});
