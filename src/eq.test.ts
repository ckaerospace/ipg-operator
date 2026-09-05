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
});
