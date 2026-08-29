import { describe, expect, it } from "vitest";
import { parsePlumeProbe } from "./physics";

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
