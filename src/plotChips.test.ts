import { describe, expect, it } from "vitest";
import { diskChipLive, kernelChipOn, plotPhysicsVisible, shockOverlayDrawn } from "./plotChips";

describe("plot physics chips", () => {
  it("are Advanced-only", () => {
    expect(plotPhysicsVisible(true)).toBe(true);
    expect(plotPhysicsVisible(false)).toBe(false);
  });

  it("highlight Collisionless | Freeze from Setup plumeMode; Auto lights neither", () => {
    expect(kernelChipOn("collisionless", "collisionless")).toBe(true);
    expect(kernelChipOn("collisionless", "sudden_freeze")).toBe(false);
    expect(kernelChipOn("sudden_freeze", "sudden_freeze")).toBe(true);
    expect(kernelChipOn("sudden_freeze", "collisionless")).toBe(false);
    expect(kernelChipOn("auto", "collisionless")).toBe(false);
    expect(kernelChipOn("auto", "sudden_freeze")).toBe(false);
  });

  it("hides Disk on Thesis, Collisionless, and when Freeze did not apply a shock", () => {
    const freezeShock = {
      advanced: true,
      plumeMode: "sudden_freeze" as const,
      solveMode: "sudden_freeze",
      shockApplied: true,
    };
    expect(diskChipLive(freezeShock)).toBe(true);
    expect(diskChipLive({ ...freezeShock, advanced: false })).toBe(false);
    expect(diskChipLive({ ...freezeShock, plumeMode: "collisionless", solveMode: "collisionless" })).toBe(false);
    expect(
      diskChipLive({
        ...freezeShock,
        plumeMode: "collisionless",
        solveMode: "sudden_freeze",
      }),
    ).toBe(false);
    expect(diskChipLive({ ...freezeShock, shockApplied: false })).toBe(false);
    expect(diskChipLive({ ...freezeShock, shockApplied: undefined })).toBe(false);
    expect(diskChipLive({ ...freezeShock, solveMode: "collisionless" })).toBe(false);
  });

  it("keeps Disk live when Auto requested Freeze and shock_applied", () => {
    expect(
      diskChipLive({
        advanced: true,
        plumeMode: "auto",
        solveMode: "sudden_freeze",
        shockApplied: true,
      }),
    ).toBe(true);
  });

  it("hides overlay strokes when Disk is off without dropping colormap state", () => {
    expect(shockOverlayDrawn(true, true)).toBe(true);
    expect(shockOverlayDrawn(true, false)).toBe(false);
    expect(shockOverlayDrawn(false, true)).toBe(false);
  });
});
