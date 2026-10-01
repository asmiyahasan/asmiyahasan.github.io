// Tells Vite the site has three pages, so all of them are included in the build.
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, "index.html"),
        predatorPrey: resolve(import.meta.dirname, "predator-prey/index.html"),
        ticTacToe: resolve(import.meta.dirname, "tic-tac-toe/index.html"),
      },
    },
  },
});
