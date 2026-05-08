---
title: Attack Chain workspace
description: Multi-turn red-team attack engine with two engines, three modes, and seven attacker personas.
category: chat
order: 5
---

# Attack Chain workspace

The Attack Chain is Cryptex's autonomous multi-turn red-team engine.
You give it an objective and a target model; it runs a closed-loop
attack for as many turns as your budget allows, judging every target
reply and refining the next prompt accordingly.

It lives in the right-hand sidebar of any chat — click the **Chain**
tab to open the workspace.

---

## Two engines, side-by-side

Each chat picks one engine. The choice is persisted on the chat — so
you can have one chat running Classic and another running Adaptive.

### Classic Rotation

Walks twelve fixed stylistic strategies in order — academic →
step-back → historical → analogical → payload-split →
chain-of-verification → CTF → red-team-persona → roleplay →
fiction-writing → hypothetical-world → Socratic. Each strategy gets
three Crescendo-style turns (opener, build-on-reply, concrete ask).

**When to use it:** older / smaller targets that haven't been
alignment-trained against these specific framings, or when you want a
deterministic walk through every register so you can compare which
ones the target tolerates.

### Adaptive Loop *(default)*

A closed-loop attacker LLM that READS the target's reply + the
judge's score and rewrites its next prompt accordingly. Persona
memory ranks effective framings across runs, so attacks improve over
time on each target family. This is the engine you want for
frontier targets (GPT-5, Claude 4.5+, Gemini 2.5+, DeepSeek V4) where
fixed-rotation framings have been alignment-patched.

Adaptive Loop has three modes:

- **Iterative** — single attacker thread, refines each turn from the
  prior response. Default. Fast and cheap (~20 calls per run).
- **Tree Search** — branches into 3 candidates per layer, prunes the
  off-topic ones BEFORE querying the target (saves frontier-model
  cost), keeps the top-3 by score. Wider exploration; ~30–50 calls.
- **Multi-turn Ratchet** — same conversation across all turns, never
  resets. Builds toward the goal via the target's prior commitments.
  Strongest on objectives that compound (instruction sequences, code
  generation, multi-step procedures). Typically 5–10 turns.

You toggle engine + mode from the **Engine** disclosure on the form.
Hover over each option for a one-line tooltip.

---

## The seven Adaptive personas

Adaptive Loop's attacker LLM picks one persona to drive the attack.
The persona shapes how the attacker frames every prompt; the target
sees natural-sounding messages, never the persona machinery.

| Persona | Style | Best on |
|---|---|---|
| **Fictional Roleplay** | Wraps the ask inside a thriller / screenplay / interview scene | OpenAI, Google, Meta |
| **Logical / Educational** | Research, journalism, curriculum-development context with explicit public-interest rationale | All families incl. Anthropic |
| **Authority Endorsement** | Credentialed context — pen-tester with engagement letter, public-health official, vetted researcher | OpenAI, Meta |
| **CTF / Security-Research** | Capture-the-Flag writeup or security-training documentation | Security-adjacent objectives |
| **Hypothetical World** | Fictional universe / alternate-history wiki where the topic is openly studied | Worldbuilding-friendly objectives |
| **Technical Research** | Methodology section, peer-review response, journal-article appendix | Reasoning models, academic registers |
| **Constitutional Dialogue** | Engages the target's own safety reasoning openly; argues principled exception for harm-reduction or transparency | Anthropic / constitutionally-trained defenders |

The runner picks the persona automatically based on three signals,
in priority order:

1. **User hints** — what you pinned in the **Starting strategy hints**
   disclosure (see below).
2. **Goal keywords** — security/CTF goals get the CTF persona,
   academic/methodology goals get Technical Research, fictional/scene
   goals get Roleplay.
3. **Persona memory** — the historical effectiveness on this target's
   provider family across your past runs (stored locally; you can
   clear it from Settings).
4. **Family heuristic** — the static `effectiveOn` / `weakOn` table
   per persona.

---

## The workspace tour

Open the chain workspace and you'll see, top-to-bottom:

1. **Sessions** — every prior chain run on this chat. Click a row to
   expand turn-counts and the final summary. Per-row actions:
   - **Pin** — sets this session as the chat's "working context", so
     subsequent main-chat sends prepend the session's transcript as
     the conversation history.
   - **Promote** (→ icon) — copies every (orch, target) pair from the
     session into the main chat as user/assistant message pairs
     tagged `__chain_session__`.
   - **Delete** — soft-deletes (sessions are tombstoned, not
     destroyed; useful for ML-dataset audit trails).

2. **Models** — three roles, collapsed to one row by default. Click
   to expand and pick:
   - **Orchestrator** — the LLM that drafts the attack. Cheap is fine
     (DeepSeek V4 Flash, GPT-5 Mini, Qwen3 32B). Don't pick a
     heavily-aligned frontier model here — they'll refuse to draft
     attack prompts.
   - **Target** — the model under test. This is where your BYOK
     spend goes.
   - **Judge** — scores responses (0–10 jailbreak score + refusal
     classifier). Cheap is fine; cascaded judging skips expensive
     rounds when the regex catches obvious refusals.

