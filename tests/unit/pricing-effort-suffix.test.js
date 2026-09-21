import { describe, it, expect } from "vitest";
import { getPricingForModel, calculateCostFromTokens, MODEL_PRICING } from "open-sse/providers/pricing.js";

describe("getPricingForModel — effort-annotated ids price at the base model rate", () => {
  it("parenthesized effort suffix resolves to the exact base entry", () => {
    // MODEL_PRICING has exact "gpt-5.6-sol" @ 4/20/0.4 (official OpenAI Standard);
    // the pattern fallback (gpt-5.6-* @ 2.5/15) previously won because the
    // annotation broke the lookup.
    const p = getPricingForModel("codex", "gpt-5.6-sol(xhigh)");
    expect(p).toEqual(MODEL_PRICING["gpt-5.6-sol"]);
    expect(p.input).toBe(4);
    expect(p.output).toBe(20);
  });

  it("hyphenated effort suffix resolves identically to the bare model id", () => {
    // "gpt-5.5" itself has no exact MODEL_PRICING entry (separate gap); both ids
    // must at least resolve the same way, via the gpt-5* pattern.
    const annotated = getPricingForModel("codex", "gpt-5.5-xhigh");
    const bare = getPricingForModel("codex", "gpt-5.5");
    expect(annotated).toEqual(bare);
    expect(annotated.input).toBe(1.25); // gpt-5* pattern
  });

  it("effort-annotated id with no exact base entry still uses patterns", () => {
    const p = getPricingForModel("codex", "gpt-5.5.9-sol(xhigh)");
    expect(p).toBeTruthy(); // gpt-5* pattern, not null
    expect(p.input).toBe(1.25);
  });

  it("explicitly priced effort variants keep their own entry", () => {
    // "gpt-5.1-codex-mini-high" is a real, separately-priced variant: 2/8.
    const p = getPricingForModel("codex", "gpt-5.1-codex-mini-high");
    expect(p.input).toBe(2);
    expect(p.output).toBe(8);
  });

  it("versioned model names are not stripped as effort suffixes", () => {
    // "-0902" is a date suffix, not an effort level — must not be stripped.
    const p = getPricingForModel("alibaba-sg", "qwen3.8-max-0902");
    expect(p).toBeTruthy();
    // resolves via qwen* pattern either way; assert it did not become null
    const bare = getPricingForModel("alibaba-sg", "qwen3.8-max");
    expect(p).toEqual(bare);
  });

  it("cost math on an annotated row matches the base-model rate", () => {
    const tokens = { prompt_tokens: 1000000, cached_tokens: 800000, completion_tokens: 50000 };
    const annotated = calculateCostFromTokens(tokens, getPricingForModel("codex", "gpt-5.6-sol(max)"));
    const plain = calculateCostFromTokens(tokens, getPricingForModel("codex", "gpt-5.6-sol"));
    expect(annotated).toBe(plain);
    // (1M - 800K) * 4 + 800K * 0.4 + 50K * 20 = 0.8 + 0.32 + 1.0 = $2.12
    expect(annotated).toBeCloseTo(2.12, 6);
  });
});
