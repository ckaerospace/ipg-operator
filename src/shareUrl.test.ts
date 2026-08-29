import { describe, expect, it } from "vitest";
import { encodeShareSearch, parseShareSearch, shareUrl } from "./shareUrl";
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
    expect(q).toContain("probe_r=20");
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
    expect(parsed.probe_r).toBe(20);
    expect(parsed.run).toBeUndefined();
  });

  it("Advanced keeps tank and plume kernel", () => {
    const q = encodeShareSearch({ ...fields, layer: "advanced", plumeMode: "sudden_freeze", pTank: 40 });
    const parsed = parseShareSearch(`?${q}`);
    expect(parsed.layer).toBe("advanced");
    expect(parsed.plume).toBe("sudden_freeze");
    expect(parsed.ptank).toBe(40);
  });

  it("omits the disk when it is not placed", () => {
    const q = encodeShareSearch({ ...fields, diskX_m: null });
    expect(q).not.toContain("probe_x=");
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

  it("builds from the live origin", () => {
    const href = shareUrl("https://ipg-operator.onrender.com", fields);
    expect(href.startsWith("https://ipg-operator.onrender.com/?")).toBe(true);
    expect(href).toContain("facility=IPG4");
  });
});
