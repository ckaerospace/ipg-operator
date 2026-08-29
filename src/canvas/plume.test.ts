import { describe, expect, it } from "vitest";
import { fitView, shockFitExtents, worldMap } from "./plume";
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
    expect(view.y1).toBeGreaterThan(0.05);
    expect(view.y1).toBeLessThan(0.25);
  });

  it("puts the Mach disk on a readable fraction of a phone-width canvas", () => {
    const view = fitView(gridPlume(), 84, 50, 50);
    const map = worldMap(390, 260, view);
    const diskPx = map.toX(0.433);
    const left = map.toX(0);
    expect(diskPx - left).toBeGreaterThan(0.55 * map.plot.w);
    expect(map.plot.w).toBeGreaterThan(200);
  });

  it("does not frame shocks without shock_applied and x_mach_disk_m", () => {
    expect(shockFitExtents(gridPlume({ shock_applied: false }))).toBeNull();
    expect(shockFitExtents(gridPlume({ shock_applied: undefined, x_mach_disk_m: 0.433 }))).toBeNull();
    expect(shockFitExtents(gridPlume({ x_mach_disk_m: null }))).toBeNull();
    const clean = fitView(gridPlume({ shock_applied: false, mode: "collisionless" }), 84, 50, 50);
    expect(clean.x1).toBeGreaterThan(1);
  });
});
