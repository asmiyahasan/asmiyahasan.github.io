// Check every model the site serves (public/models/*.json) against the test
// vectors Python stored inside it, and that it was trained in this game.

import { describe, expect, test } from "vitest";
import fixtures from "./fixtures/parity.json";
import { argmax, forward, loadPolicy } from "./policy";
import type { ExportedModel } from "./policy";

const models = import.meta.glob<ExportedModel>("../../public/models/*.json", {
  eager: true,
  import: "default",
});

// Python does the maths in 32-bit floats, JavaScript in 64-bit, so scores can
// differ slightly; the chosen action must still match exactly.
const LOGIT_TOLERANCE = 1e-4;

test("the site has at least one model", () => {
  expect(Object.keys(models).length).toBeGreaterThan(0);
});

for (const [path, model] of Object.entries(models)) {
  const name = path.split("/").pop();

  describe(`model ${name}`, () => {
    test("loads", () => {
      expect(() => loadPolicy(model)).not.toThrow();
      expect(model.test_vectors.length).toBeGreaterThan(0);
    });

    test("was trained in the same game as the website runs", () => {
      expect(model.game_config).toEqual(fixtures.game_config);
    });

    test("matches Python's outputs on its test vectors", () => {
      const policy = loadPolicy(model);
      model.test_vectors.forEach((vector, i) => {
        const logits = forward(model.layers, vector.obs);
        vector.logits.forEach((expected, j) => {
          expect(Math.abs(logits[j] - expected), `vector ${i}, logit ${j}`).toBeLessThan(LOGIT_TOLERANCE);
        });
        expect(policy(vector.obs), `vector ${i}: action`).toBe(vector.action);
      });
    });
  });
}

test("argmax picks the first of equal values, like NumPy", () => {
  expect(argmax([1, 3, 3, 2])).toBe(1);
});
