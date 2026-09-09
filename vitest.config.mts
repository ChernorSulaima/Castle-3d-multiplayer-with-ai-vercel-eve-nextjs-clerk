import { defineConfig } from "vitest/config";

// Convex function tests run against `convex-test`, a JS mock of the backend, in the
// edge-runtime VM (the closest match to the Convex V8 isolate). `convex-test` ships
// untranspiled ESM that Vite must process, hence the inline entry.
// https://docs.convex.dev/functions/testing
export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    // P0's src/lib/__tests__ and P5's src/lib/engine/__tests__ both carry
    // `// @vitest-environment node` on line 1, so the edge-runtime default above
    // does not apply to them.
    include: ["convex/**/*.test.ts", "src/**/*.test.ts"],
  },
});
