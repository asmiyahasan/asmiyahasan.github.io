import { describe, expect, test } from "vitest";
import { play, positionKey, seededRandom, winner } from "./board";
import type { Board } from "./board";
import { LearningAgent, playGame, practiceGame } from "./agent";
import { evaluate, perfectPlayer, randomPlayer } from "./opponents";

const X = 1;
const O = 2;

describe("rules", () => {
  test("detects rows, columns and diagonals", () => {
    expect(winner([X, X, X, 0, O, O, 0, 0, 0])).toBe(X);
    expect(winner([O, X, 0, O, X, 0, O, 0, 0])).toBe(O);
    expect(winner([X, O, 0, O, X, 0, 0, 0, X])).toBe(X);
    expect(winner([X, O, X, X, O, O, O, X, X])).toBe(0);
  });

  test("refuses a move on a taken cell", () => {
    expect(() => play([X, 0, 0, 0, 0, 0, 0, 0, 0], 0, O)).toThrow();
  });
});

describe("symmetry", () => {
  test("rotations and reflections share a key", () => {
    const corner: Board = [X, 0, 0, 0, 0, 0, 0, 0, 0];
    const otherCorners: Board[] = [
      [0, 0, X, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, X, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, X],
    ];
    for (const board of otherCorners) expect(positionKey(board, X)).toBe(positionKey(corner, X));
  });

  test("different positions get different keys", () => {
    const corner: Board = [X, 0, 0, 0, 0, 0, 0, 0, 0];
    const centre: Board = [0, 0, 0, 0, X, 0, 0, 0, 0];
    expect(positionKey(corner, X)).not.toBe(positionKey(centre, X));
  });

  test("keys are from the mover's point of view", () => {
    const xView: Board = [X, O, 0, 0, 0, 0, 0, 0, 0];
    const oView: Board = [O, X, 0, 0, 0, 0, 0, 0, 0];
    expect(positionKey(xView, X)).toBe(positionKey(oView, O));
  });
});

describe("opponents", () => {
  test("the perfect player never loses to a random one", () => {
    const random = seededRandom(1);
    for (let i = 0; i < 300; i++) {
      const perfectIsX = i % 2 === 0;
      const game = perfectIsX
        ? playGame(perfectPlayer(random), randomPlayer(random))
        : playGame(randomPlayer(random), perfectPlayer(random));
      expect(game.winner).not.toBe(perfectIsX ? O : X);
    }
  });

  test("two perfect players always draw", () => {
    const random = seededRandom(2);
    for (let i = 0; i < 50; i++) {
      expect(playGame(perfectPlayer(random), perfectPlayer(random)).winner).toBe(0);
    }
  });
});

describe("learning agent", () => {
  test("a winning move is worth 1 and an unseen position 0.5", () => {
    const agent = new LearningAgent();
    expect(agent.value([X, X, X, O, O, 0, 0, 0, 0], X)).toBe(1);
    expect(agent.value([X, 0, 0, 0, 0, 0, 0, 0, 0], X)).toBe(0.5);
  });

  test("takes a win once it has seen one", () => {
    const agent = new LearningAgent();
    const board: Board = [X, X, 0, O, O, 0, 0, 0, 0];
    const { move } = agent.chooseMove(board, X, seededRandom(3), false);
    expect(move).toBe(2); // completing the top row is worth 1 straight away
  });

  test("learns to block after losing the same way", () => {
    const agent = new LearningAgent();
    agent.learningRate = 0.5;
    // O (the agent) ignores X's top row and loses
    const before: Board = [X, X, 0, O, 0, 0, 0, 0, 0];
    const lost = { positions: { 1: [play(before, 2, X)], 2: [play([X, X, 0, 0, 0, 0, 0, 0, 0], 3, O)] }, winner: X as 1 };
    for (let i = 0; i < 3; i++) agent.learn(lost);
    const blocking = agent.value(play([X, X, 0, 0, 0, 0, 0, 0, 0], 2, O), O);
    const notBlocking = agent.value(play([X, X, 0, 0, 0, 0, 0, 0, 0], 3, O), O);
    expect(notBlocking).toBeLessThan(blocking);
  });

  test("gets much better with practice", () => {
    const random = seededRandom(4);
    const agent = new LearningAgent();
    const before = evaluate(agent, random, 200);
    for (let i = 0; i < 3000; i++) practiceGame(agent, random);
    const after = evaluate(agent, random, 200);

    expect(after.beatsRandom).toBeGreaterThan(before.beatsRandom + 0.1);
    expect(after.drawsPerfect).toBeGreaterThan(0.8);
  });

  test("forgetting resets everything", () => {
    const agent = new LearningAgent();
    practiceGame(agent, seededRandom(5));
    agent.forget();
    expect(agent.gamesLearned).toBe(0);
    expect(agent.positionsKnown).toBe(0);
  });
});
