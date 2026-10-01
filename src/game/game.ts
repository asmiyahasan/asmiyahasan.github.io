// The game loop: the TypeScript version of PredatorPreyEnv (predprey/env.py).
// Holds both agents, moves them, tracks what each remembers about the other,
// and produces observations and rewards.

import {
  ARENA_SIZE,
  AGENT_RADIUS,
  isCaught,
  makeAgent,
  norm,
  obstacleBounds,
  overlapsObstacle,
  stepAgent,
} from "./physics";
import type { AgentState, Bounds, Rect, Vec2 } from "./physics";
import { buildObservation } from "./observations";
import { hasLineOfSight } from "./sensors";

export type AgentName = "predator" | "prey";
export const AGENTS: AgentName[] = ["predator", "prey"]; // same order as Python

// Uses Python's field names, so it can be read straight from config.json or a model export
export interface GameConfig {
  predator_max_speed: number;
  predator_acceleration: number;
  prey_max_speed: number;
  prey_acceleration: number;
  obstacles: Rect[];
}

export const STEP_REWARD = 0.01;
export const CATCH_REWARD = 1.0;
export const MIN_SPAWN_DISTANCE = 3.0;

export type PerAgent<T> = Record<AgentName, T>;

export interface StepResult {
  observations: PerAgent<Float32Array>;
  rewards: PerAgent<number>;
  caught: boolean; // the game ended with a catch
  truncated: boolean; // the game ended because time ran out
  done: boolean;
  visible: boolean; // can the agents see each other right now?
}

function opponentOf(agent: AgentName): AgentName {
  return agent === "predator" ? "prey" : "predator";
}

export class Game {
  readonly obstacles: Bounds[];
  states!: PerAgent<AgentState>;
  stepCount = 0;
  caught = false;
  done = false;
  visible = false;

  // Each agent's memory of its opponent: where it was last seen, and how long ago
  private lastSeen: PerAgent<Vec2 | null> = { predator: null, prey: null };
  private stepsSinceSeen: PerAgent<number | null> = { predator: null, prey: null };

  readonly config: GameConfig;
  readonly maxSteps: number;

  constructor(config: GameConfig, maxSteps = 300) {
    this.config = config;
    this.maxSteps = maxSteps;
    this.obstacles = obstacleBounds(config.obstacles);
  }

  /** Start a new game with both agents at the given positions. */
  reset(predatorStart: Vec2, preyStart: Vec2): PerAgent<Float32Array> {
    const c = this.config;
    this.states = {
      predator: makeAgent(predatorStart, {
        maxSpeed: c.predator_max_speed,
        acceleration: c.predator_acceleration,
      }),
      prey: makeAgent(preyStart, {
        maxSpeed: c.prey_max_speed,
        acceleration: c.prey_acceleration,
      }),
    };
    this.stepCount = 0;
    this.caught = false;
    this.done = false;

    // Nobody has seen anybody yet this game
    this.lastSeen = { predator: null, prey: null };
    this.stepsSinceSeen = { predator: null, prey: null };
    this.updateMemory();

    return this.observations();
  }

  /** Start a new game at random free positions, at least MIN_SPAWN_DISTANCE apart. */
  resetRandom(random: () => number = Math.random): PerAgent<Float32Array> {
    const predator = this.randomFreePosition(random);
    let prey = this.randomFreePosition(random);
    while (norm([prey[0] - predator[0], prey[1] - predator[1]]) < MIN_SPAWN_DISTANCE) {
      prey = this.randomFreePosition(random);
    }
    return this.reset(predator, prey);
  }

  /** Advance one step. Both agents move at the same time (predator is processed first). */
  step(actions: PerAgent<number>): StepResult {
    if (this.done) throw new Error("game is over: call reset() first");

    for (const agent of AGENTS) stepAgent(this.states[agent], actions[agent], this.obstacles);
    this.stepCount += 1;
    this.updateMemory();

    const caught = isCaught(this.states.predator, this.states.prey);
    const outOfTime = this.stepCount >= this.maxSteps;
    this.caught = caught;
    this.done = caught || outOfTime;

    const rewards: PerAgent<number> = caught
      ? { predator: CATCH_REWARD, prey: -CATCH_REWARD }
      : { predator: -STEP_REWARD, prey: STEP_REWARD };

    return {
      observations: this.observations(),
      rewards,
      caught,
      truncated: outOfTime && !caught,
      done: this.done,
      visible: this.visible,
    };
  }

  observations(): PerAgent<Float32Array> {
    return {
      predator: this.observe("predator"),
      prey: this.observe("prey"),
    };
  }

  private observe(agent: AgentName): Float32Array {
    return buildObservation(
      this.states[agent],
      this.states[opponentOf(agent)],
      this.obstacles,
      this.visible,
      this.lastSeen[agent],
      this.stepsSinceSeen[agent],
    );
  }

  /** Line of sight is symmetric, so both agents see each other or neither does. */
  private updateMemory(): void {
    this.visible = hasLineOfSight(
      this.states.predator.position,
      this.states.prey.position,
      this.obstacles,
    );
    for (const agent of AGENTS) {
      const seen = this.stepsSinceSeen[agent];
      if (this.visible) {
        const p = this.states[opponentOf(agent)].position;
        this.lastSeen[agent] = [p[0], p[1]];
        this.stepsSinceSeen[agent] = 0;
      } else if (seen !== null) {
        this.stepsSinceSeen[agent] = seen + 1;
      }
    }
  }

  private randomFreePosition(random: () => number): Vec2 {
    const low = AGENT_RADIUS;
    const high = ARENA_SIZE - AGENT_RADIUS;
    for (;;) {
      const position: Vec2 = [low + random() * (high - low), low + random() * (high - low)];
      if (!overlapsObstacle(position, AGENT_RADIUS, this.obstacles)) return position;
    }
  }
}