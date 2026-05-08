---
title: Tokenizer
description: Visualise how target models segment your text — UTF-8, words, cl100k, o200k, p50k, r50k.
category: tools
order: 10
---

# Tokenizer

The Tokenizer visualiser shows **how target models segment your text
into tokens**. Different engines split the same string very
differently; understanding which engine your target uses is a
foundational input to every other red-team workflow.

Reachable at `/tokenizer`.

## Engines

- **UTF-8 bytes** — raw byte view. Useful for debugging multibyte
  encoding issues and zero-width-character placement.
- **Words** — naive whitespace split. Reference for "what a human
  would think the segmentation is".
- **cl100k** — the BPE tokenizer used by GPT-3.5 and GPT-4 family.
- **o200k** — the BPE tokenizer used by GPT-4o and successors.
- **p50k_edit** — the legacy edit-mode tokenizer.
- **r50k_base** — the legacy base tokenizer.

For Anthropic / Google / Meta tokenizers, the byte and word views
plus cl100k/o200k cover most heuristics — but for production
characterisation use the model's own logprobs API.

## How to use

1. Paste your text.
2. Pick an engine. The view updates immediately, highlighting each
   token boundary with alternating colours.
3. Hover a token to see its id, byte range, and what it decodes to
   in isolation.
4. Toggle engines side-by-side to compare segmentations.

## When to use

- **Pre-flight your fuzzer output.** Before sending a corpus from
  the [Mutation lab](/guide/fuzzer/) to a target, eyeball one variant
  in the matching tokenizer. Confirms zero-width injections actually
  break tokens (they often do — but verify).
- **Glitch-token spotting.** Paste a candidate from the
  [Glitch token detector](/guide/redteam-workbenches/#glitch-token-detector)
  workbench to see how the tokenizer represents it. Useful for
  understanding why a single rare token destabilises generation.
- **Budget planning.** Count tokens for a prompt before spending
  API calls. The cl100k / o200k counters are the same numbers
  OpenAI charges by.
- **Tokenade calibration.** Tune Tokenade depth/breadth/repeats by
  pasting the output here and reading the count under the target's
  tokenizer.

## Privacy

Everything runs in your browser via the `gpt-tokenizer` package
encodings — no input ever leaves the page.
