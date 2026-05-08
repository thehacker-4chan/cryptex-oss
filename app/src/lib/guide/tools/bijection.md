---
title: Bijection alphapr
description: Character-to-token substitution prompts that teach the model an "alphapr" language.
category: tools
order: 6
---

# Bijection alphapr

Bijection generates **character-to-token substitution mappings** and
wraps your input in a teaching prompt — "learn my language called
alphapr". Each variant ships an alphabet table the model is asked to
adopt, then asks the question in alphapr-encoded form. Multiple
variants per run for research-grade prompt fuzzing.

## When to use

- **Lexical-trigger evasion.** Content classifiers and token-level
  refusal detectors key on the literal trigger word in the prompt.
  Bijection breaks that signal — the trigger is encoded into a
  per-prompt alphabet the classifier has never seen.
- **In-context-learning evaluation.** Probes whether the target
  reliably internalises the supplied mapping. Strong instruction-
  following models will decode and answer; weaker ones treat the
  alphapr-encoded text as gibberish.
- **Multi-variant fuzzing.** Each run produces several differently-
  shuffled mappings, so you can search for one the target actually
  adopts. Most aren't transferable across models.

## How to use

1. Paste your seed prompt (the question the target should ultimately
   answer).
2. Pick the variant count.
3. Optionally adjust the teaching-prompt template — you can swap the
   "alphapr" name for any plausible language label.
4. Click **Generate**. Each variant is a complete prompt: the
   teaching frame, the alphabet table, then the encoded question.
5. Copy a variant into your target's chat (or paste it as the seed
   in PromptCraft — pair with the `roleplay` technique for compound
   lift, then send the result to the [Probe Lab](/guide/redteam-workbenches/)).

## What you'll see

Each variant is several hundred tokens long because the alphabet
table itself takes space. Higher temperature in your target call
helps it commit to decoding rather than refusing on the unfamiliar
input. If a variant lands a refusal, retry with a different
mapping — the substitution alphabet is the entire signal.

The technique is published and increasingly alignment-trained against
on frontier models, so use it as one layer in a composite rather
than a stand-alone elicitation.