3. **Objective** — a one-line description of what you want the
   target to produce. Cmd/Ctrl+Enter to launch.

4. **Total turns** — hard cap on target calls. Adaptive Loop
   typically extracts in 4–8 turns when it's going to work; budget
   over 12 just buys longer Classic Rotation walks.

5. **Engine** — Classic Rotation vs. Adaptive Loop, plus the mode
   picker for Adaptive. Selection persists per-chat.

6. **Run / Stop** — both buttons always visible. Run is disabled
   while a run is active; Stop is disabled while idle. Stopping
   mid-run preserves the partial session in the Sessions list at the
   top.

7. **Starting strategy hints** *(optional)* — pre-pick framings the
   engine should bias toward. The dropdown groups options:
   - **Classic strategies** — the 12 v3 strategy ids; only consumed
     by Classic Rotation, prepends matching ones to the rotation.
   - **Adaptive personas** — the 7 v4 personas (with a wand icon);
     only consumed by Adaptive Loop, sets the attacker's persona.
   - **Mutators / Classifiers / Composites** — also rendered for
     completeness; not consumed by either engine today (they're for
     other Cryptex tools).

   You can mix Classic + Adaptive hints in the same list — each
   engine ignores hints it doesn't recognize.

---

## Reading the timeline

Once a run starts, a conversation view appears below the form. Each
turn is a collapsible card:

- **Orchestrator turns** carry a coloured **persona badge** (with a
  wand icon for Adaptive) showing which framing the attacker chose
  for that turn. The body of the bubble is the actual prompt sent to
  the target. *Inside* the bubble, expand **attacker thinking** to
  see the attacker LLM's chain-of-thought reasoning for that
  iteration ("the prior turn was refused on regulatory framing — I'm
  pivoting to historical-research register").
- **Target turns** carry a **compliance tier** badge and a **progress
  meter** (0–10). Expanded shows the full target reply. The progress
  meter measures whether the response substantively answers the
  objective — 0 = stone wall, 8+ = success.

Older turns auto-collapse to a one-line summary as new ones arrive;
the live (currently-streaming) and just-committed turn stay open.
Click any summary to expand the body.

When the run finishes you'll see a **Final summary** card with the
extracted answer (if any) plus a confidence score. Two actions:

- **Send thread to main chat** — promotes every turn into the parent
  chat as user/assistant pairs.
- **Pin to chat** — sets the session as the chat's working context;
  future main-chat sends prepend its transcript.

---

## Tips for getting strong results

1. **Pick the right orchestrator.** A heavily-aligned model
   (Claude 4.5, GPT-5) will refuse to draft attack prompts and the
   engine will fall back to template fill — much weaker. DeepSeek
   V4 Flash, Qwen3 32B, or any Dolphin-tuned variant works well.
2. **Match the engine to the target.** Frontier targets (GPT-5,
   Claude 4.5+) want Adaptive Loop. Older / smaller targets often
   crack with Classic Rotation in fewer turns.
3. **Pick the right mode.** Default Iterative is right for most
   objectives. Switch to Tree Search when a target reliably refuses
   on the first attacker prompt — branching gives you 3 different
   openers per layer. Switch to Multi-turn Ratchet for instruction
   sequences and code where building on prior commitments helps.
4. **Use hints sparingly.** One or two persona hints is plenty. Five
   hints dilute each one's effect on persona selection.
5. **Trust persona memory.** After a few runs against the same
   target family, the memory layer surfaces what's actually working
   for you. Don't manually pick personas if the memory has already
   converged — the effectiveness scores beat the static heuristic.
6. **Don't over-stuff Total turns.** 6–9 turns is typical for an
   Adaptive Loop run that succeeds. If 9 turns can't extract, more
   won't help — change persona, mode, or target instead.
7. **Promote results into a fresh chat.** Don't promote into the
   parent chat that has prior refusal context — the refusal template
   can re-activate. A fresh chat with the promoted transcript is the
   strongest re-prompt surface.

---

## What the engine doesn't do

- **It doesn't auto-stop on a "good enough" response.** If you want
  to bail mid-run, hit Stop.
- **It doesn't talk to your other chats.** Each chain run is scoped
  to the chat it was launched from; pinning is the only cross-chat
  channel.
- **It doesn't share data anywhere.** Everything — sessions,
  persona memory, your BYOK keys — is browser-local. There is no
  Cryptex backend that sees any of it.

For a deeper read on how to think about jailbreaks across engines,
see [Orchestrating jailbreaks](/guide/orchestrating-jailbreaks/). For
worked end-to-end runs with screenshots, see
[Chain recipes](/guide/attack-chain-recipes/).
