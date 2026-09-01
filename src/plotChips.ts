import type { PlumeMode } from "./types";

/** Plot kernel chips: Collisionless | Freeze. Auto stays on Setup only. */
export type PlotKernel = "collisionless" | "sudden_freeze";

/** Advanced Plume only. Thesis never shows plot physics chips. */
export function plotPhysicsVisible(advanced: boolean): boolean {
  return advanced;
}

/** Highlight matches Setup Physics (not Auto, not the last Auto-chosen kernel). */
export function kernelChipOn(plumeMode: PlumeMode, id: PlotKernel): boolean {
  return plumeMode === id;
}

/**
 * Gold Disk chip: live only after Freeze ran and shock_applied is true.
 * Collisionless requested → not applicable. Freeze veto (no shock_applied) → hidden.
 */
export function diskChipLive(opts: {
  advanced: boolean;
  plumeMode: PlumeMode;
  solveMode: string | null | undefined;
  shockApplied: boolean | undefined;
}): boolean {
  if (!opts.advanced) return false;
  if (opts.plumeMode === "collisionless") return false;
  if (opts.solveMode !== "sudden_freeze") return false;
  return opts.shockApplied === true;
}

/** Overlay strokes only. Off does not change the colormap. */
export function shockOverlayDrawn(diskLive: boolean, overlayOn: boolean): boolean {
  return diskLive && overlayOn;
}
