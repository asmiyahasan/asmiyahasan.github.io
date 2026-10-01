// Run a trained network exported by predprey/export.py.
// The TypeScript version of `forward` and `choose_action` in export.py.

import type { GameConfig } from "./game";
import { OBS_SIZE } from "./observations";
import { NUM_ACTIONS } from "./physics";

export interface Layer {
  weights: number[][]; // [out][in]
  bias: number[];
  activation: "tanh" | "relu" | "none";
}

export interface TestVector {
  obs: number[];
  logits: number[];
  action: number;
}

export interface ExportedModel {
  format_version: number;
  agent: "predator" | "prey";
  obs_size: number;
  num_actions: number;
  layers: Layer[];
  game_config: GameConfig;
  metadata: Record<string, unknown>;
  test_vectors: TestVector[];
}

/** A policy takes an observation and returns an action, just like in Python. */
export type Policy = (obs: ArrayLike<number>) => number;

/** Run the network: observation in, one score ("logit") per action out. */
export function forward(layers: Layer[], obs: ArrayLike<number>): Float32Array {
  let x = Float32Array.from(obs);
  for (const layer of layers) {
    const out = new Float32Array(layer.bias.length);
    for (let i = 0; i < out.length; i++) {
      const row = layer.weights[i];
      let sum = 0;
      for (let j = 0; j < x.length; j++) sum += row[j] * x[j];
      sum += layer.bias[i];
      if (layer.activation === "tanh") sum = Math.tanh(sum);
      else if (layer.activation === "relu") sum = Math.max(sum, 0);
      out[i] = sum;
    }
    x = out;
  }
  return x;
}

/** The index of the largest value (the first one, if there's a tie, like NumPy). */
export function argmax(values: ArrayLike<number>): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return best;
}

/** Check a model file is one this game can run, then turn it into a policy. */
export function loadPolicy(model: ExportedModel): Policy {
  if (model.format_version !== 1) {
    throw new Error(`unsupported model format: ${model.format_version}`);
  }
  if (model.obs_size !== OBS_SIZE || model.num_actions !== NUM_ACTIONS) {
    throw new Error(
      `model expects ${model.obs_size} inputs and ${model.num_actions} actions, ` +
        `but the game has ${OBS_SIZE} and ${NUM_ACTIONS}`,
    );
  }
  return (obs) => argmax(forward(model.layers, obs));
}
