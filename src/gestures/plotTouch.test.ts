import { describe, expect, it } from "vitest";
import { PlotTouch, pairStats, wheelScale } from "./plotTouch";

describe("PlotTouch", () => {
  it("treats one finger as pick and two as pinch", () => {
    const g = new PlotTouch();
    expect(g.down(1, { x: 10, y: 10 })).toBe("one");
    expect(g.move(1, { x: 12, y: 11 })).toBe("one");
    expect(g.down(2, { x: 40, y: 18 })).toBe("pinch");
    expect(g.pinchOrigin).not.toBeNull();
    expect(g.move(2, { x: 48, y: 20 })).toBe("pinch");
    g.up(2, { x: 48, y: 20 });
    expect(g.move(1, { x: 14, y: 12 })).toBe("none");
    g.up(1, { x: 14, y: 12 });
  });

  it("double-tap is a reset, not a pick", () => {
    const g = new PlotTouch();
    expect(g.down(1, { x: 20, y: 20 }, 1000)).toBe("one");
    g.up(1, { x: 20, y: 20 }, 1080);
    expect(g.down(2, { x: 22, y: 21 }, 1280)).toBe("double");
  });
});

describe("pairStats / wheelScale", () => {
  it("reports the midpoint and a positive distance", () => {
    const s = pairStats({ x: 0, y: 0 }, { x: 6, y: 8 });
    expect(s.mid).toEqual({ x: 3, y: 4 });
    expect(s.dist).toBeCloseTo(10);
  });

  it("wheel down zooms out", () => {
    expect(wheelScale(100)).toBeLessThan(1);
    expect(wheelScale(-100)).toBeGreaterThan(1);
  });
});
