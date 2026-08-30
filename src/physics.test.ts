import { describe, expect, it } from "vitest";
import {
  clampProbeYm,
  faceMatchesSolve,
  fmtTankPa,
  incidentRamFlux,
  parsePlumeProbe,
  PINJ_SLIDER_STEPS,
  pinjPaToSlider,
  P_TANK_MAX,
  P_TANK_MIN,
  sliderToPinjPa,
  sliderToTankPa,
  tankPaToSlider,
  TANK_SLIDER_STEPS,
} from "./physics";

describe("clampProbeYm", () => {
  it("keeps signed y inside ±ymax", () => {
    expect(clampProbeYm(0.04, 0.2)).toBeCloseTo(0.04);
    expect(clampProbeYm(-0.04, 0.2)).toBeCloseTo(-0.04);
    expect(clampProbeYm(0.5, 0.2)).toBeCloseTo(0.2);
    expect(clampProbeYm(-0.5, 0.2)).toBeCloseTo(-0.2);
  });
});

describe("parsePlumeProbe", () => {
  it("reads kinetic wall p and q from p_w_Pa / q_w_W_m2", () => {
    const p = parsePlumeProbe({
      x_m: 0.12,
      r_mm: 20,
      kn_obj: 0.4,
      regime: "kinetic",
      p_w_Pa: 12.5,
      q_w_W_m2: 3.4e4,
    });
    expect(p).not.toBeNull();
    expect(p!.p_Pa).toBe(12.5);
    expect(p!.q_W_m2).toBe(34000);
    expect(p!.Kn_obj).toBe(0.4);
    expect(p!.regime).toBe("kinetic");
  });

  it("reads continuum stagnation p and q when wall keys are absent", () => {
    const p = parsePlumeProbe({
      x_m: 0.08,
      r_mm: 20,
      kn_obj: 0.01,
      regime: "continuum",
      p_stag_Pa: 2100,
      q_stag_W_m2: 1.2e6,
    });
    expect(p!.p_Pa).toBe(2100);
    expect(p!.q_W_m2).toBe(1.2e6);
  });

  it("prefers wall keys over stagnation and generic aliases", () => {
    const p = parsePlumeProbe({
      p_w_Pa: 9,
      p_stag_Pa: 90,
      p_Pa: 900,
      p: 9000,
      q_w_W_m2: 1,
      q_stag_W_m2: 2,
      q_W_m2: 3,
      q: 4,
    });
    expect(p!.p_Pa).toBe(9);
    expect(p!.q_W_m2).toBe(1);
  });

  it("still accepts the generic p_Pa / q_W_m2 names", () => {
    const p = parsePlumeProbe({ p_Pa: 5, q_W_m2: 7 });
    expect(p!.p_Pa).toBe(5);
    expect(p!.q_W_m2).toBe(7);
  });
});

describe("faceMatchesSolve", () => {
  it("is true only for the station posted on the last solve", () => {
    const solved = { x: 0.7158, r: 20 };
    expect(faceMatchesSolve(solved, 0.7158, 20)).toBe(true);
    expect(faceMatchesSolve(solved, 0.12, 20)).toBe(false);
    expect(faceMatchesSolve(solved, 0.7158, 40)).toBe(false);
    expect(faceMatchesSolve(null, 0.7158, 20)).toBe(false);
    expect(faceMatchesSolve(solved, null, 20)).toBe(false);
  });
});

describe("tank slider", () => {
  it("maps log so 10 Pa and 3000 Pa are both usable", () => {
    const t10 = tankPaToSlider(10);
    const t3000 = tankPaToSlider(3000);
    expect(t10).toBeGreaterThan(200);
    expect(t10).toBeLessThan(500);
    expect(t3000).toBeGreaterThan(800);
    expect(Math.abs(sliderToTankPa(t10) - 10)).toBeLessThan(0.05);
    expect(Math.abs(sliderToTankPa(t3000) - 3000)).toBeLessThan(15);
    expect(sliderToTankPa(0)).toBeCloseTo(P_TANK_MIN, 8);
    expect(sliderToTankPa(TANK_SLIDER_STEPS)).toBeCloseTo(P_TANK_MAX, 4);
    expect(fmtTankPa(10)).toBe("10 Pa");
    expect(fmtTankPa(3000)).toBe("3000 Pa");
    expect(fmtTankPa(0.35)).toBe("0.35 Pa");
  });
});

describe("pinj log slider", () => {
  const min = 5;
  const max = 2000;
  const step = 1;

  it("keeps 100 Pa hittable on the IPG6-S 5–2000 Pa track", () => {
    const t100 = pinjPaToSlider(100, min, max);
    expect(t100).toBeGreaterThan(PINJ_SLIDER_STEPS * 0.35);
    expect(t100).toBeLessThan(PINJ_SLIDER_STEPS * 0.65);
    expect(sliderToPinjPa(t100, min, max, step)).toBe(100);
    expect(sliderToPinjPa(0, min, max, step)).toBe(min);
    expect(sliderToPinjPa(PINJ_SLIDER_STEPS, min, max, step)).toBe(max);
  });
});

describe("incidentRamFlux", () => {
  const n_ratio = 0.1;
  const n0 = 1e20;
  const U = 3850;
  const n = n_ratio * n0;
  const e = 1.602176634e-19;

  it("uses directed E: p_ram = 2 n E_J and q_inc = n U E_J", () => {
    const flux = incidentRamFlux({ n_ratio, n0, e_kin_eV: 1.3, U, MW: 16 });
    expect(flux).not.toBeNull();
    const eJ = 1.3 * e;
    expect(flux!.p_ram_Pa).toBeCloseTo(2 * n * eJ, 8);
    expect(flux!.q_inc_W_m2).toBeCloseTo(n * U * eJ, 4);
  });

  it("falls back to CEA MW and U when E is missing, not n k T", () => {
    const flux = incidentRamFlux({ n_ratio, n0, U, MW: 16 });
    expect(flux).not.toBeNull();
    const m = (16 * 1e-3) / 6.02214076e23;
    expect(flux!.p_ram_Pa).toBeCloseTo(n * m * U * U, 8);
    expect(flux!.q_inc_W_m2).toBeCloseTo(0.5 * n * m * U * U * U, 4);
    const thermal = n * 1.380649e-23 * 2000;
    expect(Math.abs(flux!.p_ram_Pa - thermal)).toBeGreaterThan(1e-6);
  });
});
