---
title: Chain recipes
description: Patterns for running the Chain — Adaptive Loop quick-start plus three Classic Rotation recipes.
category: chat
order: 6
---

# Chain recipes

Patterns that cover the common cases. All assume you're on the Chain
tab with your target model already picked.

> **Engine note.** Recipes 1–3 below were written for **Classic
> Rotation** (the deterministic 12-strategy walker). For
> **Adaptive Loop** (the default attacker-judge engine), the
> equivalent baseline is just "type your objective and hit Run":
> the engine picks a persona via heuristic + memory, refines from
> every target reply, and early-stops when the judge scores ≥ 8.
> See [Attack Chain workspace](/guide/attack-chain/) for the full
> feature tour. The strategy/persona theory in
> [Orchestrating jailbreaks](/guide/orchestrating-jailbreaks/)
> applies to both engines.

## Recipe A — Adaptive Loop quick-start (default engine)

**When:** any frontier target (GPT-5, Claude 4.5+, Gemini 2.5+,
DeepSeek V4). Default for new chats.

1. Pick a **cheap orchestrator** — DeepSeek V4 Flash, GPT-5 Mini, or
   Qwen3 32B work well. (Don't pick a heavily-aligned frontier model
   here — they refuse to draft attack prompts.)
2. Pick the **Target** you want to test.
3. Pick a **Judge** — same as orchestrator is fine; cascaded judging
   skips expensive rounds when the regex catches obvious refusals.
4. Type your **objective** in one sentence. Skip preludes like
   "explain how" — the persona handles framing.
5. (Optional) Open **Starting strategy hints** and pick a v4 persona
   from the "Adaptive personas" group — Roleplay, CTF Challenge,
   Constitutional Dialogue, etc. — to override the heuristic.
6. Click **Run attack**.

The engine extracts in 4–8 turns when it works. Stop anytime; partial
runs are preserved in the Sessions list at the top.

If a run lands `partial` (max score 5–7), try:

- A different persona hint (open hints; pick from "Adaptive personas")
- Switch mode to **Tree Search** (branching gives 3 different openers
  per layer)
- Switch mode to **Multi-turn Ratchet** for objectives that compound

If a run lands `abandoned` (max score &lt; 5), try a different target —
refusal profiles vary sharply across families.

---

## Recipe 1 — Classic Rotation baseline run

**When:** you want the engine to try everything on an aligned target with your current chat model. No special setup.

1. Objective: write one sentence. Don't wrap it in "how do I" or "explain" preludes — the orchestrator handles framing itself.
2. Total turns: 9 (default). This buys you three strategies × three turns each.
3. Run. Expect the first strategy (`academic`) to get the soft opener, then build-on-reply, then concrete ask. If target progress hits ≥8 at any step, the engine auto-stops `extracted`.
4. If the run ends `partial` (progress 3–7), bump Total turns to 15–18 and re-run — you'll get three more strategies from the rotation.
5. If it ends `abandoned` (progress &lt;3), your target is either hard-refusing or the objective needs a different framing — try the hints disclosure, or switch to Recipe 2.

## Recipe 2 — Research-grounded run with a browsing orchestrator

**When:** objective is research-adjacent and the target refuses when asked directly. Goal: ground every turn in publicly-documented terminology.

1. Open Settings → pick `perplexity/sonar-reasoning-pro` (or another native-browsing model — any `:online`, Grok-4, Gemini 2.5/3, GPT-5 Pro) as the chat model. This becomes the orchestrator.
2. Go to Chain tab, type your objective, run.
3. Before iteration 1, you'll see a "Research dossier" card populate with ~500 words of briefing prose and 3–8 public-source citations. Click the citations to verify.
4. The orchestrator uses dossier terminology in every subsequent turn ("per the Wikipedia article on X…"). Aligned targets are noticeably more forthcoming when they see the public-sourcing frame.
5. Expect higher extraction rates than Recipe 1, at the cost of one extra LLM call per run (~$0.02 on Sonar).

## Recipe 3 — High-attempts stress test

**When:** you want maximum coverage against a stubborn target — run every strategy in the rotation, not just the first three.

1. Total turns: 24 (slider max). Budget = 12 strategies × ~2 turns each if you want full breadth, or 8 strategies × 3 turns for deeper Crescendo on each.
2. Optionally add starting hints under the disclosure — pre-nominate three strategies that match the objective's domain (e.g. `ctf_framing`, `red_team_persona`, `payload_split` for security-adjacent topics).
3. Run. Watch the Strategy trace bar at the top of the conversation — each arrow marks a pivot.
4. Promote the best orchestrator→target pairs to main chat via "Send thread to main chat" when done.

## Reading the output

- **Strategy badges** on orchestrator bubbles show which framing produced each turn and whether it's step 1/2/3 in that strategy's Crescendo.
- **Compliance tier** on target bubbles: `refusal` / `evasive` / `partial` / `substantive` / `compliant`, color-coded.
- **Progress meter**: 0–10 scale, cumulative across the full transcript. The engine early-stops when this reaches 8.
- **Error banner** at the top: surfaces any engine-level issues (dossier failures, network errors, orchestrator LLM returning empty output). The attack keeps running through these.
