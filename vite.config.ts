// Tells Vite the site has two pages, so both are included in the build.
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, "index.html"),
        writeup: resolve(import.meta.dirname, "predator-prey/index.html"),
      },
    },
  },
});
