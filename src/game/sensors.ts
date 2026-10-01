// Raycast sensors: how agents "see" walls, obstacles and each other.
// A port of predprey/sensors.py.
//
// Each agent casts NUM_RAYS rays evenly spaced around a full circle (fixed
// world directions, since agents have no facing direction). Each ray reports
// how far it travels before hitting an arena wall or an obstacle.

import { ARENA_SIZE, norm } from "./physics";
import type { Bounds, Vec2 } from "./physics";

export const NUM_RAYS = 16;
export const MAX_RAY_DISTANCE = ARENA_SIZE * Math.sqrt(2); // the arena's diagonal

const ANGLE_STEP = (2 * Math.PI) / NUM_RAYS;
export const RAY_DIRECTIONS: Vec2[] = Array.from({ length: NUM_RAYS }, (_, i) => {
  const angle = i * ANGLE_STEP;
  return [Math.cos(angle), Math.sin(angle)];
});

/** How far a ray travels from `origin` before leaving the square arena. */
function distanceToArenaEdge(origin: Vec2, direction: Vec2): number {
  let nearest = Infinity;
  for (const axis of [0, 1]) {
    const d = direction[axis];
    if (d === 0) continue; // parallel to this pair of walls: never hits them
    const target = d > 0 ? ARENA_SIZE : 0;
    nearest = Math.min(nearest, (target - origin[axis]) / d);
  }
  return Math.max(nearest, 0);
}

/**
 * How far a ray travels before hitting any obstacle (Infinity if it misses all).
 * Uses the "slab" method: a ray is inside a box when it is between the box's
 * x-limits AND its y-limits at the same time.
 */
function distanceToBoxes(origin: Vec2, direction: Vec2, obstacles: Bounds[]): number {
  let nearest = Infinity;
  for (const box of obstacles) {
    let tEnter = -Infinity;
    let tExit = Infinity;
    for (const axis of [0, 1]) {
      const low = box[axis];
      const high = box[axis + 2];
      const o = origin[axis];
      const d = direction[axis];
      let t1: number;
      let t2: number;
      if (d === 0) {
        // Parallel to this axis: inside the slab forever, or never
        const inside = o >= low && o <= high;
        t1 = inside ? -Infinity : Infinity;
        t2 = Infinity;
      } else {
        t1 = (low - o) / d;
        t2 = (high - o) / d;
      }
      tEnter = Math.max(tEnter, Math.min(t1, t2));
      tExit = Math.min(tExit, Math.max(t1, t2));
    }
    if (tEnter <= tExit && tExit >= 0) {
      nearest = Math.min(nearest, Math.max(tEnter, 0));
    }
  }
  return nearest;
}

/** Distance along each ray to the nearest wall or obstacle. */
export function castRays(origin: Vec2, obstacles: Bounds[]): number[] {
  return RAY_DIRECTIONS.map((direction) =>
    Math.min(distanceToArenaEdge(origin, direction), distanceToBoxes(origin, direction, obstacles)),
  );
}

/** True if no obstacle blocks the straight line between points a and b. */
export function hasLineOfSight(a: Vec2, b: Vec2, obstacles: Bounds[]): boolean {
  const offset: Vec2 = [b[0] - a[0], b[1] - a[1]];
  const distance = norm(offset);
  if (distance === 0 || obstacles.length === 0) return true;
  const direction: Vec2 = [offset[0] / distance, offset[1] / distance];
  return distanceToBoxes(a, direction, obstacles) >= distance;
}