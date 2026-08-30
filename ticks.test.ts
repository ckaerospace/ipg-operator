import { describe, expect, it } from "vitest";
import { axisTicks, fmtTickMm, fmtTickNum } from "./ticks";

describe("axisTicks", () => {
  it("uses 1–2–5 spacing inside the window", () => {
    const t = axisTicks(0, 1, 5);
    expect(t.length).toBeGreaterThanOrEqual(4);
    expect(t.length).toBeLessThanOrEqual(8);
    expect(t[0]).toBeGreaterThanOrEqual(0);
    expect(t[t.length - 1]).toBeLessThanOrEqual(1);
    const step = t[1] - t[0];
    const n = step / 10 ** Math.floor(Math.log10(step));
    expect([1, 2, 5, 10].some((k) => Math.abs(n - k) < 1e-8)).toBe(true);
  });

  it("fits a zoomed millimetre window without raw 441-style spacing", () => {
    const t = axisTicks(0.4, 0.52, 5);
    expect(t.every((v) => v >= 0.4 - 1e-9 && v <= 0.52 + 1e-9)).toBe(true);
    const step = t[1] - t[0];
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThanOrEqual(0.05);
  });
});

describe("tick format", () => {
  it("shows integer mm when the step is a millimetre or more", () => {
    expect(fmtTickMm(0.4417, 0.05)).toBe("442");
    expect(fmtTickMm(-0.05, 0.05)).toBe("-50");
  });

  it("keeps a decimal when zoomed in", () => {
    expect(fmtTickMm(0.441, 0.0002)).toMatch(/441/);
    expect(fmtTickNum(23.4, 0.2)).toBe("23.4");
  });
});
