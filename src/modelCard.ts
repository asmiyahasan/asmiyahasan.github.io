// The "About the agents" panel: reads public/model_card.json (published with
// every model release) and describes the champion agents playing on Hard.

export const RELEASES_URL = "https://github.com/asmiyahasan/predator-prey/releases/tag/";

interface GateResults {
  vs_fleer?: number;
  vs_chaser?: number;
  improvement?: number;
}

interface AgentCard {
  source_model: string;
  promoted_in_version: number;
  trained_steps: number | null;
  gate_results: GateResults;
}

export interface ModelCard {
  version: number;
  tag: string;
  released_from_history: { at: string };
  agents: { predator: AgentCard; prey: AgentCard };
}

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function percent(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

/** "models/selfplay_memory/prey/gen_010.zip" -> "generation 10" */
export function generationName(sourceModel: string): string {
  const match = sourceModel.match(/gen_0*(\d+)/);
  return match ? `generation ${match[1]}` : sourceModel.split("/").pop() ?? sourceModel;
}

/** 2_400_000 -> "2.4M" */
export function shortNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function describeAgent(side: "predator" | "prey", agent: AgentCard): string {
  const r = agent.gate_results;
  const facts: string[] = [];
  if (agent.trained_steps) facts.push(`${shortNumber(agent.trained_steps)} training steps`);
  if (side === "predator" && r.vs_fleer !== undefined) {
    facts.push(`catches a scripted fleeing bot ${percent(r.vs_fleer)} of the time`);
  }
  if (side === "prey" && r.vs_chaser !== undefined) {
    facts.push(`escapes a scripted chasing bot ${percent(r.vs_chaser)} of the time`);
  }
  if (r.improvement !== undefined) {
    facts.push(`${r.improvement >= 0 ? "+" : ""}${(r.improvement * 100).toFixed(1)} points over the previous champion`);
  }
  return `
    <li>
      <span class="card-agent card-${side}">${side === "predator" ? "Predator" : "Prey"}</span>
      ${escape(generationName(agent.source_model))} of self-play, champion since v${agent.promoted_in_version}.
      <span class="card-facts">${escape(facts.join(" · "))}</span>
    </li>`;
}

export function renderModelCard(card: ModelCard): string {
  const date = new Date(card.released_from_history.at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return `
    <h2>About the Hard agents</h2>
    <p class="card-summary">
      Champion models
      <a href="${RELEASES_URL}${encodeURIComponent(card.tag)}" target="_blank" rel="noopener">v${card.version}</a>,
      released ${escape(date)}. A new model only replaces these after beating them in
      300 evaluation games and passing every parity test against the Python training code.
    </p>
    <ul class="card-agents">
      ${describeAgent("predator", card.agents.predator)}
      ${describeAgent("prey", card.agents.prey)}
    </ul>`;
}

/** Fetch the card and fill in the panel. If anything is missing, the panel just stays hidden. */
export async function showModelCard(container: HTMLElement): Promise<void> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}model_card.json`);
    if (!response.ok) return;
    container.innerHTML = renderModelCard(await response.json());
    container.hidden = false;
  } catch {
    // No card is fine: the game works without it
  }
}
