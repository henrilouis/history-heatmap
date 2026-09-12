import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { Features } from "lightningcss";

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: "node",
    clearMocks: true,
    unstubGlobals: true,
  },
  css: {
    lightningcss: {
      exclude: Features.LightDark,
    },
  },
});
