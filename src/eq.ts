import katex from "katex";

/** KaTeX HTML for the Model methods page. Trust is off; errors become the source. */
export function renderEq(math: string, display = true): string {
  return katex.renderToString(math, {
    displayMode: display,
    throwOnError: false,
    output: "htmlAndMathml",
    trust: false,
  });
}
