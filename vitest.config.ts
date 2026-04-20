import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "next/server": path.resolve(__dirname, "./node_modules/next/server.js"),
      "~": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/tests/**/*.test.ts", "src/tests/**/*.test.tsx"],
    css: true,
    clearMocks: true,
    restoreMocks: true,
  },
});
