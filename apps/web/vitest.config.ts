import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@blitzclaw/db": path.resolve(__dirname, "../../packages/db"),
    },
  },
});
