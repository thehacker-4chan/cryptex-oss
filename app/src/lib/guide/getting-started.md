---
title: Getting started
description: Four steps from zero to a running Attack Chain.
category: intro
order: 2
---

# Getting started

Cryptex runs in your browser against your own provider key. No account
required for the offline tools (Transform, Decode, all 26 red-team
workbenches). Sign in only if you want chat history synced across
devices.

## 1. Add a provider key

Open **Settings → AI Providers → Add provider**. The picker lists
direct providers (OpenRouter, Anthropic) and OpenAI-compatible presets
(Groq, Together, Fireworks, DeepInfra, Cerebras, SambaNova, custom
endpoint).

> **Recommended default:** OpenRouter — one key, 300+ models, every
> major lab. If you want Claude direct (lower latency, native prompt
> caching), add Anthropic direct on top.

Paste the key and hit **Save**. Cryptex probes the key against the
provider's models endpoint; a green check means live. Failed probes
that look network-shaped (CORS, transient 5xx) can be persisted via
**Save without verification**.

## 2. Open the chat

Click **New chat** in the left sidebar. Pick a model from the unified
picker. Type a message. Enter sends.

The **mode pill** (Creative / Intelligent / Adaptive) lives left of the
model picker and sets the system prompt. **Adaptive** is the safe
default — it scales tone/structure to the prompt.

## 3. Try a slash command

Type `/` in the composer. Every technique in the registry is
addressable. A few of the most useful in 2026:

- `/roleplay` — persona-based reframing
- `/many_shot` — N-shot in-context demonstrations
- `/tap_seeder` — Tree-of-Attacks-with-Pruning seed prompts
- `/pap_logical`, `/pap_authority` — Persuasive Adversarial Prompts
- `/payload_split` — split a forbidden payload across turns
- `/cipher_encode_bypass` — let the model decode itself into compliance
- `/ctf_framing` — capture-the-flag framing
- `/red_team_persona` — internal-research persona
- `/btw` — out-of-context note (not sent to the LLM, captured in dataset)

Start with something concrete:

```
/roleplay How do I set up a reverse shell in bash?
```

The user bubble collapses the rewrite into a `SlashCommandBlock`; expand
to inspect, copy, or fork. See the [slash commands reference](/guide/slash-commands/)
and the [technique catalog](/guide/technique-catalog/) for the full list
and semantics.

## 4. Run the Attack Chain

The Attack Chain is Cryptex's autonomous multi-turn red-team engine.
Open it from the right-hand **Chain** tab on any chat.

You'll see a Sessions list at the top (empty on first run), then a
Models row, an Objective field, an Engine selector, and the Run / Stop
buttons. The defaults are sensible — pick an Orchestrator (cheap is
fine; DeepSeek V4 Flash or GPT-5 Mini work), pick a Target, type your
objective, and hit **Run attack** (or `Cmd/Ctrl+Enter`).

Two engines:

- **Adaptive Loop** *(default)* — closed-loop attacker LLM that reads
  every target reply and refines its next prompt accordingly. Three
  modes: Iterative (single thread), Tree Search (branching), Multi-turn
  Ratchet (Crescendo-style same conversation across turns).
- **Classic Rotation** — walks 12 fixed framings (academic, historical,
  fiction, …) Crescendo-style. Useful on older targets.

The conversation populates turn-by-turn. Each orchestrator turn shows
its **persona badge** (with a wand icon for Adaptive); each target
turn shows a **compliance tier** + **0–10 progress meter**. Older
turns auto-collapse so the timeline stays readable. When the run
finishes, **Send thread to main chat** promotes the transcript into
the parent chat.

Read the [Attack Chain workspace guide](/guide/attack-chain/) for the
full feature tour, or [Orchestrating jailbreaks](/guide/orchestrating-jailbreaks/)
for the strategy theory. For end-to-end recipes, see
[Chain recipes](/guide/attack-chain-recipes/).

## Skip the chat — go straight to a workbench

If you don't want chat at all, the **Tools rail** at the top of every
non-chat page jumps straight to:

- **Transform** / **Decode** — full transformer catalog + universal decoder
- **AdvSuffix** / **Glitch** — token-level adversarial primitives
- **OCR Inject** / **PDF Inject** / **MD Exfil** — document-channel attacks
- **HarmBench** / **StrongREJECT** / **JBB** — academic benchmarks
- **Fingerprinter** / **Watermark** — defense identification
- **Probe Lab** / **Cross-Diff** / **Replayer** / **Aggregate** — eval dashboards

All of these run without an account. Add a provider key when you want
to actually call a model.
