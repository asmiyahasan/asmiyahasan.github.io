// "Teach an agent tic-tac-toe": the visitor plays X, the agent plays O, and the
// agent learns from every game. It can also practise against itself.

import { isOver, play, winner, winningLine } from "./board";
import type { Board, Player } from "./board";
import { LearningAgent, practiceGame } from "./agent";
import { evaluate } from "./opponents";
import type { Evaluation } from "./opponents";
import { renderChart } from "./chart";

const HUMAN: Player = 1; // X
const AGENT: Player = 2; // O
const THINKING_MS = 700; // how long the agent's estimates stay on screen before it moves
const PRACTICE_GAMES = 250;
const PRACTICE_PER_FRAME = 10; // spread practice over frames so the chart visibly climbs
const EVALUATE_EVERY = 50;

export function setUpTicTacToe(root: HTMLElement): void {
  const $ = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;

  const boardEl = $<HTMLDivElement>(".ttt-board");
  const statusEl = $<HTMLParagraphElement>(".ttt-status");
  const tallyEl = $<HTMLParagraphElement>(".ttt-tally");
  const countEl = $<HTMLParagraphElement>(".ttt-count");
  const newGameButton = $<HTMLButtonElement>("#ttt-new");
  const practiseButton = $<HTMLButtonElement>("#ttt-practise");
  const forgetButton = $<HTMLButtonElement>("#ttt-forget");
  const thinkingToggle = $<HTMLInputElement>("#ttt-thinking");
  const lrInput = $<HTMLInputElement>("#ttt-lr");
  const lrOutput = $<HTMLOutputElement>("#ttt-lr-value");
  const explorationInput = $<HTMLInputElement>("#ttt-exploration");
  const explorationOutput = $<HTMLOutputElement>("#ttt-exploration-value");
  const chartSvg = $<SVGSVGElement>(".ttt-chart-area svg");
  const tooltip = $<HTMLDivElement>(".ttt-tooltip");

  const agent = new LearningAgent();
  const random = Math.random;
  const history: Evaluation[] = [];
  const tally = { you: 0, agent: 0, draws: 0 };

  let board: Board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let positions: Record<Player, Board[]> = { 1: [], 2: [] };
  let humanStarts = true;
  let busy = false; // agent thinking or practising: the board is locked

  // The 9 squares
  const cells = Array.from({ length: 9 }, (_, i) => {
    const button = document.createElement("button");
    button.className = "ttt-cell";
    button.addEventListener("click", () => humanMove(i));
    boardEl.append(button);
    return button;
  });

  function render(estimates?: Map<number, number>) {
    const line = winningLine(board);
    cells.forEach((cell, i) => {
      const mark = board[i];
      cell.classList.toggle("is-x", mark === HUMAN);
      cell.classList.toggle("is-o", mark === AGENT);
      cell.classList.toggle("is-winning", line?.includes(i) ?? false);
      const estimate = estimates?.get(i);
      if (mark !== 0) {
        cell.textContent = mark === HUMAN ? "X" : "O";
        cell.setAttribute("aria-label", `Square ${i + 1}: ${mark === HUMAN ? "X" : "O"}`);
      } else if (estimate !== undefined) {
        cell.innerHTML = `<span class="ttt-estimate">${Math.round(estimate * 100)}</span>`;
        cell.setAttribute("aria-label", `Square ${i + 1}: the agent rates this ${Math.round(estimate * 100)}`);
      } else {
        cell.textContent = "";
        cell.setAttribute("aria-label", `Square ${i + 1}: empty`);
      }
      cell.disabled = busy || mark !== 0 || isOver(board);
    });
    countEl.textContent =
      `Learned from ${agent.gamesLearned.toLocaleString()} games ` +
      `and has an opinion on ${agent.positionsKnown.toLocaleString()} positions.`;
    tallyEl.textContent = `You ${tally.you}, agent ${tally.agent}, draws ${tally.draws}`;
    practiseButton.disabled = busy;
    forgetButton.disabled = busy;
    newGameButton.disabled = busy;
  }

  function measure() {
    const result = evaluate(agent, random, 200);
    if (history.at(-1)?.games === result.games) history[history.length - 1] = result;
    else history.push(result);
    renderChart(chartSvg, tooltip, history);
  }

  function newGame() {
    board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    positions = { 1: [], 2: [] };
    statusEl.textContent = humanStarts ? "Your move. You're X." : "The agent goes first this time.";
    render();
    if (!humanStarts) agentMove();
  }

  function humanMove(i: number) {
    if (busy || board[i] !== 0 || isOver(board)) return;
    board = play(board, i, HUMAN);
    positions[HUMAN].push(board);
    if (!finishIfOver()) agentMove();
    else render();
  }

  async function agentMove() {
    busy = true;
    if (thinkingToggle.checked) {
      // Show the agent's estimate for each empty square before it commits
      const estimates = new Map(agent.options(board, AGENT).map((o) => [o.move, o.value]));
      statusEl.textContent = "Thinking. Numbers show how good it rates each square, out of 100.";
      render(estimates);
      await new Promise((resolve) => setTimeout(resolve, THINKING_MS));
    }
    const { move, explored } = agent.chooseMove(board, AGENT, random);
    board = play(board, move, AGENT);
    positions[AGENT].push(board);
    busy = false;
    if (!finishIfOver()) {
      statusEl.textContent = explored
        ? "It tried a random move to explore. Your turn."
        : "Your turn.";
    }
    render();
  }

  /** If the game has ended: learn from it, update the score and chart. */
  function finishIfOver(): boolean {
    if (!isOver(board)) return false;
    const w = winner(board);
    agent.learn({ positions, winner: w as 0 | Player });
    if (w === HUMAN) {
      tally.you++;
      statusEl.textContent = "You win. The agent has learned from that. Try the same trick again?";
    } else if (w === AGENT) {
      tally.agent++;
      statusEl.textContent = "The agent wins.";
    } else {
      tally.draws++;
      statusEl.textContent = "A draw.";
    }
    humanStarts = !humanStarts;
    measure();
    return true;
  }

  function practise() {
    busy = true;
    render();
    let played = 0;
    const step = () => {
      for (let i = 0; i < PRACTICE_PER_FRAME && played < PRACTICE_GAMES; i++, played++) {
        practiceGame(agent, random);
        if (agent.gamesLearned % EVALUATE_EVERY === 0) measure();
      }
      statusEl.textContent = `Practising against itself: ${played} of ${PRACTICE_GAMES} games.`;
      render();
      if (played < PRACTICE_GAMES) {
        requestAnimationFrame(step);
      } else {
        busy = false;
        measure();
        newGame();
        statusEl.textContent = `Finished ${PRACTICE_GAMES} practice games. ` + statusEl.textContent;
      }
    };
    requestAnimationFrame(step);
  }

  function forget() {
    agent.forget();
    history.length = 0;
    tally.you = tally.agent = tally.draws = 0;
    humanStarts = true;
    measure();
    newGame();
    statusEl.textContent = "It's forgotten everything. " + statusEl.textContent;
  }

  function syncSettings() {
    agent.learningRate = Number(lrInput.value);
    agent.exploration = Number(explorationInput.value);
    lrOutput.textContent = agent.learningRate.toFixed(2);
    explorationOutput.textContent = `${Math.round(agent.exploration * 100)}%`;
  }

  newGameButton.addEventListener("click", newGame);
  practiseButton.addEventListener("click", practise);
  forgetButton.addEventListener("click", forget);
  lrInput.addEventListener("input", syncSettings);
  explorationInput.addEventListener("input", syncSettings);
  window.addEventListener("resize", () => renderChart(chartSvg, tooltip, history));

  syncSettings();
  measure();
  newGame();
}
