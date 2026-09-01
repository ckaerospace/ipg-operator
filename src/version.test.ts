import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { APP_VERSION, IS_BETA } from "./version";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};

test("APP_VERSION matches package.json", () => {
  expect(APP_VERSION).toBe(pkg.version);
  expect(APP_VERSION).toBe("1.0.0");
});

test("live builds have no BETA channel", () => {
  expect(IS_BETA).toBe(false);
});
