import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { Features } from "lightningcss";

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  css: {
    lightningcss: {
      exclude: Features.LightDark,
    },
  },
});
