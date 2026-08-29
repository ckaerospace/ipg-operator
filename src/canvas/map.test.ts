import { describe, expect, it } from "vitest";
import { compositionDash, compositionDrawOrder, isElectron, isPositiveIon } from "./map";

describe("composition stroke order", () => {
  it("draws neutrals, then cations, then dashed e- last", () => {
    expect(compositionDrawOrder(["e-", "O+", "O", "O2"])).toEqual(["O", "O2", "O+", "e-"]);
    expect(compositionDrawOrder(["N+", "e-", "N2", "Ar+", "Ar"])).toEqual(["N2", "Ar", "N+", "Ar+", "e-"]);
  });

  it("keeps O+ and paints dashed e- on top so red shows in the gaps", () => {
    const keys = compositionDrawOrder(["O2", "O", "e-", "O+"]);
    expect(keys).toContain("O+");
    expect(keys).toContain("e-");
    expect(keys.indexOf("e-")).toBeGreaterThan(keys.indexOf("O+"));
    expect(keys[keys.length - 1]).toBe("e-");
  });

  it("dashes only e-; ions stay solid", () => {
    expect(isElectron("e-")).toBe(true);
    expect(isPositiveIon("O+")).toBe(true);
    expect(isPositiveIon("N+")).toBe(true);
    expect(isPositiveIon("Ar+")).toBe(true);
    expect(isPositiveIon("C+")).toBe(true);
    expect(isPositiveIon("O2+")).toBe(true);
    expect(isPositiveIon("O")).toBe(false);
    expect(compositionDash("e-")).toEqual([4, 3]);
    expect(compositionDash("O+")).toEqual([]);
    expect(compositionDash("O")).toEqual([]);
  });
});
