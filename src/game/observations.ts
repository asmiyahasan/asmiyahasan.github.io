// The observation vector: what each agent sees every step.
// A port of predprey/observations.py. The layout must match exactly, because
// the trained networks read these 28 numbers by position.
//
//   index  0-1    own position, rescaled to -1..1
//   index  2-3    own velocity / own max speed
//   index  4      1 if the opponent is in line of sight, else 0
//   index  5-6    opponent position relative to me / ARENA_SIZE   (0 if hidden)
//   index  7-8    opponent velocity relative to me / speed scale  (0 if hidden)
//   index  9-10   where I last saw the opponent, relative to me / ARENA_SIZE
//   index  11     how long ago: 0 = now, 1 = MEMORY_HORIZON steps or more (or never)
//   index  12-27  16 ray distances to walls/obstacles / MAX_RAY_DISTANCE

import { ARENA_SIZE } from "./physics";
import type { AgentState, Bounds, Vec2 } from "./physics";
import { MAX_RAY_DISTANCE, NUM_RAYS, castRays } from "./sensors";

export const OWN_POS = 0;
export const OWN_VEL = 2;
export const OPP_VISIBLE = 4;
export const OPP_REL_POS = 5;
export const OPP_REL_VEL = 7;
export const LAST_SEEN_REL_POS = 9;
export const TIME_SINCE_SEEN = 11;
export const RAYS = 12;

export const OBS_SIZE = 12 + NUM_RAYS;
export const MEMORY_HORIZON = 100; // steps (10 seconds)

function clip(value: number): number {
  return Math.min(Math.max(value, -1), 1);
}

export function buildObservation(
  me: AgentState,
  other: AgentState,
  obstacles: Bounds[],
  visible: boolean,
  lastSeen: Vec2 | null,
  stepsSinceSeen: number | null,
): Float32Array {
  const obs = new Array<number>(OBS_SIZE).fill(0);

  obs[OWN_POS] = (me.position[0] / ARENA_SIZE) * 2 - 1;
  obs[OWN_POS + 1] = (me.position[1] / ARENA_SIZE) * 2 - 1;
  obs[OWN_VEL] = me.velocity[0] / me.maxSpeed;
  obs[OWN_VEL + 1] = me.velocity[1] / me.maxSpeed;

  if (visible) {
    const speedScale = me.maxSpeed + other.maxSpeed;
    obs[OPP_VISIBLE] = 1;
    obs[OPP_REL_POS] = (other.position[0] - me.position[0]) / ARENA_SIZE;
    obs[OPP_REL_POS + 1] = (other.position[1] - me.position[1]) / ARENA_SIZE;
    obs[OPP_REL_VEL] = (other.velocity[0] - me.velocity[0]) / speedScale;
    obs[OPP_REL_VEL + 1] = (other.velocity[1] - me.velocity[1]) / speedScale;
  }

  if (lastSeen === null || stepsSinceSeen === null) {
    obs[TIME_SINCE_SEEN] = 1;
  } else {
    obs[LAST_SEEN_REL_POS] = (lastSeen[0] - me.position[0]) / ARENA_SIZE;
    obs[LAST_SEEN_REL_POS + 1] = (lastSeen[1] - me.position[1]) / ARENA_SIZE;
    obs[TIME_SINCE_SEEN] = Math.min(stepsSinceSeen / MEMORY_HORIZON, 1);
  }

  castRays(me.position, obstacles).forEach((distance, i) => {
    obs[RAYS + i] = distance / MAX_RAY_DISTANCE;
  });

  // Clip to -1..1, then store as 32-bit floats like Python's .astype(np.float32)
  return Float32Array.from(obs, clip);
}