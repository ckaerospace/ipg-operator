import { describe, expect, it } from "vitest";
import { mapCharacteristicsKey } from "./mapCache";

const base = {
  facility: "IPG6-S",
  mixKey: "O2",
  d_c_mm: 37,
  d_t_mm: 20,
  d_e_mm: 40,
  mdot_mg_s: 13,
};

describe("mapCharacteristicsKey", () => {
  it("does not include pinj — pinj only moves the operating point", () => {
    const a = mapCharacteristicsKey(base);
    expect(a).not.toMatch(/pinj/i);
    expect(a).not.toContain("|100|");
    expect(a).toContain("m13.000");
  });

  it("rebuilds when ṁ changes, not when only pinj would have changed", () => {
    const at13 = mapCharacteristicsKey(base);
    const still13 = mapCharacteristicsKey({ ...base, mdot_mg_s: 13 });
    const at20 = mapCharacteristicsKey({ ...base, mdot_mg_s: 20 });
    expect(at13).toBe(still13);
    expect(at20).not.toBe(at13);
  });

  it("changes with facility, mix, or nozzle", () => {
    const a = mapCharacteristicsKey(base);
    expect(mapCharacteristicsKey({ ...base, facility: "IPG4" })).not.toBe(a);
    expect(mapCharacteristicsKey({ ...base, mixKey: "N2" })).not.toBe(a);
    expect(mapCharacteristicsKey({ ...base, d_e_mm: 50 })).not.toBe(a);
  });
});
