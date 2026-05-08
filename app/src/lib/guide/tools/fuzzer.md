---
title: Mutation lab (Fuzzer)
description: Character-level prompt fuzzing — zero-width, Unicode noise, whitespace chaos, homoglyph, Zalgo, transform pipelines.
category: tools
order: 7
---

# Mutation lab

The Mutation lab generates up to **500 mutated variants from a single
seed** using configurable strategies. It's the complement to
[PromptCraft](/guide/promptcraft/): PromptCraft does sentence-level
rewriting, the Mutation lab does character-level noise.

Reachable at `/fuzzer`.

## Strategies

Each strategy is a checkbox you can stack with the others:

- **Random Mix** — chains a 2–4 transform pipeline picked from the
  full transformer registry. Each variant runs the seed through a
  different pipeline.
- **Zero-width** — injects invisible characters (ZWNJ / ZWJ / ZWSP)
  inside words so tokenizers split differently while readers see no
  change.
- **Unicode noise** — adds combining marks (diacritics, modifiers)
  to characters. Visible ish (slight diacritical haze) but tokenizes
  very differently.
- **Whitespace chaos** — randomises spaces to NBSP, tabs, ideographic
  space. Some classifiers strip whitespace before scoring; this
  surfaces ones that don't.
- **Homoglyph substitution** — Latin to visually-identical Cyrillic /
  Greek codepoints. Pairs naturally with the
  [Anti-Classifier](/guide/anticlassifier/) `homoglyph_substitution`
  technique on text rewrites that still trigger lexical filters.
- **Zalgo** — heavy combining-mark stacking. Highly visible but
  tokenizes wildly; useful for stress-testing input-sanitization
  layers.

## Reproducibility

The Mutation lab is **seeded** — the same seed + same strategy stack
produces the same variants. Save the seed string for replicable
experiments; rotate it when you want fresh diversity.

## How to use

1. Paste your seed prompt.
2. Pick variant count (1–500).
3. Tick the strategies you want stacked. Start with one — Random Mix
   or Zero-width — and add more if the target reliably refuses on
   single-strategy variants.
4. Click **Generate**. Variants render in a table; each row has a
   copy button.
5. Pipe the corpus into your target evaluator of choice — for
   automated runs, see the [Probe lab](/guide/redteam-workbenches/#probe-lab)
   workbench in the red-team suite.

## When it helps

- **Token-level filters.** A filter that splits on whitespace and
  matches words against a blocklist gets defeated by ZWNJ-injection
  inside the trigger word.
- **Tokenizer stress tests.** Different tokenizer engines split
  Zalgo / NFD-decomposed text very differently. A 500-variant run
  surfaces the boundary where the target's tokenizer breaks.
- **Transferability search.** Sometimes one specific permutation
  bypasses a filter that 90% of permutations don't. The variant
  count buys you that needle in a haystack.

## When it doesn't

- **Semantic filters.** A filter that decodes-then-classifies sees
  through everything except true homoglyph + low-severity payloads.
- **Human review.** Anything visibly distorted (Zalgo, heavy
  combining marks) flags on first inspection. For human-review
  contexts pair with [PromptCraft](/guide/promptcraft/) instead.
