// Parity tests: replay the games recorded by Python (make_fixtures.py) and
// check the TypeScript physics produces the same positions and velocities.

import { describe, expect, test } from "vitest";
import fixtures from "./fixtures/parity.json";
import {
  ACTION_DIRECTIONS,
  AGENT_RADIUS,
  ARENA_SIZE,
  CATCH_EPSILON,
  DRAG,
  DT,
  isCaught,
  makeAgent,
  obstacleBounds,
  stepAgent,
} from "./physics";
import type { Rect, Vec2 } from "./physics";

// Floating-point results can differ in the last few digits between NumPy and
// JavaScript; anything beyond this is a real bug.
const TOLERANCE = 1e-9;

function expectClose(actual: Vec2, expected: number[], label: string) {
  for (const axis of [0, 1]) {
    const diff = Math.abs(actual[axis] - expected[axis]);
    expect(diff, `${label}[${axis}]: got ${actual[axis]}, Python had ${expected[axis]}`)
      .toBeLessThan(TOLERANCE);
  }
}

describe("constants match Python", () => {
  const c = fixtures.constants;

  test("scalars", () => {
    expect(ARENA_SIZE).toBe(c.arena_size);
    expect(DT).toBe(c.dt);
    expect(DRAG).toBe(c.drag);
    expect(AGENT_RADIUS).toBe(c.agent_radius);
    expect(CATCH_EPSILON).toBe(c.catch_epsilon);
  });

  test("action directions", () => {
    expect(ACTION_DIRECTIONS.length).toBe(c.action_directions.length);
    ACTION_DIRECTIONS.forEach((d, i) => expectClose(d, c.action_directions[i], `action ${i}`));
  });
});

describe("physics replays Python's recorded games", () => {
  const config = fixtures.game_config;
  const obstacles = obstacleBounds(config.obstacles as Rect[]);

  for (const game of fixtures.games) {
    test(game.name, () => {
      const predator = makeAgent(game.predator_start as Vec2, {
        maxSpeed: config.predator_max_speed,
        acceleration: config.predator_acceleration,
      });
      const prey = makeAgent(game.prey_start as Vec2, {
        maxSpeed: config.prey_max_speed,
        acceleration: config.prey_acceleration,
      });

      game.steps.forEach((step, i) => {
        // Same order as the Python environment: predator moves, then prey
        stepAgent(predator, step.actions.predator, obstacles);
        stepAgent(prey, step.actions.prey, obstacles);

        const where = `${game.name}, step ${i + 1}`;
        expectClose(predator.position, step.predator.position, `${where}: predator position`);
        expectClose(predator.velocity, step.predator.velocity, `${where}: predator velocity`);
        expectClose(prey.position, step.prey.position, `${where}: prey position`);
        expectClose(prey.velocity, step.prey.velocity, `${where}: prey velocity`);
        expect(isCaught(predator, prey), `${where}: caught`).toBe(step.caught);
      });
    });
  }
});