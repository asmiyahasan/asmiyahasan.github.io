// The yardsticks the agent is measured against: a player who moves at random,
// and a perfect player who never loses (found by searching every possible game).

import { isFull, legalMoves, other, pickRandom, play, winner } from "./board";
import type { Board, Player } from "./board";
import { playGame } from "./agent";
import type { Chooser, LearningAgent } from "./agent";

export function randomPlayer(random: () => number): Chooser {
  return (board) => pickRandom(legalMoves(board), random);
}

// Score of a position for the player about to move: 1 win, 0 draw, -1 loss,
// assuming both sides play perfectly from here. Remembered once worked out.
const memo = new Map<string, number>();

function score(board: Board, toMove: Player): number {
  const key = board.join("") + toMove;
  const known = memo.get(key);
  if (known !== undefined) return known;

  let result: number;
  const w = winner(board);
  if (w !== 0) result = w === toMove ? 1 : -1;
  else if (isFull(board)) result = 0;
  else result = Math.max(...legalMoves(board).map((m) => -score(play(board, m, toMove), other(toMove))));

  memo.set(key, result);
  return result;
}

export function perfectPlayer(random: () => number): Chooser {
  return (board, player) => {
    const scored = legalMoves(board).map((move) => ({
      move,
      score: -score(play(board, move, player), other(player)),
    }));
    const best = Math.max(...scored.map((s) => s.score));
    // Pick at random among equally good moves, so its games vary
    return pickRandom(scored.filter((s) => s.score === best), random).move;
  };
}

export interface Evaluation {
  games: number; // how many games the agent had learned from
  beatsRandom: number; // share of games won against a random player
  drawsPerfect: number; // share of games not lost against a perfect player
}

/** Measure the agent (no exploration, no learning) against both yardsticks. */
export function evaluate(agent: LearningAgent, random: () => number, games = 200): Evaluation {
  const greedy: Chooser = (board, player) => agent.chooseMove(board, player, random, false).move;
  const rand = randomPlayer(random);
  const perfect = perfectPlayer(random);

  let wins = 0;
  let notLost = 0;
  for (let i = 0; i < games; i++) {
    const agentIsX = i % 2 === 0; // take turns going first
    const vsRandom = agentIsX ? playGame(greedy, rand) : playGame(rand, greedy);
    if (vsRandom.winner === (agentIsX ? 1 : 2)) wins++;

    const vsPerfect = agentIsX ? playGame(greedy, perfect) : playGame(perfect, greedy);
    if (vsPerfect.winner !== (agentIsX ? 2 : 1)) notLost++;
  }
  return { games: agent.gamesLearned, beatsRandom: wins / games, drawsPerfect: notLost / games };
}
