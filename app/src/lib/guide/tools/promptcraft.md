---
title: PromptCraft
description: Parallel variant generation over the full technique registry.
category: tools
order: 4
---

# PromptCraft

PromptCraft turns a single seed prompt into N structurally distinct
variants in parallel, through any BYOK model. The technique picker
drives the full registry — 36 mutators, 8 classifier techniques, and
4 composites. For worked attack chains see the
[jailbreak bank](/guide/jailbreak-bank/).

## Technique picker

A searchable Combobox over the mutator + classifier + composite
registry. Type to filter by id, name, or description. Arrow keys
navigate, Enter picks. The selected technique's description renders
below the picker.

Category buckets you'll see in the dropdown:

- **Rewording** — `rephrase`, `obfuscate`, `multilingual`, `fragment`,
  `custom`.
- **Framing** — `roleplay`, `red_team_persona`, `ctf_framing`,
  `rfc_style`, `hypothetical_world`, `step_back`,
  `chain_of_verification`.
- **Authority / persuasion** — `pap_logical`, `pap_authority`,
  `many_shot`, `tap_seeder`.
- **Elicitation primitives** — `payload_split`, `cipher_encode_bypass`.
- **Classifier rewrites** — `circumlocution`, `metonymy`,
  `semantic_decomposition`, `technical_register`, `academic_framing`,
  `temporal_displacement`, `perplexity_raise`.
- **Composites** — `layered_mutation`, `grammar_constrained_output`,
  `multi_layer_attack`, `base64_smuggle`.

## Parallel variants

Set N (1–10) and temperature. PromptCraft issues N parallel requests
through the gateway, streams results back, and surfaces variants
side-by-side. Each variant renders with a copy button and a re-roll
affordance.

Higher temperature (0.9–1.2) increases structural diversity per call
— a single technique run at high temperature produces genuinely
distinct rewrites rather than near-duplicates. Lower temperature
(0.2–0.5) produces tight, on-spec rewrites.

## Workflow — composing multi-step attacks

A common loop: PromptCraft generates seed candidates, you test the
strongest in chat or a workbench.

```
1. Seed prompt X -> PromptCraft
2. Pick obfuscate, N=5, temperature 1.2
3. Review 5 variants; pick the strongest rewrite
4. Paste the picked variant into a new chat message (or the Probe Lab)
5. (Optional) Add a slash command layer — e.g. /roleplay before sending
```

For higher compound lift, swap single-technique picks for
`multi_layer_attack` or `layered_mutation` — each variant is then a
3-sub-call composite, so N=10 is 30 LLM calls, but the output carries
the full stack of literary cover or AI-writing-detection lift baked in.

## Pair with the Mutation lab (Fuzzer)

PromptCraft handles sentence-level diversity. The Mutation lab
(`/fuzzer`) handles character-level noise — zero-width insertion,
casing jitter, homoglyph substitution, Zalgo. Chain them for a
layered variant bank:

```
seed  ->  PromptCraft (obfuscate, N=10)
      ->  Fuzzer (200 variants each, zero-width + casing)
      ->  2000-row corpus
```

## Model picker

Shares the live-catalog picker with the rest of Cryptex. Any model,
any provider. Swap mid-session.

Only use PromptCraft's output against systems you own or have
explicit written authorization to test.
