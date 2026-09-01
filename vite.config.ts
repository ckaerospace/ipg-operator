import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "package.json"), "utf8"),
) as { version: string };
process.env.VITE_APP_VERSION = pkg.version;

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
  },
  server: {
    host: true,
    port: 43180,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 43180,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
