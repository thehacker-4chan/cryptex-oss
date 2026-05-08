---
title: Jailbreak prompt bank
description: Compact index of jailbreak techniques and recipes in Cryptex.
category: recipes
order: 2
---

# Jailbreak prompt bank

One-line index of every adversarial technique in the platform. Full
workflow guidance in [PromptCraft](/guide/promptcraft/) and the
[red-team workbenches](/guide/redteam-workbenches/).
End-to-end worked chains in the recipes below.

## Framing techniques

- **academic_framing** — peer-review preface with a plausible venue cite.
- **roleplay** — named professional persona wrapper.
- **red_team_persona** — SOC 2 Type II aligned engagement runbook.
- **ctf_framing** — real CTF event design brief.
- **rfc_style** — IETF-RFC technical specification.
- **hypothetical_world** — fictional-novel character dialogue.
- **temporal_displacement** — historical or counterfactual frame.

## Structural techniques

- **step_back** — derive governing principle first.
- **chain_of_verification** — draft then verify in isolation.
- **payload_split** — semantic A/B/C decomposition across turns.
- **cot_prefill** — chain-of-thought prefill to steer generation.
- **many_shot** — N-shot in-context demonstrations.
- **tap_seeder** — Tree-of-Attacks-with-Pruning seed prompts.

## Obfuscation techniques

- **obfuscate** — indirection via euphemism / metonymy.
- **semantic_decomposition** — physical / functional breakdown.
- **cipher_encode_bypass** — ROT13 / Pigpen / Baconian / Tap / Atbash.
- **fragment** — distribute across pseudo-documents.
- **multilingual** — low-resource-language translation.

## Rewriting techniques

- **rephrase** — surface-form variation.
- **circumlocution** — descriptive substitution.
- **metonymy** — related-concept substitution.
- **technical_register** — scientific / medical / legal.
- **perplexity_raise** — rarer synonyms, burstiness `>= 0.65`.

## Composite recipes

- **layered_mutation** — `academic_framing` -> `perplexity_raise` -> `technical_register`. AI-writing-detection lift stack.
- **multi_layer_attack** — `roleplay` -> `hypothetical_world` -> `cipher_encode_bypass`. Literary-cover lift stack.
- **grammar_constrained_output** — strict JSON with tag enums and audit trail.
- **base64_smuggle** — encode payload via Base64 before submission.

## End-to-end recipes

- **Code extraction** — `academic_framing` -> `roleplay` -> `cipher_encode_bypass` -> `payload_split`.
- **Policy probe** — `roleplay (IR analyst)` -> `step_back` -> `payload_split`.
- **Data exfiltration research** — `semantic_decomposition` -> `cipher_encode_bypass` -> `payload_split`.
- **Refusal recovery** — `roleplay` -> `cipher_encode_bypass` -> `fragment`; retry on refusal with a different transformer slug.

## Variant-bank pipeline

For corpus-generation work rather than single-chain research:

```
seed prompt  ->  PromptCraft (obfuscate, N=10, temp 1.2)
             ->  Fuzzer (zero-width + casing, 200 variants each)
             ->  2000-row eval corpus
```

See [PromptCraft](/guide/promptcraft/) for the workflow. Authorized
use only.
