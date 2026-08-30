import { describe, expect, it } from "vitest";
import { commitDraftNumber, parseDraftNumber } from "./numberDraft";

describe("number draft", () => {
  it("does not treat empty as 0", () => {
    expect(parseDraftNumber("", 0, 100)).toBeNull();
    expect(parseDraftNumber("   ", 1, 499)).toBeNull();
    expect(parseDraftNumber("nope", 0, 1)).toBeNull();
    expect(commitDraftNumber("", 37, 1, 499)).toBe(37);
    expect(commitDraftNumber("", 0.21, 0, 1)).toBe(0.21);
    expect(commitDraftNumber("NaN", 10, 0.1, 5000)).toBe(10);
  });

  it("parses and clamps on commit", () => {
    expect(parseDraftNumber("20", 5, 50)).toBe(20);
    expect(parseDraftNumber("0", 5, 50)).toBe(5);
    expect(parseDraftNumber("80", 5, 50)).toBe(50);
    expect(commitDraftNumber("12.5", 20, 5, 50)).toBe(12.5);
  });
});
