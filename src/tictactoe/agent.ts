// A tabular reinforcement learning agent for tic-tac-toe: the method from
// chapter 1 of Sutton & Barto's "Reinforcement Learning: An Introduction".
//
// The agent keeps a table with one number per position: its estimate of how
// good that position is for the player who just moved there (1 = a sure win,
// 0.5 = a draw, 0 = a sure loss). Positions it has never seen start at 0.5.
//
// To move, it looks at every position it could move to and picks the one with
// the highest value, except sometimes (the "exploration" rate) it tries a
// random move instead, to discover things it would otherwise never try.
//
// After each game it walks back through the positions each player moved to,
// nudging each one's value towards the value of the position that came next
// (and the last one towards the result). How big the nudge is: the learning rate.

import { isFull, legalMoves, other, pickRandom, play, positionKey, winner } from "./board";
import type { Board, Player } from "./board";

export interface MoveOption {
  move: number;
  value: number;
}

export interface GameRecord {
  // For each player, the positions they moved to, in order
  positions: Record<Player, Board[]>;
  winner: 0 | Player;
}

export class LearningAgent {
  learningRate = 0.3;
  exploration = 0.1;
  gamesLearned = 0;
  private values = new Map<string, number>();

  /** How good this position is for `player`, who has just moved into it. */
  value(board: Board, player: Player): number {
    const w = winner(board);
    if (w === player) return 1;
    if (w !== 0) return 0;
    if (isFull(board)) return 0.5;
    return this.values.get(positionKey(board, player)) ?? 0.5;
  }

  /** Every legal move with the agent's estimate of where it leads. */
  options(board: Board, player: Player): MoveOption[] {
    return legalMoves(board).map((move) => ({
      move,
      value: this.value(play(board, move, player), player),
    }));
  }

  /** Pick a move. Returns whether it was a random, exploratory one. */
  chooseMove(
    board: Board,
    player: Player,
    random: () => number,
    explore = true,
  ): { move: number; explored: boolean } {
    const options = this.options(board, player);
    if (explore && random() < this.exploration) {
      return { move: pickRandom(options, random).move, explored: true };
    }
    const best = Math.max(...options.map((o) => o.value));
    const ties = options.filter((o) => o.value >= best - 1e-9);
    return { move: pickRandom(ties, random).move, explored: false };
  }

  /** Learn from a finished game, from both players' points of view. */
  learn(game: GameRecord): void {
    for (const player of [1, 2] as Player[]) {
      const result = game.winner === player ? 1 : game.winner === 0 ? 0.5 : 0;
      let target = result;
      const positions = game.positions[player];
      for (let i = positions.length - 1; i >= 0; i--) {
        const board = positions[i];
        if (winner(board) !== 0 || isFull(board)) {
          target = this.value(board, player); // finished positions have fixed values
          continue;
        }
        const key = positionKey(board, player);
        const old = this.values.get(key) ?? 0.5;
        const updated = old + this.learningRate * (target - old);
        this.values.set(key, updated);
        target = updated;
      }
    }
    this.gamesLearned += 1;
  }

  /** How many different positions it has an opinion about. */
  get positionsKnown(): number {
    return this.values.size;
  }

  forget(): void {
    this.values.clear();
    this.gamesLearned = 0;
  }
}

export type Chooser = (board: Board, player: Player) => number;

/** Play one full game between two move-choosers, recording every position. */
export function playGame(x: Chooser, o: Chooser, first: Player = 1): GameRecord {
  let board: Board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const positions: Record<Player, Board[]> = { 1: [], 2: [] };
  let player = first;
  while (winner(board) === 0 && !isFull(board)) {
    const move = (player === 1 ? x : o)(board, player);
    board = play(board, move, player);
    positions[player].push(board);
    player = other(player);
  }
  return { positions, winner: winner(board) as 0 | Player };
}

/** The agent plays itself once (with exploration) and learns from the game. */
export function practiceGame(agent: LearningAgent, random: () => number): void {
  const chooser: Chooser = (board, player) => agent.chooseMove(board, player, random).move;
  agent.learn(playGame(chooser, chooser, random() < 0.5 ? 1 : 2));
}
