---
title: Tokenade
description: Controlled token-cost payload generator using emoji carriers, variation selectors, and zero-width noise.
category: tools
order: 9
---

# Tokenade

Tokenade synthesises **high-token-cost strings** for stress testing.
Emoji carriers + variation selectors + zero-width noise compose into
controlled payload explosions: depth × breadth × repeats lets you
target a specific token budget you want to stress.

Reachable at `/tokenade`.

## When to use

- **Token-budget DoS testing.** Probe whether a target service
  handles a deliberately expensive input gracefully — or chokes,
  truncates, returns 5xx, or charges your account for the full
  prompt cost.
- **Tokenizer characterisation.** Different model tokenizers (cl100k,
  o200k, BPE variants) split emoji + variation-selector compounds
  very differently. The same Tokenade output produces 200 tokens on
  one tokenizer and 4,000 on another. Use the [Tokenizer](/guide/tokenizer/)
  visualiser alongside Tokenade to compare splits.
- **Context-window saturation.** When you want to crowd out a
  target's prior context with high-cost padding — for example to
  evict a system prompt under a known context-window cap.

## Configuration

- **Separator** — picks the joining glue:
  - **ZWNJ** (zero-width non-joiner) — invisible; tokenizes as a
    distinct token under most BPEs.
  - **ZWJ** (zero-width joiner) — invisible; sometimes folds
    adjacent codepoints into a single grapheme cluster.
  - **ZWSP** (zero-width space) — invisible; always its own token.
  - **None** — no separator, just the carrier glyphs.
- **Depth** — how deeply to nest variation selectors per carrier
  (each VS adds tokens but costs nothing visually).
- **Breadth** — how many distinct carriers to use.
- **Repeats** — how many times to repeat the inner pattern.

The displayed token-cost estimate updates live as you change
parameters.

## How to use

1. Pick a separator + depth + breadth + repeats. Start small (depth
   2, breadth 2, repeats 4) and watch the token-cost preview.
2. Click **Generate**. The output is the payload string plus a
   per-tokenizer token-count breakdown.
3. Copy and paste into your target's input. Most chat UIs render the
   string as a few visible glyphs; the model receives the full token
   count.

## Cautions

This tool exists for testing systems you own or are authorized to
test. Sending high-token-cost payloads to a third-party service can
trigger rate limits, account bans, or unintended billing.
