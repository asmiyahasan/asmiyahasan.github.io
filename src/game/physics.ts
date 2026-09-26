// Movement, collisions and catch detection.
// A line-by-line port of predprey/physics.py: keep the two in sync, and the
// parity tests (physics.test.ts) will tell you if they ever drift apart.

export type Vec2 = [number, number];

// [xMin, yMin, xMax, yMax]
export type Bounds = [number, number, number, number];

// (x, y, width, height), where (x, y) is the bottom-left corner
export type Rect = [number, number, number, number];

export interface AgentState {
  position: Vec2;
  velocity: Vec2;
  radius: number;
  maxSpeed: number;
  acceleration: number;
}

export const ARENA_SIZE = 10.0;
export const DT = 0.1; // seconds per step
export const DRAG = 0.9; // fraction of velocity kept each step
export const CATCH_EPSILON = 1e-9; // tolerance for floating-point rounding
export const AGENT_RADIUS = 0.3;

// Action -> direction, using maths convention (+y is up)
// 0: stay, 1: up, 2: down, 3: left, 4: right,
// 5: up-left, 6: up-right, 7: down-left, 8: down-right
const RAW_DIRECTIONS: Vec2[] = [
  [0, 0],
  [0, 1],
  [0, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [1, 1],
  [-1, -1],
  [1, -1],
];

// Same as NumPy's norm for a 2D vector: sqrt(x*x + y*y)
export function norm(v: Vec2): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

// Normalise every non-zero direction to length 1 ("stay" stays [0, 0])
export const ACTION_DIRECTIONS: Vec2[] = RAW_DIRECTIONS.map((d) => {
  const length = norm(d);
  return length > 0 ? [d[0] / length, d[1] / length] : [0, 0];
});

export const NUM_ACTIONS = ACTION_DIRECTIONS.length;

export function makeAgent(
  position: Vec2,
  options: Partial<Omit<AgentState, "position">> = {},
): AgentState {
  return {
    position: [position[0], position[1]],
    velocity: options.velocity ? [options.velocity[0], options.velocity[1]] : [0, 0],
    radius: options.radius ?? AGENT_RADIUS,
    maxSpeed: options.maxSpeed ?? 3.0,
    acceleration: options.acceleration ?? 8.0,
  };
}

/** Convert (x, y, width, height) rectangles into [xMin, yMin, xMax, yMax] bounds. */
export function obstacleBounds(rects: Rect[]): Bounds[] {
  return rects.map(([x, y, w, h]) => [x, y, x + w, y + h]);
}

function clip(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** Push the agent out of one rectangle and cancel velocity into its surface. */
export function resolveObstacleCollision(agent: AgentState, bounds: Bounds): void {
  const [xMin, yMin, xMax, yMax] = bounds;
  const [px, py] = agent.position;

  // The point on the rectangle closest to the agent's centre
  let closest: Vec2 = [clip(px, xMin, xMax), clip(py, yMin, yMax)];
  const offset: Vec2 = [px - closest[0], py - closest[1]];
  const distance = norm(offset);

  if (distance >= agent.radius) return; // not touching

  let normal: Vec2;
  if (distance > 0) {
    // Centre is outside the rectangle: push out along the offset direction
    normal = [offset[0] / distance, offset[1] / distance];
  } else {
    // Centre is inside (or exactly on the edge): leave via the nearest side
    const gaps = [px - xMin, xMax - px, py - yMin, yMax - py];
    let side = 0;
    for (let i = 1; i < 4; i++) if (gaps[i] < gaps[side]) side = i; // first minimum, like argmin
    const sideNormals: Vec2[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    normal = sideNormals[side];
    closest = [px + normal[0] * gaps[side], py + normal[1] * gaps[side]];
  }

  agent.position[0] = closest[0] + normal[0] * agent.radius;
  agent.position[1] = closest[1] + normal[1] * agent.radius;

  // Remove only the part of the velocity heading into the surface,
  // so the agent slides along the wall instead of stopping dead
  const intoSurface = agent.velocity[0] * normal[0] + agent.velocity[1] * normal[1];
  if (intoSurface < 0) {
    agent.velocity[0] -= intoSurface * normal[0];
    agent.velocity[1] -= intoSurface * normal[1];
  }
}

/** Advance one agent by one time step, applying the chosen action. */
export function stepAgent(agent: AgentState, action: number, obstacles: Bounds[] = []): void {
  // Accelerate in the chosen direction
  const direction = ACTION_DIRECTIONS[action];
  agent.velocity[0] += direction[0] * agent.acceleration * DT;
  agent.velocity[1] += direction[1] * agent.acceleration * DT;

  // Apply drag first, so maxSpeed below is the true top speed
  agent.velocity[0] *= DRAG;
  agent.velocity[1] *= DRAG;

  // Limit the speed to maxSpeed (keep direction, shrink size)
  const speed = norm(agent.velocity);
  if (speed > agent.maxSpeed) {
    const scale = agent.maxSpeed / speed;
    agent.velocity[0] *= scale;
    agent.velocity[1] *= scale;
  }

  // Move
  agent.position[0] += agent.velocity[0] * DT;
  agent.position[1] += agent.velocity[1] * DT;

  // Obstacles inside the arena
  for (const bounds of obstacles) resolveObstacleCollision(agent, bounds);

  // Keep the agent inside the arena walls; on any axis where we hit a wall,
  // stop movement along that axis only
  const low = agent.radius;
  const high = ARENA_SIZE - agent.radius;
  for (const axis of [0, 1]) {
    const clipped = clip(agent.position[axis], low, high);
    if (clipped !== agent.position[axis]) agent.velocity[axis] = 0;
    agent.position[axis] = clipped;
  }
}

/** True if a circle at `position` touches any obstacle. */
export function overlapsObstacle(position: Vec2, radius: number, obstacles: Bounds[]): boolean {
  return obstacles.some(([xMin, yMin, xMax, yMax]) => {
    const closest: Vec2 = [clip(position[0], xMin, xMax), clip(position[1], yMin, yMax)];
    return norm([position[0] - closest[0], position[1] - closest[1]]) < radius;
  });
}

/** True if the predator is touching or overlapping the prey. */
export function isCaught(predator: AgentState, prey: AgentState): boolean {
  const distance = norm([
    predator.position[0] - prey.position[0],
    predator.position[1] - prey.position[1],
  ]);
  return distance <= predator.radius + prey.radius + CATCH_EPSILON;
}