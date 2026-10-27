import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// .mts = native ESM: compatible with Vite's `configLoader: 'native'`
// (planned default in a future major), hence import.meta.url instead of __dirname.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
})
