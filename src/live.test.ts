import { afterEach, describe, expect, it } from "vitest";
import { emptyCustomMix } from "./mixture";
import {
  assignFromMode,
  customMixFromHeMole,
  heMixLabel,
  heMoleFrac,
  heO2MixOpen,
  LIVE_CONFIRM_KEY,
  LIVE_SOLVE_DEBOUNCE_MS,
  liveChromeVisible,
  modeFromAssign,
  readLiveConfirmSeen,
  solveStillCurrent,
  writeLiveConfirmSeen,
} from "./live";

describe("live chrome gating", () => {
  it("is beta-only", () => {
    expect(liveChromeVisible(true)).toBe(true);
    expect(liveChromeVisible(false)).toBe(false);
  });

  it("debounces in the 300–500 ms band", () => {
    expect(LIVE_SOLVE_DEBOUNCE_MS).toBeGreaterThanOrEqual(300);
    expect(LIVE_SOLVE_DEBOUNCE_MS).toBeLessThanOrEqual(500);
  });
});

describe("He–O2 mix", () => {
  it("opens for named HeO2 and He/O2-only custom, not other gases", () => {
    const empty = emptyCustomMix();
    expect(heO2MixOpen("HeO2", empty)).toBe(true);
    expect(heO2MixOpen("O2", empty)).toBe(false);
    expect(heO2MixOpen("custom", { ...empty, He: 0.7, O2: 0.3 })).toBe(true);
    expect(heO2MixOpen("custom", { ...empty, He: 1 })).toBe(true);
    expect(heO2MixOpen("custom", { ...empty, O2: 1 })).toBe(true);
    expect(heO2MixOpen("custom", empty)).toBe(false);
    expect(heO2MixOpen("custom", { ...empty, He: 0.5, Ar: 0.5 })).toBe(false);
    expect(heO2MixOpen("Air", empty)).toBe(false);
  });

  it("reads 70/30 mole from the named chip and writes mole fractions for the API", () => {
    expect(heMoleFrac("HeO2", emptyCustomMix())).toBeCloseTo(0.7);
    expect(heMixLabel(0.7)).toBe("70/30");
    const mix = customMixFromHeMole(0.4);
    expect(mix.He).toBeCloseTo(0.4);
    expect(mix.O2).toBeCloseTo(0.6);
    expect(mix.N2).toBe(0);
    expect(heMoleFrac("custom", mix)).toBeCloseTo(0.4);
    expect(customMixFromHeMole(1).O2).toBe(0);
    expect(customMixFromHeMole(0).He).toBe(0);
  });
});

describe("hinj | ṁ assign", () => {
  it("maps the exclusive pair onto Setup solve modes", () => {
    expect(assignFromMode("enthalpy")).toBe("hinj");
    expect(assignFromMode("generator")).toBe("mdot");
    expect(modeFromAssign("hinj")).toBe("enthalpy");
    expect(modeFromAssign("mdot")).toBe("generator");
  });
});

describe("in-flight cancel", () => {
  it("drops a finished solve when a newer generation is already current", () => {
    expect(solveStillCurrent(1, 1)).toBe(true);
    expect(solveStillCurrent(1, 2)).toBe(false);
  });
});

describe("one-shot confirm", () => {
  afterEach(() => {
    try {
      localStorage.removeItem(LIVE_CONFIRM_KEY);
    } catch {
      /* jsdom-less */
    }
  });

  it("remembers Got it in localStorage", () => {
    if (typeof localStorage === "undefined") return;
    expect(readLiveConfirmSeen()).toBe(false);
    writeLiveConfirmSeen();
    expect(readLiveConfirmSeen()).toBe(true);
    expect(localStorage.getItem(LIVE_CONFIRM_KEY)).toBe("1");
  });
});
