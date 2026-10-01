// The Predator vs Prey page: a human controls one side, a trained agent the other.
// Until the visitor starts a game, the two agents play each other as a live demo.
//
// The game logic runs at a fixed 10 steps per second, exactly like training.
// The screen redraws ~60 times per second, smoothly interpolating positions
// between steps, so movement looks fluid without changing the game itself.

import "./style.css";
import { DT, ARENA_SIZE } from "./game/physics";
import type { Vec2 } from "./game/physics";
import { Game } from "./game/game";
import type { AgentName, PerAgent } from "./game/game";
import { loadPolicy } from "./game/policy";
import type { ExportedModel, Policy } from "./game/policy";
import { showModelCard } from "./modelCard";

const STEP_MS = DT * 1000;
// Matches the site palette in style.css: the accent magenta is the predator
const COLOURS = {
  background: "#28282d",
  obstacle: "#45454d",
  sightLine: "rgba(255, 255, 255, 0.14)",
  predator: "#ff4d9d",
  prey: "#5ccfe6",
};

// Visitors who ask for less motion don't get the self-playing demo
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------------------
// Page elements
// ---------------------------------------------------------------------------
const canvas = document.querySelector<HTMLCanvasElement>("#arena")!;
const ctx = canvas.getContext("2d")!;
const overlay = document.querySelector<HTMLDivElement>("#overlay")!;
const overlayText = document.querySelector<HTMLParagraphElement>("#overlay-text")!;
const statusLeft = document.querySelector<HTMLSpanElement>("#status-left")!;
const statusRight = document.querySelector<HTMLSpanElement>("#status-right")!;
const sideButtons = document.querySelectorAll<HTMLButtonElement>(".side-button");
const difficultyButtons = document.querySelectorAll<HTMLButtonElement>(".difficulty-button");

// ---------------------------------------------------------------------------
// Keyboard -> one of the 9 actions
// ---------------------------------------------------------------------------
const held = new Set<string>();
const KEY_TO_DIRECTION: Record<string, "up" | "down" | "left" | "right"> = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};

// Same numbering as ACTION_DIRECTIONS: 0 stay, 1 up, 2 down, 3 left, 4 right,
// 5 up-left, 6 up-right, 7 down-left, 8 down-right
function keyboardAction(): number {
  const dirs = new Set([...held].map((code) => KEY_TO_DIRECTION[code]));
  const y = (dirs.has("up") ? 1 : 0) - (dirs.has("down") ? 1 : 0);
  const x = (dirs.has("right") ? 1 : 0) - (dirs.has("left") ? 1 : 0);
  const table: Record<string, number> = {
    "0,0": 0, "0,1": 1, "0,-1": 2, "-1,0": 3, "1,0": 4,
    "-1,1": 5, "1,1": 6, "-1,-1": 7, "1,-1": 8,
  };
  return table[`${x},${y}`];
}

window.addEventListener("keydown", (event) => {
  if (event.code in KEY_TO_DIRECTION) {
    held.add(event.code);
    event.preventDefault(); // stop arrow keys scrolling the page
  } else if (event.code === "Space") {
    event.preventDefault();
    if (state === "ready" || state === "over") startGame();
  }
});
window.addEventListener("keyup", (event) => held.delete(event.code));
window.addEventListener("blur", () => held.clear()); // don't get stuck moving after switching tabs

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
type Difficulty = "easy" | "medium" | "hard";

let state: "loading" | "ready" | "playing" | "over" = "loading";
let humanSide: AgentName = "prey";
let difficulty: Difficulty = "easy";
let aiPolicy: Policy;
let demoPolicy: Policy; // plays the visitor's side during the demo
let game: Game | undefined;
let observations: PerAgent<Float32Array>;
let previous: PerAgent<Vec2>; // positions before the latest step, for smooth drawing
let accumulator = 0;
let lastFrame = performance.now();

function aiSide(): AgentName {
  return humanSide === "prey" ? "predator" : "prey";
}

// Each side and difficulty has its own model file, e.g. models/prey-hard.json.
// Files are downloaded the first time they're needed, then kept.
const policyCache = new Map<string, Promise<{ policy: Policy; model: ExportedModel }>>();

function getPolicy(side: AgentName, level: Difficulty) {
  const key = `${side}-${level}`;
  if (!policyCache.has(key)) {
    policyCache.set(key, loadModel(key).then((model) => ({ policy: loadPolicy(model), model })));
  }
  return policyCache.get(key)!;
}

// Load the AI for the current side and difficulty, then get ready to play
async function setUp() {
  state = "loading";
  sideButtons.forEach((b) => b.classList.toggle("active", b.dataset.side === humanSide));
  difficultyButtons.forEach((b) => b.classList.toggle("active", b.dataset.difficulty === difficulty));
  showOverlay("Loading the agent…");

  const wanted = `${humanSide}-${difficulty}`;
  try {
    const [ai, demo] = await Promise.all([
      getPolicy(aiSide(), difficulty),
      getPolicy(humanSide, difficulty),
    ]);
    if (wanted !== `${humanSide}-${difficulty}`) return; // the player changed their mind while it loaded
    aiPolicy = ai.policy;
    demoPolicy = demo.policy;
    game ??= new Game(ai.model.game_config);
    showReady();
  } catch (error) {
    showOverlay(`Something went wrong loading the agent.\n${(error as Error).message}`);
  }
}

