import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    // Mirror Next's "@/" alias so the music modules import the same way in
    // tests as in the app.
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["src/**/__tests__/**/*.test.js"],
    environment: "node",
  },
})
