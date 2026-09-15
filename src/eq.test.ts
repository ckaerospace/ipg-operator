import { describe, expect, it } from "vitest";
import { renderEq } from "./eq";

describe("renderEq", () => {
  it("renders the speed-ratio definition", () => {
    const html = renderEq("S_0=U_0/\\sqrt{2RT_0}", true);
    expect(html).toContain("katex");
    expect(html).toContain("MathML");
  });

  it("renders inline without a display block", () => {
    const html = renderEq("n/n_0", false);
    expect(html).toContain("katex");
    expect(html).not.toContain("katex-display");
  });

  it("renders stacked lip angles so phone width can show both", () => {
    const html = renderEq(
      "\\begin{aligned}\\theta_1 &= \\operatorname{atan2}(Y-H,\\,X),\\\\ \\theta_2 &= \\operatorname{atan2}(Y+H,\\,X)\\end{aligned}",
      true,
    );
    expect(html).toContain("katex");
    expect(html).not.toMatch(/KaTeX parse error|ParseError/i);
  });
});
