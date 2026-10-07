import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    // Existing API tests exercise handlers directly; auth.test.ts turns auth back on.
    env: { AUTH_DISABLED: "true" },
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // DB tests start their own in-memory replica set; keep files isolated.
    pool: "forks",
  },
});
