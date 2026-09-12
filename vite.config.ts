import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { Features } from "lightningcss";

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  test: {
    clearMocks: true,
    unstubGlobals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          exclude: ["**/node_modules/**", "**/*-client.test.ts"],
        },
      },
      {
        extends: true,
        resolve: { conditions: ["browser"] },
        test: {
          name: "client",
          environment: "jsdom",
          include: ["src/**/*-client.test.ts"],
        },
      },
    ],
  },
  css: {
    lightningcss: {
      exclude: Features.LightDark,
    },
  },
});
