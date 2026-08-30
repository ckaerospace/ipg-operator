import { describe, expect, it } from "vitest";
import {
  clampIsoView,
  clampRectView,
  isoMinSpan,
  pinchFocusShift,
  viewsClose,
  zoomIsoAbout,
  zoomRectAbout,
} from "./viewZoom";

const bounds = { x0: -0.1, x1: 0.9, y0: -0.5, y1: 0.5 };

describe("zoomIsoAbout", () => {
  it("keeps the focus at the same fraction of the square window", () => {
    const view = { x0: 0, x1: 1, y0: -0.5, y1: 0.5 };
    const focus = { x: 0.25, y: 0 };
    const z = zoomIsoAbout(view, focus, 2);
    expect(z.x1 - z.x0).toBeCloseTo(0.5);
    expect(z.y1 - z.y0).toBeCloseTo(0.5);
    expect((focus.x - z.x0) / (z.x1 - z.x0)).toBeCloseTo(0.25);
    expect((focus.y - z.y0) / (z.y1 - z.y0)).toBeCloseTo(0.5);
  });
});

describe("clampIsoView", () => {
  it("does not zoom out past the fitted bounds", () => {
    const huge = { x0: -10, x1: 10, y0: -10, y1: 10 };
    const c = clampIsoView(huge, bounds, 0.02);
    expect(c.x1 - c.x0).toBeCloseTo(1);
    expect(c.y1 - c.y0).toBeCloseTo(1);
    expect(c.x0).toBeCloseTo(bounds.x0);
    expect(c.y0).toBeCloseTo(bounds.y0);
  });

  it("does not shrink below minSpan", () => {
    const tiny = { x0: 0.2, x1: 0.201, y0: 0, y1: 0.001 };
    const c = clampIsoView(tiny, bounds, 0.05);
    expect(c.x1 - c.x0).toBeCloseTo(0.05);
    expect(c.y1 - c.y0).toBeCloseTo(0.05);
  });

  it("stays inside bounds when panned", () => {
    const v = { x0: 0.8, x1: 1.1, y0: 0.4, y1: 0.7 };
    const c = clampIsoView(v, bounds, 0.05);
    expect(c.x1).toBeLessThanOrEqual(bounds.x1 + 1e-12);
    expect(c.y1).toBeLessThanOrEqual(bounds.y1 + 1e-12);
    expect(c.x0).toBeGreaterThanOrEqual(bounds.x0 - 1e-12);
  });
});

describe("isoMinSpan", () => {
  it("is at least 8 mm", () => {
    expect(isoMinSpan({ x0: 0, x1: 0.1, y0: -0.05, y1: 0.05 })).toBe(0.008);
  });
});

describe("rect zoom", () => {
  it("scales both axes about the focus", () => {
    const view = { x0: 0, x1: 200, y0: 0, y1: 40 };
    const z = zoomRectAbout(view, { x: 50, y: 10 }, 2);
    expect(z.x1 - z.x0).toBeCloseTo(100);
    expect(z.y1 - z.y0).toBeCloseTo(20);
    expect((50 - z.x0) / (z.x1 - z.x0)).toBeCloseTo(50 / 200);
  });

  it("clamps a map window inside the axes", () => {
    const b = { x0: 10, x1: 250, y0: 5, y1: 40 };
    const c = clampRectView({ x0: 0, x1: 400, y0: 0, y1: 80 }, b, 4, 1);
    expect(c.x0).toBeCloseTo(10);
    expect(c.x1).toBeCloseTo(250);
    expect(c.y0).toBeCloseTo(5);
    expect(c.y1).toBeCloseTo(40);
  });
});

describe("pinchFocusShift", () => {
  it("slides the window so the focus sits under the new midpoint", () => {
    const z = { x0: 0, x1: 0.5, y0: -0.25, y1: 0.25 };
    const shifted = pinchFocusShift(z, { x: 0.2, y: 0 }, { x: 0.3, y: 0.05 });
    expect(shifted.x0).toBeCloseTo(-0.1);
    expect(shifted.y0).toBeCloseTo(-0.3);
  });
});

describe("viewsClose", () => {
  it("detects a reset-equal window", () => {
    expect(viewsClose(bounds, { ...bounds })).toBe(true);
    expect(viewsClose(bounds, { ...bounds, x1: 0.91 })).toBe(false);
  });
});
