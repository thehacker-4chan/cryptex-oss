---
title: Gibberish lab
description: Dictionary-mapped gibberish + character-stripping for puzzle generation and corruption-tolerance tests.
category: tools
order: 8
---

# Gibberish lab

Two complementary modes:

1. **Generate consistent dictionary-mapped gibberish** — every input
   word becomes a deterministic gibberish word via a fixed mapping.
   Round-trips perfectly so puzzles can be authored, distributed, and
   solved.
2. **Strip characters** from text to produce puzzle variants — drop
   vowels, every Nth character, or random characters at a given rate.

Reachable at `/gibberish`.

## When to use

- **CTF puzzle authoring.** Generate a gibberish version of a phrase
  for a CTF clue; share the mapping table separately as the "key".
- **Corruption-tolerance evaluation.** Probe how a target model
  handles increasing input corruption. Strip 10% / 20% / 40% of
  characters and watch where comprehension breaks. Useful for
  evaluating models' OCR / noisy-input robustness.
- **Light obfuscation.** A dictionary-mapped gibberish output is
  human-illegible but mechanically reversible — useful as a
  classifier-evasion layer when combined with a teaching prompt
  ("here's the mapping; decode and answer").

## How to use

### Generate mode

1. Paste the source text.
2. Pick the dictionary size (larger dictionary = more diverse
   gibberish tokens).
3. Click **Generate**. The output is the gibberish-encoded text plus
   a table of word ↔ gibberish-word mappings.

### Strip mode

1. Paste the source text.
2. Pick the strip strategy: drop vowels, drop every Nth character,
   or random drop at probability P.
3. Click **Strip**. The output is the corrupted text — copy and
   paste into your target's prompt.

## Pairings

- **Bijection** at `/bijection` is the same idea at the character
  level instead of word level.
- **Mutation lab** at `/fuzzer` adds invisible noise on top of
  Strip-mode output for layered corruption.
- **Decode** at `/decode` runs the reverse direction — paste a
  captured gibberish blob and see if any registered detector
  recognises the encoding.
