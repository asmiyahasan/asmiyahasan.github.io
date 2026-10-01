import { describe, expect, test } from "vitest";
import sample from "./modelCard.sample.json";
import { generationName, renderModelCard, shortNumber } from "./modelCard";
import type { ModelCard } from "./modelCard";

describe("model card", () => {
  test("names the generation from the model path", () => {
    expect(generationName("models/selfplay_memory/prey/gen_010.zip")).toBe("generation 10");
    expect(generationName("models/x/final.zip")).toBe("final.zip");
  });

  test("shortens big numbers", () => {
    expect(shortNumber(2_129_920)).toBe("2.1M");
    expect(shortNumber(3_000_000)).toBe("3M");
    expect(shortNumber(16_384)).toBe("16k");
  });

  test("renders both agents and links to the release", () => {
    const html = renderModelCard(sample as unknown as ModelCard);
    expect(html).toContain("releases/tag/models-v1");
    expect(html).toContain("Predator");
    expect(html).toContain("Prey");
    expect(html).toContain("generation 10");
    expect(html).toContain("86.7%");
    expect(html).toContain("96.7%");
  });
});
