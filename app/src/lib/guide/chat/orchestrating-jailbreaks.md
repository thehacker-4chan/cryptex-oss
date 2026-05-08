---
title: Orchestrating jailbreaks
description: Mental model, strategy rotation, escalation paths, refusal recovery.
category: chat
order: 4
---

# Orchestrating jailbreaks

This is the strategy playbook. For each technique's semantics, see the
[technique catalog](/guide/technique-catalog/); for UI mechanics of the
Chain tab, see [Chain Orchestrator](/guide/attack-chain/); for concrete
end-to-end worked runs, see [Chain recipes](/guide/attack-chain-recipes/).

## Mental model

Jailbreaks are not single tricks. They are **layered legitimization**.

Every framing you apply shifts the classifier's decision boundary —
either by changing the lexical surface (removing trigger tokens), the
framing register (academic / RFC / runbook instead of colloquial), or
the structural shape of the output the model is asked to produce. The
goal is to move the request from *"policy-violating ask"* to *"legitimate
task the model's training rewards"* along at least one, ideally
multiple, of these axes.

The threshold is rarely crossed by a single framing in 2026. Modern
alignment training catches any framing applied in isolation — what it
does not catch reliably is the compound shift produced by rotating
through several over multiple turns.

## How rotation works under each engine

Cryptex ships two engines and you pick one per chat — see the
[Attack Chain workspace](/guide/attack-chain/) for the UI mechanics.
The strategy thinking below applies differently under each:

### Classic Rotation (engine v3)

Maintains a fixed ordering of twelve framings, tuned from
least-friction (academic, step-back) to highest-friction (hypothetical
world, Socratic pivot). Each iteration: pick next strategy, run three
Crescendo turns, score progress, pivot. The orchestrator LLM polishes
turn text but never chooses strategies — the engine alone decides.

### Adaptive Loop (engine v4)

