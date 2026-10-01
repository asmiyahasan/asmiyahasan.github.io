// A small SVG line chart of the agent's progress, with a hover readout.

import type { Evaluation } from "./opponents";

// One line: how often the agent avoids losing to a perfect player. The chart's
// caption names it, so there's no legend.
const SERIES = [
  { key: "drawsPerfect" as const, label: "Doesn't lose to a perfect player", colour: "#ec4790", dash: "" },
];

const HEIGHT = 190;
const PAD = { top: 12, right: 12, bottom: 26, left: 38 };
const SVG_NS = "http://www.w3.org/2000/svg";

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export function renderChart(svg: SVGSVGElement, tooltip: HTMLElement, history: Evaluation[]): void {
  const width = Math.max(svg.clientWidth, 260);
  svg.setAttribute("viewBox", `0 0 ${width} ${HEIGHT}`);
  svg.replaceChildren();

  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const maxGames = Math.max(100, ...history.map((h) => h.games));
  const x = (games: number) => PAD.left + (games / maxGames) * plotW;
  const y = (share: number) => PAD.top + (1 - share) * plotH;

  // Recessive grid and axis labels
  for (const share of [0, 0.5, 1]) {
    svg.append(el("line", { x1: PAD.left, x2: width - PAD.right, y1: y(share), y2: y(share), class: "grid" }));
    const label = el("text", { x: PAD.left - 8, y: y(share) + 4, "text-anchor": "end", class: "axis" });
    label.textContent = `${share * 100}%`;
    svg.append(label);
  }
  const xLabel = el("text", { x: width - PAD.right, y: HEIGHT - 6, "text-anchor": "end", class: "axis" });
  xLabel.textContent = `${maxGames.toLocaleString()} games`;
  svg.append(xLabel);
  const zero = el("text", { x: PAD.left, y: HEIGHT - 6, class: "axis" });
  zero.textContent = "0";
  svg.append(zero);

  if (history.length === 0) return;

  for (const s of SERIES) {
    const points = history.map((h) => `${x(h.games)},${y(h[s.key])}`).join(" ");
    svg.append(el("polyline", {
      points, fill: "none", stroke: s.colour, "stroke-width": 2,
      "stroke-dasharray": s.dash, "stroke-linejoin": "round", "stroke-linecap": "round",
    }));
    const last = history[history.length - 1];
    svg.append(el("circle", {
      cx: x(last.games), cy: y(last[s.key]), r: 4, fill: s.colour, stroke: "#28282d", "stroke-width": 2,
    }));
  }

  // Hover: a crosshair snapping to the nearest measurement, with both values
  const crosshair = el("line", { y1: PAD.top, y2: PAD.top + plotH, class: "crosshair", visibility: "hidden" });
  svg.append(crosshair);
  const hit = el("rect", { x: PAD.left, y: 0, width: plotW, height: HEIGHT, fill: "transparent" });
  svg.append(hit);

  hit.addEventListener("pointermove", (event) => {
    const box = svg.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * width;
    const nearest = history.reduce((a, b) => (Math.abs(x(b.games) - px) < Math.abs(x(a.games) - px) ? b : a));
    crosshair.setAttribute("x1", String(x(nearest.games)));
    crosshair.setAttribute("x2", String(x(nearest.games)));
    crosshair.setAttribute("visibility", "visible");
    tooltip.innerHTML =
      `<strong>After ${nearest.games.toLocaleString()} games</strong>` +
      `<span>Didn't lose ${Math.round(nearest.drawsPerfect * 100)}% of games</span>`;
    tooltip.hidden = false;
    const left = (x(nearest.games) / width) * box.width;
    tooltip.style.left = `${Math.min(Math.max(left, 90), box.width - 90)}px`;
  });
  hit.addEventListener("pointerleave", () => {
    crosshair.setAttribute("visibility", "hidden");
    tooltip.hidden = true;
  });
}
