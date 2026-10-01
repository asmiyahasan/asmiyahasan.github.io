// Tic-tac-toe rules, plus the symmetry trick that makes learning 8x faster.

export type Player = 1 | 2; // 1 = X, 2 = O
export type Cell = 0 | Player; // 0 = empty
export type Board = Cell[]; // 9 cells, row by row from the top left

export const EMPTY_BOARD: Board = [0, 0, 0, 0, 0, 0, 0, 0, 0];

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6], // diagonals
];

export function other(player: Player): Player {
  return player === 1 ? 2 : 1;
}

/** The player with three in a row, or 0 if nobody has one. */
export function winner(board: Board): Cell {
  for (const [a, b, c] of LINES) {
    if (board[a] !== 0 && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return 0;
}

/** The winning line (three cell indexes), or null. */
export function winningLine(board: Board): number[] | null {
  return LINES.find(([a, b, c]) => board[a] !== 0 && board[a] === board[b] && board[a] === board[c]) ?? null;
}

export function isFull(board: Board): boolean {
  return board.every((cell) => cell !== 0);
}

export function isOver(board: Board): boolean {
  return winner(board) !== 0 || isFull(board);
}

export function legalMoves(board: Board): number[] {
  return board.flatMap((cell, i) => (cell === 0 ? [i] : []));
}

export function play(board: Board, move: number, player: Player): Board {
  if (board[move] !== 0) throw new Error(`cell ${move} is already taken`);
  const next = board.slice();
  next[move] = player;
  return next;
}

// The 8 ways to rotate or reflect a 3x3 board. Each is a list saying which old
// cell ends up in each new position. Boards that are rotations or reflections
// of each other are really the same position, so the agent learns them once.
function permutation(map: (row: number, col: number) => [number, number]): number[] {
  return Array.from({ length: 9 }, (_, i) => {
    const [r, c] = map(Math.floor(i / 3), i % 3);
    return r * 3 + c;
  });
}

const SYMMETRIES: number[][] = [
  permutation((r, c) => [r, c]), // as is
  permutation((r, c) => [2 - c, r]), // rotate 90°
  permutation((r, c) => [2 - r, 2 - c]), // rotate 180°
  permutation((r, c) => [c, 2 - r]), // rotate 270°
  permutation((r, c) => [r, 2 - c]), // mirror left-right
  permutation((r, c) => [2 - r, c]), // mirror top-bottom
  permutation((r, c) => [c, r]), // mirror along the main diagonal
  permutation((r, c) => [2 - c, 2 - r]), // mirror along the other diagonal
];

/**
 * A key for the position as seen by `player`: "m" for my pieces, "t" for
 * theirs, "." for empty. All 8 rotations and reflections share one key, and so
 * do X's and O's views of equivalent positions.
 */
export function positionKey(board: Board, player: Player): string {
  const view = board.map((cell) => (cell === 0 ? "." : cell === player ? "m" : "t"));
  let best = "";
  for (const symmetry of SYMMETRIES) {
    const key = symmetry.map((i) => view[i]).join("");
    if (best === "" || key < best) best = key;
  }
  return best;
}

/** A small seeded random number generator (mulberry32), so tests are repeatable. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickRandom<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}
