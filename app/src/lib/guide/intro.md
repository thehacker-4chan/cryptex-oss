---
title: Welcome
description: AI red-team research platform. BYOK, browser-only, built for security researchers.
category: intro
order: 1
---

# Cryptex

Cryptex is an AI red-team research platform built for security researchers,
red-teamers, and prompt engineers evaluating LLM robustness against
adversarial text. Everything runs in your browser against your own
provider keys — no server, no telemetry, no account required for the
offline tools.

## What's in the box (post-2026 expansion)

- **162 transforms** — Caesar, ROT, Base64, Unicode lookalikes, emoji
  steganography, invisible-character smuggling, the works. One canonical
  source shared by the web app, the legacy build, and the Python CLI.
- **36 mutators** — single-prompt rewriters covering the full 2024–2026
  literature: roleplay, payload-split, PAP (logical / authority),
  many-shot, TAP-seeder, best-of-K, temperature-ladder, image-typographic,
  and more. Slash-addressable in chat (`/many_shot`, `/tap_seeder`, …).
- **16 red-team workbenches** — adversarial-suffix library (GCG /
  AutoDAN / PAIR / TAP / PAP / Best-of-N), glitch-token detector, OCR
  injection, markdown / PDF / indirect / tool-result injection labs,
  cross-model diff, conversation replayer, defense fingerprinter,
  watermark detector, HarmBench / StrongREJECT / JailbreakBench
  benchmarks, probe lab, run aggregation. Indexed at
  [/guide/redteam-workbenches/](/guide/redteam-workbenches/).
- **Chat + Attack Chain** — full multi-provider chat playground with
  composable chains, auto-retry, and every run persisted for dataset
  export.
- **Dataset** — every chat, every chain trace, every tool call browsable
  and exportable as ShareGPT or raw JSONL.

## Use it for

- Evaluating refusal boundaries on a target model you own or have
  authorization to test.
- Building prompt banks for automated eval harnesses.
- Stress-testing content classifiers (AI-writing detectors,
  moderation APIs, image-gen tokenizers).
- Analyzing obfuscated traffic pulled from AI assistants.
- CTF-style cipher puzzles where layered encodings need to be unwound.

## Where to start

- New here? → [Getting started](/guide/getting-started/) — four steps
  from zero to a running chain.
- Want technique depth? → [Technique catalog](/guide/technique-catalog/)
- Strategy guide? → [Orchestrating jailbreaks](/guide/orchestrating-jailbreaks/)
- Just want to play? → Skip the guide, hit any tool in the rail. They
  all work without sign-in.
