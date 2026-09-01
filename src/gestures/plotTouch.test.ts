import { describe, expect, it } from "vitest";
import { PAN_SLOP_PX, PlotTouch, pairStats, wheelScale } from "./plotTouch";

describe("PlotTouch", () => {
  it("treats one finger as pick and two as pinch", () => {
    const g = new PlotTouch();
    expect(g.down(1, { x: 10, y: 10 })).toBe("one");
    expect(g.move(1, { x: 12, y: 11 })).toBe("one");
    expect(g.down(2, { x: 40, y: 18 })).toBe("pinch");
    expect(g.pinchOrigin).not.toBeNull();
    expect(g.move(2, { x: 48, y: 20 })).toBe("pinch");
    expect(g.up(2, { x: 48, y: 20 })).toBe("end");
    expect(g.move(1, { x: 14, y: 12 })).toBe("none");
    expect(g.up(1, { x: 14, y: 12 })).toBe("end");
  });

  it("keeps a short move as a tap and a longer move as a drag", () => {
    const g = new PlotTouch();
    expect(g.down(1, { x: 20, y: 20 })).toBe("one");
    expect(g.move(1, { x: 20 + PAN_SLOP_PX - 1, y: 20 })).toBe("one");
    expect(g.up(1, { x: 20 + PAN_SLOP_PX - 1, y: 20 })).toBe("tap");

    const d = new PlotTouch();
    expect(d.down(1, { x: 20, y: 20 })).toBe("one");
    expect(d.move(1, { x: 20 + PAN_SLOP_PX, y: 20 })).toBe("drag");
    expect(d.up(1, { x: 40, y: 20 })).toBe("end");
  });

  it("treats a second tap as another tap, not a reset", () => {
    const g = new PlotTouch();
    expect(g.down(1, { x: 20, y: 20 })).toBe("one");
    expect(g.up(1, { x: 20, y: 20 })).toBe("tap");
    expect(g.down(2, { x: 22, y: 21 })).toBe("one");
    expect(g.up(2, { x: 22, y: 21 })).toBe("tap");
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
