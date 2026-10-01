// Parity tests for sensors, observations and the game loop: replay Python's
// recorded games and check every observation, reward and outcome matches.

import { describe, expect, test } from "vitest";
import fixtures from "./fixtures/parity.json";
import { AGENTS, Game } from "./game";
import type { GameConfig } from "./game";
import { MEMORY_HORIZON, OBS_SIZE } from "./observations";
import type { Vec2 } from "./physics";
import { MAX_RAY_DISTANCE, RAY_DIRECTIONS } from "./sensors";

// Observations are 32-bit floats, so they only agree to about 7 significant digits
const OBS_TOLERANCE = 1e-6;

const OBS_NAMES = [
  "own x", "own y", "own vx", "own vy", "visible",
  "opp rel x", "opp rel y", "opp rel vx", "opp rel vy",
  "last seen x", "last seen y", "time since seen",
  ...Array.from({ length: 16 }, (_, i) => `ray ${i}`),
];

function expectObsClose(actual: Float32Array, expected: number[], where: string) {
  expect(actual.length, `${where}: observation length`).toBe(expected.length);
  expected.forEach((value, i) => {
    const diff = Math.abs(actual[i] - value);
    expect(diff, `${where}: obs[${i}] (${OBS_NAMES[i]}): got ${actual[i]}, Python had ${value}`)
      .toBeLessThan(OBS_TOLERANCE);
  });
}

describe("sensor and observation constants match Python", () => {
  const c = fixtures.constants;

  test("ray directions", () => {
    expect(RAY_DIRECTIONS.length).toBe(c.ray_directions.length);
    RAY_DIRECTIONS.forEach((d, i) => {
      expect(Math.abs(d[0] - c.ray_directions[i][0])).toBeLessThan(1e-12);
      expect(Math.abs(d[1] - c.ray_directions[i][1])).toBeLessThan(1e-12);
    });
  });

  test("scalars", () => {
    expect(MAX_RAY_DISTANCE).toBeCloseTo(c.max_ray_distance, 12);
    expect(MEMORY_HORIZON).toBe(c.memory_horizon);
    expect(OBS_SIZE).toBe(c.obs_size);
  });
});

describe("game replays Python's recorded games", () => {
  const config = fixtures.game_config as unknown as GameConfig;

  for (const recorded of fixtures.games) {
    test(recorded.name, () => {
      const game = new Game(config, recorded.max_steps);
      const start = game.reset(recorded.predator_start as Vec2, recorded.prey_start as Vec2);

      for (const agent of AGENTS) {
        expectObsClose(start[agent], recorded.initial_observations[agent], `${recorded.name}, start, ${agent}`);
      }

      recorded.steps.forEach((step, i) => {
        const where = `${recorded.name}, step ${i + 1}`;
        const result = game.step(step.actions);

        expect(result.visible, `${where}: visible`).toBe(step.visible);
        expect(result.caught, `${where}: caught`).toBe(step.caught);
        expect(result.truncated, `${where}: truncated`).toBe(step.truncated);
        for (const agent of AGENTS) {
          expect(result.rewards[agent], `${where}: ${agent} reward`).toBeCloseTo(step.rewards[agent], 12);
          expectObsClose(result.observations[agent], step.observations[agent], `${where}, ${agent}`);
        }
      });

      expect(game.done, `${recorded.name}: game should be over`).toBe(true);
    });
  }
});

test("random start positions are valid", () => {
  const game = new Game(fixtures.game_config as unknown as GameConfig);
  for (let i = 0; i < 200; i++) {
    game.resetRandom();
    const [a, b] = [game.states.predator.position, game.states.prey.position];
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThanOrEqual(3);
  }
});