sideButtons.forEach((button) =>
  button.addEventListener("click", () => {
    humanSide = button.dataset.side as AgentName;
    button.blur(); // so Space doesn't "click" the button again
    setUp();
  }),
);

difficultyButtons.forEach((button) =>
  button.addEventListener("click", () => {
    difficulty = button.dataset.difficulty as Difficulty;
    button.blur();
    setUp();
  }),
);

function showOverlay(text: string) {
  overlayText.textContent = text;
  overlay.hidden = false;
}

function showReady() {
  state = "ready";
  observations = game!.resetRandom();
  snapshotPositions();
  accumulator = 0;
  const goal = humanSide === "prey"
    ? "You are the cyan prey. Stay alive for 30 seconds."
    : "You are the pink predator. Catch the prey within 30 seconds.";
  showOverlay(`${goal}\nOpponent: ${difficulty} AI ${aiSide()}\n\nPress Space to start`);
}

function startGame() {
  observations = game!.resetRandom();
  snapshotPositions();
  accumulator = 0;
  state = "playing";
  overlay.hidden = true;
}

function snapshotPositions() {
  const game = currentGame();
  previous = {
    predator: [...game.states.predator.position] as Vec2,
    prey: [...game.states.prey.position] as Vec2,
  };
}

// One step of the demo: both sides are played by the agents
function demoTick() {
  const game = currentGame();
  snapshotPositions();
  const actions = {
    [aiSide()]: aiPolicy(observations[aiSide()]),
    [humanSide]: demoPolicy(observations[humanSide]),
  } as PerAgent<number>;
  const result = game.step(actions);
  observations = result.observations;
  if (result.done) {
    observations = game.resetRandom();
    snapshotPositions();
  }
}

function tick() {
  const game = currentGame();
  snapshotPositions();
  const ai = aiSide();
  const actions = {
    [humanSide]: keyboardAction(),
    [ai]: aiPolicy(observations[ai]),
  } as PerAgent<number>;

  const result = game.step(actions);
  observations = result.observations;

  if (result.done) {
    state = "over";
    const seconds = (game.stepCount * DT).toFixed(1);
    const humanWon = (humanSide === "predator") === result.caught;
    const message = result.caught
      ? `Caught after ${seconds} s`
      : "The prey survived 30 s";
    showOverlay(`${humanWon ? "You win!" : "The AI wins."}\n${message}\n\nPress Space to play again`);
  }
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
const scale = canvas.width / ARENA_SIZE;

// World coordinates (+y up) to canvas pixels (+y down)
function toScreen([x, y]: Vec2): Vec2 {
  return [x * scale, canvas.height - y * scale];
}

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function draw(alpha: number) {
  const game = currentGame();
  ctx.fillStyle = COLOURS.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = COLOURS.obstacle;
  for (const [xMin, yMin, xMax, yMax] of game.obstacles) {
    const [left, top] = toScreen([xMin, yMax]);
    ctx.fillRect(left, top, (xMax - xMin) * scale, (yMax - yMin) * scale);
  }

  const moving = state === "playing" || (state === "ready" && !reduceMotion);
  const t = moving ? alpha : 1;
  const pos: PerAgent<Vec2> = {
    predator: toScreen(lerp(previous.predator, game.states.predator.position, t)),
    prey: toScreen(lerp(previous.prey, game.states.prey.position, t)),
  };

  if (game.visible) {
    ctx.strokeStyle = COLOURS.sightLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(...pos.predator);
    ctx.lineTo(...pos.prey);
    ctx.stroke();
  }

  for (const agent of ["prey", "predator"] as AgentName[]) {
    const radius = game.states[agent].radius * scale;
    ctx.fillStyle = COLOURS[agent];
    ctx.beginPath();
    ctx.arc(pos[agent][0], pos[agent][1], radius, 0, Math.PI * 2);
    ctx.fill();

    if (agent === humanSide && state !== "ready") {
      // A ring around the player so you can find yourself instantly
      ctx.strokeStyle = COLOURS[agent];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos[agent][0], pos[agent][1], radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const seconds = (game.stepCount * DT).toFixed(1);
  statusLeft.textContent = state === "ready" ? "Demo: agent vs agent" : `Time: ${seconds} s / 30 s`;
  statusRight.textContent = game.visible ? "In sight" : "Hidden";
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
function frame(now: number) {
  const elapsed = Math.min(now - lastFrame, 250); // avoid a burst of steps after a pause
  lastFrame = now;

  if (state === "playing") {
    accumulator += elapsed;
    while (accumulator >= STEP_MS && state === "playing") {
      tick();
      accumulator -= STEP_MS;
    }
  } else if (state === "ready" && !reduceMotion) {
    accumulator += elapsed;
    while (accumulator >= STEP_MS && state === "ready") {
      demoTick();
      accumulator -= STEP_MS;
    }
  }

  if (game) draw(accumulator / STEP_MS);
  requestAnimationFrame(frame);
}

function currentGame(): Game {
  if (!game) throw new Error("game not created yet");
  return game;
}

async function loadModel(name: string): Promise<ExportedModel> {
  const response = await fetch(`${import.meta.env.BASE_URL}models/${name}.json`);
  if (!response.ok) throw new Error(`couldn't load the ${name} model (${response.status})`);
  return response.json();
}

setUp();
requestAnimationFrame(frame);
showModelCard(document.querySelector<HTMLElement>("#model-card")!);
