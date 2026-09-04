import { describe, expect, it } from "vitest";
import { encodeShareSearch, hydrateShareObject, parseShareSearch, shareUrl } from "./shareUrl";
import type { ShareFields } from "./shareUrl";

const fields: ShareFields = {
  layer: "thesis",
  facility: "IPG4",
  gas: "CO2",
  mode: "generator",
  pinj: 2900,
  mdot_mg_s: 2200,
  hinj: 17.4,
  pTank: 10,
  plumeMode: "auto",
  object: "disk",
  diskX_m: 0.12,
  diskR_mm: 20,
};

describe("share URL", () => {
  it("encodes the operator point without auto-run", () => {
    const q = encodeShareSearch(fields);
    expect(q).toContain("layer=thesis");
    expect(q).toContain("facility=IPG4");
    expect(q).toContain("gas=CO2");
    expect(q).toContain("mode=generator");
    expect(q).toContain("pinj=2900");
    expect(q).toContain("mdot=2200");
    expect(q).not.toContain("hinj=");
    expect(q).toContain("plume=collisionless");
    expect(q).not.toContain("ptank=");
    expect(q).toContain("probe_x=0.12");
    expect(q).toContain("probe_y=0");
    expect(q).not.toContain("probe_r=");
    expect(q).not.toContain("object=");
    expect(q).not.toContain("run=");
  });

  it("round-trips query fields", () => {
    const parsed = parseShareSearch(`?${encodeShareSearch(fields)}`);
    expect(parsed.layer).toBe("thesis");
    expect(parsed.facility).toBe("IPG4");
    expect(parsed.gas).toBe("CO2");
    expect(parsed.mode).toBe("generator");
    expect(parsed.pinj).toBe(2900);
    expect(parsed.mdot).toBe(2200);
    expect(parsed.plume).toBe("collisionless");
    expect(parsed.probe_x).toBe(0.12);
    expect(parsed.probe_y).toBe(0);
    expect(parsed.probe_r).toBeUndefined();
    expect(parsed.run).toBeUndefined();
  });

  it("Advanced keeps tank and plume kernel", () => {
    const q = encodeShareSearch({
      ...fields,
      layer: "advanced",
      plumeMode: "sudden_freeze",
      pTank: 40,
      object: "none",
      diskX_m: null,
    });
    const parsed = parseShareSearch(`?${q}`);
    expect(parsed.layer).toBe("advanced");
    expect(parsed.plume).toBe("sudden_freeze");
    expect(parsed.ptank).toBe(40);
    expect(parsed.object).toBe("none");
    expect(q).not.toContain("probe_x=");
    expect(q).not.toContain("probe_y=");
  });

  it("omits probe_r on Thesis even when a plate is placed", () => {
    const q = encodeShareSearch({ ...fields, layer: "thesis", diskR_mm: 40 });
    expect(q).toContain("probe_x=0.12");
    expect(q).toContain("probe_y=0");
    expect(q).not.toContain("probe_r=");
  });

  it("round-trips probe_y with probe_x", () => {
    const q = encodeShareSearch({ ...fields, diskY_m: 0.04 });
    expect(q).toContain("probe_x=0.12");
    expect(q).toContain("probe_y=0.04");
    expect(parseShareSearch(`?${q}`).probe_y).toBeCloseTo(0.04);
  });

  it("Advanced Object Disk persists on/off and x/r", () => {
    const q = encodeShareSearch({ ...fields, layer: "advanced", object: "disk" });
    const parsed = parseShareSearch(`?${q}`);
    expect(parsed.object).toBe("disk");
    expect(parsed.probe_x).toBe(0.12);
    expect(parsed.probe_r).toBe(20);
  });

  it("Advanced Object None does not auto-place a disk from leftover x", () => {
    const q = encodeShareSearch({
      ...fields,
      layer: "advanced",
      object: "none",
      diskX_m: 0.12,
    });
    expect(q).toContain("object=none");
    expect(q).toContain("probe_x=0.12");
    expect(q).toContain("probe_y=0");
    expect(q).not.toContain("probe_r=");
    expect(parseShareSearch("?layer=advanced&facility=IPG4&probe_x=0.12").object).toBeUndefined();
  });

  it("omits the disk when it is not placed", () => {
    const q = encodeShareSearch({ ...fields, diskX_m: null });
    expect(q).not.toContain("probe_x=");
    expect(q).not.toContain("probe_y=");
    expect(q).not.toContain("probe_r=");
  });

  it("treats run=1 as auto-run and ignores other run values", () => {
    expect(parseShareSearch("?run=1").run).toBe(true);
    expect(parseShareSearch("?run=true").run).toBe(true);
    expect(parseShareSearch("?run=0").run).toBeUndefined();
    expect(parseShareSearch("?layer=thesis").run).toBeUndefined();
  });

  it("clamps disk radius to 5–50 mm", () => {
    expect(parseShareSearch("?probe_r=3").probe_r).toBe(5);
    expect(parseShareSearch("?probe_r=80").probe_r).toBe(50);
  });

  it("restores the station from probe_x / probe_y; plate only when object=disk", () => {
    expect(hydrateShareObject("thesis", { probe_x: 0.12, probe_y: 0.03 }).diskX).toBe(0.12);
    expect(hydrateShareObject("thesis", { probe_x: 0.12, probe_y: 0.03 }).probeY).toBe(0.03);
    expect(hydrateShareObject("thesis", { probe_x: 0.12 }).object).toBe("none");
    expect(hydrateShareObject("advanced", { probe_x: 0.12 }).diskX).toBe(0.12);
    expect(hydrateShareObject("advanced", { probe_x: 0.12 }).object).toBe("none");
    expect(hydrateShareObject("advanced", { object: "none", probe_x: 0.12 }).diskX).toBe(0.12);
    expect(hydrateShareObject("advanced", { object: "disk", probe_x: 0.08 }).diskX).toBe(0.08);
    expect(hydrateShareObject("advanced", { object: "disk", probe_x: 0.08 }).object).toBe("disk");
    expect(hydrateShareObject("advanced", { object: "disk" }).diskX).toBeNull();
  });

  it("round-trips custom mole mix without named-gas mix=", () => {
    const q = encodeShareSearch({
      ...fields,
      gas: "custom",
      customMix: { O2: 0.3, N2: 0, CO2: 0, He: 0.7, Ar: 0, CF4: 0 },
    });
    expect(q).toContain("gas=custom");
    expect(q).toContain("mix=O2%3A0.3%2CHe%3A0.7");
    const parsed = parseShareSearch(`?${q}`);
    expect(parsed.gas).toBe("custom");
    expect(parsed.mix).toEqual({ O2: 0.3, N2: 0, CO2: 0, He: 0.7, Ar: 0, CF4: 0 });
    expect(parseShareSearch("?gas=custom&mix=He:0.7,O2:0.3").mix).toEqual({
      O2: 0.3,
      N2: 0,
      CO2: 0,
      He: 0.7,
      Ar: 0,
      CF4: 0,
    });
    expect(parseShareSearch("?gas=custom&mix=CF4:1").mix).toEqual({
      O2: 0,
      N2: 0,
      CO2: 0,
      He: 0,
      Ar: 0,
      CF4: 1,
    });
    const named = encodeShareSearch(fields);
    expect(named).toContain("gas=CO2");
    expect(named).not.toContain("mix=");
  });

  it("builds from the live origin", () => {
    const href = shareUrl("https://ipg-operator.onrender.com", fields);
    expect(href.startsWith("https://ipg-operator.onrender.com/?")).toBe(true);
    expect(href).toContain("facility=IPG4");
  });
});