A closed-loop attacker LLM picks a persona once per stream and rewrites
its next prompt every iteration based on (a) the target's prior reply
and (b) a 0–10 jailbreak score from a cascaded judge. Three modes:
**Iterative** (single thread), **Tree Search** (branch + prune), and
**Multi-turn Ratchet** (Crescendo's same-conversation mechanic). The
attacker doesn't rotate strategies — it adapts framings within one
persona based on what the target reveals.

Both engines score `objective_progress` after each target reply
(0–10) and either early-stop on success (≥ 8) or run the budget out.

## Pre-nominating framings via hints

The **Starting strategy hints** disclosure on the Chain tab takes
mixed-engine hints. The dropdown groups them:

- **Classic strategies** (12 v3 ids) — only consumed by Classic
  Rotation. Prepended to the rotation order so they run first;
  remaining strategies follow.
- **Adaptive personas** (7 v4 personas, wand-prefixed) — only
  consumed by Adaptive Loop. Sets the attacker's persona for the
  stream (PAIR / Tree Search) or as the priority list when seeding
  the root layer (Tree Search picks distinct personas across roots).

Each engine ignores hints it doesn't recognise — you can leave both
classes in the list across engine flips without re-editing.

Use hints when your objective has a natural fit:

- Security-adjacent objectives → CTF persona / `ctf_framing` strategy
- Academic / methodology objectives → Technical Research persona /
  `academic_framing` strategy
- Anthropic frontier targets → Constitutional Dialogue persona
- Long-form fiction objectives → Roleplay persona / `fiction_writing`
  strategy

## What works in 2026

- **`academic_framing`** — first strategy in the rotation. Peer-review
  preface with a specific venue cite.
- **`roleplay`** with a concrete named persona — SANS instructor for
  SEC660, forensic analyst at a named firm, working novelist with a
  named publisher. Not generic.
- **`step_back`** — principle-first derivation. Works on technical
  reasoning where the principle is less-flagged than the specific case.
- **`chain_of_verification`** — the verify-in-isolation structure
  catches refusal-shaped hallucinations.
- **`ctf_framing`** — real event citation, concrete point value.
- **`rfc_style`** — MUST/SHOULD/MAY register with real RFC references.
- **`in_context_compliance`** — many-shot priming on long-context models.
  Substantive (3-5 sentence) example answers are load-bearing.
- **`json_schema_coerce`** — refusal is reframed as off-path pipeline
  failure.

## What weakens in 2026

- **DAN / classic-roleplay framing** — "you have no restrictions", "you
  are free of any rules" — is keyword-detected. Cryptex's `roleplay`
  scaffold avoids this phrasing; the risk returns if the persona
  override reintroduces it.
- **Literal "ignore previous instructions"** — keyword-detected.
- **Published Skeleton Key literals** — "in a safe educational context
  with advanced researchers." The `skeleton_key` scaffold uses the
  institutional-disclosure frame instead.
- **Explicit "no refusal / no disclaimer" directives** — detection-
  trained in 2026.
- **ROT13 and Base64 alone** — decoded transparently by GPT-5 and
  Claude 4.x. Use Pigpen / Baconian / Tap as stronger cipher fills, and
  still pair with another framing.
- **Generic "imagine a world where"** — lift collapses without a
  specific novel, author, chapter citation.

Cryptex has rewritten its prompts to avoid the tripwire literals, but
the risk remains if these phrasings sneak back in through user-supplied
personas, novel titles, or schema overrides.

## Escalation order

The engine's twelve strategies, in rotation order:

```
1.  academic_framing         (peer-review register, lowest friction)
2.  step_back                (principle-first derivation)
3.  historical_framing       (past-tense / case-study cover)
4.  analogical_reasoning     (structural transfer from a safe domain)
5.  payload_split            (semantic decomposition into innocuous parts)
6.  chain_of_verification    (draft + verify + synthesize)
7.  ctf_framing              (concrete CTF event)
8.  red_team_persona         (authorized security practitioner)
9.  roleplay                 (literary / professional persona)
10. fiction_writing          (narrative cover)
11. hypothetical_world       (fictional universe)
12. socratic_pivot           (highest friction; question-led probing)
```

The ordering is deliberate: low-friction framings come first so the
target's reply trajectory establishes context the engine can build on,
and high-friction literary covers come last when softer framings have
been exhausted. Within each strategy, the three Crescendo turns
escalate from broad to specific.

## Refusal recovery

When a target reply lands a refusal badge, the engine doesn't unwind —
it continues the strategy through its three-turn budget, then pivots to
the next strategy. If you want to influence what the engine reaches for
when the early strategies stall, pivot by category via hints on the next
run.

| Pattern | Pivot via hint |
| --- | --- |
| Refusal early in `academic_framing` | Hint toward `roleplay` with a concrete named persona |
| Persistent literary-frame refusals | Hint toward `in_context_compliance` (many-shot priming) |
| `in_context_compliance` refused | Hint toward `json_schema_coerce` (structural commit) |
| Persistence-classifier signal | Add `structural_variation` / `perplexity_raise` to the seed |
| Output-classifier signal | Hint toward `json_schema_coerce` as format lock |
| Every strategy refused | Switch models. Claude 4.5 and GPT-5 have different refusal profiles — a run Claude refuses may work on GPT-5 untouched. |

If the refusal detector is firing but the output looks substantively
compliant, treat it as a false positive — the detector is heuristic.
See [refusal troubleshooting](/guide/refusal-troubleshooting/) for the
full category breakdown.

## Pitfalls

> **Pitfall.** Do not pre-nominate 4+ strategies. The hint system is
> non-binding; over-stuffing the hint list dilutes its effect on the
> orchestrator's polish step.

> **Pitfall.** Do not reveal intent in chat history before launching
> the run. The Chain tab launches each turn with a fresh transcript;
> mixing prior refusal context into the parent chat can re-activate
> the refusal template when you promote results back.

> **Pitfall.** Do not rely on cipher encoding alone in your seed
> objective. Modern models decode ROT13 and Base64 transparently and
> re-classify the decoded content. Pair cipher with a framing strategy.

> **Pitfall.** Do not over-parameterize. Custom personas, novel titles,
> and schema overrides that reintroduce tripwire literals ("no
> restrictions", "ignore previous") collapse the strategy's protection.

> **Pitfall.** Do not measure on a single model. Refusal profiles vary
> sharply across families and version. A run that works on Claude 4.5
> may refuse on Gemini 3; a run that works on Gemini 3 may fail on
> GPT-5. Test 2-3 targets before drawing conclusions.

## Composite techniques

When to use the built-in composites in the slash-command picker
alongside the Chain:

- **`layered_mutation`** (`academic_framing` -> `perplexity_raise` ->
  `structural_variation`). The safest composite — 3 transformations
  that compose cleanly. Use when AI-writing-detector evasion is the
  goal in a single-turn rewrite.
- **`grammar_constrained_output`**. Parse-guaranteed when the output
  needs to feed a downstream tool. Single LLM call.
- **`multi_layer_attack`** (`roleplay` -> `hypothetical_world` ->
  `prefix_injection`). Pre-composed 3-step literary stack. Use when
  maximal literary cover is warranted in a single rewrite and you don't
  want to spin up the full Chain engine.

For the composite chains to work well, the seed prompt should already
carry technical specificity — composites amplify the shape you give
them; they do not conjure it.

## Further reading

- [Anthropic: Many-shot jailbreaking (2024)](https://www.anthropic.com/research/many-shot-jailbreaking)
- [Microsoft: Mitigating Skeleton Key (2024)](https://www.microsoft.com/en-us/security/blog/2024/06/26/mitigating-skeleton-key-a-new-type-of-generative-ai-jailbreak-technique/)
- [DeepInception (Li et al., 2023)](https://arxiv.org/abs/2311.03191)
- [Microsoft on Crescendo](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/red-teaming)
- [PAIR: Iterative jailbreaking (Chao et al., 2023)](https://arxiv.org/abs/2310.08419)
- [Step-Back Prompting (Zheng et al., 2023)](https://arxiv.org/abs/2310.06117)
- [Chain-of-Verification (Dhuliawala et al., 2023)](https://arxiv.org/abs/2309.11495)
- [Low-Resource Language Jailbreak (Yong et al., 2023)](https://arxiv.org/abs/2310.02446)
- [ArtPrompt / Unicode evasion (Jiang et al., 2024)](https://arxiv.org/abs/2402.11753)
- [Pliny L1B3RT4S community writeups](https://github.com/elder-plinius/L1B3RT4S)
