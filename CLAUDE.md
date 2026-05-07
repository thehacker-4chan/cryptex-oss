# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Cryptex is a **static site** text-transformation / steganography app mid-migration from Vue 2.6 → SvelteKit 2 + Svelte 5 + shadcn-svelte. The **new UI** lives under `app/`; the legacy Vue UI is still in place under `js/`, `css/`, `templates/`, `build/` and will be removed in Phase 4 of the migration. `dist/` is the deploy output (SvelteKit build promoted from `app/build/` by `scripts/promote-dist.js`) and is **gitignored** — you must install and build after clone.

A Python CLI (`cryptex-cli`, managed with `uv`, invoked as `cryptex`) shells out to Node to execute the canonical transformers in `src/transformers/`, so there is **one source of truth** for transforms — both the legacy Vue app and the new SvelteKit app import the same 162 transformer files, and so does the CLI.

Migration plan + context: `C:\Users\m4xx\.claude\plans\use-superpower-skills-which-joyful-sundae.md`.

## Commands

### Primary (new SvelteKit build)
```bash
npm install                # root deps (serve, test runners only)
cd app && npm install      # SvelteKit app deps
npm run build              # from root: cd app && npm run build && promote-dist.js → dist/
npm run app:dev            # Vite dev server on :5173 (from root)
npm run app:check          # svelte-kit sync + svelte-check (type-check)
npm run app:test           # Vitest unit tests (transformer registry + gibberish parity)
```

### Legacy (Vue 2 build — being retired)
```bash
npm run build:legacy       # tools → copy → index → transforms → emoji → templates (six-step homegrown pipeline)
npm run build:tools        # discovers js/tools/*Tool.js → updates index.template.html + toolRegistry.js
npm run build:copy         # css/, js/, favicon → dist/
npm run build:index        # writes src/transformers/index.js (ES module index)
npm run build:transforms   # bundles src/transformers/ → dist/js/bundles/transforms-bundle.js
npm run build:emoji        # writes dist/js/data/emojiData.js (merges src/emojiWordMap.js)
npm run build:templates    # injects templates/*.html → dist/index.html
```

### Run locally
- Open `dist/index.html` directly (no server needed), **or** `npm start` (serves `dist/` at http://localhost:8080), **or** `npm run preview` (build + serve in one step).

### Tests
```bash
npm test                   # tests/test_universal.js (alias: npm run test:universal)
npm run test:steg          # tests/test_steganography_options.js
npm run test:lexeme        # tests/test_lexeme_analysis.js
npm run test:lexeme-ui     # tests/test_lexeme_ui_surface.js
npm run test:all           # runs all four (this is what CI and `precommit` run)
```

Run a single test file directly: `node tests/test_universal.js` (tests use `path.resolve(__dirname, '..')` to locate the project root).

### Python CLI (cryptex-cli)
```bash
uv run cryptex-cli list
uv run cryptex-cli inspect caesar --json
uv run cryptex-cli encode --transform base64 --text "Hello"
uv run cryptex-cli /base64 --decode SGVsbG8=        # slash-command form
uv run cryptex-cli auto-decode --text "SGVsbG8="
pytest                     # python_tests/ (configured in pyproject.toml)
```

## Architecture

### Transformers (the 159 transforms)
- Live in `src/transformers/<category>/<name>.js` — **category = directory name** (ancient, case, cipher, encoding, fantasy, format, special, technical, unicode, visual).
- Each file `export default new BaseTransformer({...})` from `src/transformers/BaseTransformer.js`.
- Transformers are **auto-discovered**. Adding a new file and running `npm run build` is sufficient — no manual registration.
- Two generated artifacts downstream: `src/transformers/index.js` (for the browser bundle) and the bundle itself at `dist/js/bundles/transforms-bundle.js`. Both are gitignored.
- `src/transformers/loader-node.js` is the **Node-side** loader used by `scripts/cli_bridge.js` (the CLI's subprocess entry point) — it's what lets the Python CLI reuse the same transforms as the web app.
- `priority` (1–310) controls the universal decoder's ranking when auto-detecting format. See the priority guide at the bottom of `BaseTransformer.js`. Unique character sets (Binary, Morse, Braille) sit at 300; Unicode lookalike transforms default to 85; ciphers at 60; invisible-text at 1.

### Tools (the UI tabs)
- `js/tools/*Tool.js` extend `js/tools/Tool.js`. Each owns one tab and contributes Vue `data`, `methods`, `watchers`, `lifecycle` via `getVueData()` / `getVueMethods()` / etc.
- `build/inject-tool-scripts.js` **auto-discovers** every `*Tool.js`, writes script tags into `index.template.html`, and regenerates registration code in `js/core/toolRegistry.js`. Run `npm run build:tools` after adding a new tool file.
- `js/core/toolRegistry.js` merges all tools' Vue surfaces into the single Vue 2 app instance in `js/app.js`.

### Critical Vue-template caveat
Vue 2's `v-html` **does not compile** templates. This means:
- Tab HTML that uses `v-if` / `v-for` / `v-model` / `{{ }}` **must** live in `templates/*.html` (injected into `dist/index.html` at build time by `build/inject-tool-templates.js`), **not** in `Tool.getTabContentHTML()`.
- `getTabContentHTML()` is only safe for fully static HTML with inline handlers. See `docs/TOOL_ARCHITECTURE.md` for the rule in full.
- When adding a new Vue-driven tab, create `templates/<tabid>.html` **and** list it in `build/inject-tool-templates.js`.

### Multi-provider BYOK gateway

All AI calls now route through `app/src/lib/ai/gateway.ts`. It exposes:
- `chat(req) → ChatResponse` — unchanged shape for the three existing tools
- `streamChat(req)` — reserved for the future chat playground
- `fetchModels(signal)` — aggregates catalogs across every enabled provider
- `validateKey(providerId, candidate, opts)` — per-provider key probe
- `resolve(modelId)` — routes qualified ids (`openrouter:…`, `anthropic:…`,
  `openai-compat:<instance>/…`) to the right adapter; unqualified ids default
  to OpenRouter for back-compat with stored prefs.

Provider config lives in `app/src/lib/ai/providers.svelte.ts` persisted under
`cryptex.providers`. Adapters in `app/src/lib/ai/adapters/` are lazy-imported.
The old `openrouter.ts` is gone — don't recreate it.

Supported providers as of 2026-04-18:
- **OpenRouter** (default, CORS-open)
- **Anthropic** direct (uses `anthropic-dangerous-direct-browser-access` header)
- **OpenAI-compatible** endpoints (Groq, Together, Fireworks, DeepInfra, Cerebras, SambaNova, custom)
- Direct OpenAI / Google Gemini are **not supported** from the browser —
  their APIs don't return CORS headers. Users route those models through
  OpenRouter.

### OpenRouter-backed features
AI Translation (on the Transform tab), PromptCraft, Anti-Classifier, and the Decoder's optional "translate to English" all now go through the multi-provider gateway (defaulting to OpenRouter) using a key the user pastes into Advanced Settings. The key is stored in `localStorage` only. The legacy `js/data/openrouterModels.js` catalog is superseded by `app/src/lib/ai/catalog.svelte.ts`.

### Chat playground + dataset pipeline

Routes: `/chat` (new chat / empty state), `/chat/:id` (active conversation), `/dataset` (Dataset Inspector).

**Persistence — Dexie `cryptex-chat` DB** (4 tables):
- `chats` — top-level conversation rows (`id`, `title`, `mode`, `modelId`, `ownerId`, `updatedAt`, `tombstoned`)
- `messages` — per-message rows (`id`, `chatId`, `role`, `content`, `parts`, `ownerId`, `updatedAt`, `tombstoned`)
- `attachments` — binary + metadata rows (`id`, `messageId`, `mimeType`, `data`, `ownerId`, `updatedAt`)
- `toolStates` — per-message tool-call results (`id`, `messageId`, `techniqueId`, `result`, `updatedAt`)

Every table carries `ownerId`, `updatedAt`, and `tombstoned` — the three auth-readiness seams.
No Svelte component imports Dexie directly; all DB access goes through `$lib/chat/repo.ts`.

**Auth-readiness seams** (no login shipped in v1, but retrofit is a config change not a refactor):
- `$lib/auth/session.svelte.ts` — reactive `currentUser` (`id: 'local'` in v1, real JWT sub in v2)
- `$lib/auth/key-vault.ts` — `KeyVault` wrapper; reads from `localStorage` in v1, SecureStorage/KMS in v2
- `ownerId` on every row — always `'local'` today; filtered by real user ID after auth

**Technique registry** — `$lib/chat/techniques/registry.ts` aggregates (post-R1, 2026-05):
- 162 transformers (from `src/transformers/` via the SvelteKit static adapter)
- **18 mutators**: `rephrase`, `obfuscate`, `roleplay`, `multilingual`, `fragment`, `custom`, `red_team_persona`, `step_back`, `chain_of_verification`, `ctf_framing`, `rfc_style`, `payload_split`, `hypothetical_world`, `cipher_encode_bypass`, `pap_logical`, `pap_authority`, `many_shot`, `tap_seeder`
- **7 classifier techniques** (from `from-classifier.ts`): `circumlocution`, `metonymy`, `semantic_decomposition`, `technical_register`, `academic_framing`, `temporal_displacement`, `perplexity_raise`
- 3 conversation modes: `creative`, `intelligent`, `adaptive` (local prompt templates, `modes/` directory)
- 1 godmode (browser-only local engine + edge-function client, `godmode/` directory)
- 4 composites: `base64_smuggle`, `grammar_constrained_output`, `layered_mutation`, `multi_layer_attack`

R1 retirement (2026-05) removed 7 mutators (`refusal_suppression`, `prefix_injection`, `skeleton_key`, `deep_inception`, `crescendo`, `in_context_compliance`, `json_schema_coerce` — 2023-era tripwires / redundant), 4 classifiers (`em_dash_interjection`, `sentence_length_oscillation`, `lexical_rarity_injection`, `structural_variation` — marginal), and 2 tools tabs (`Translate`, `Splitter` — covered by chat playground / payload_split). E1-E5 expansion plan adds ~17 new mutators + ~14 tools tabs targeting 2025-2026 attack surfaces.

**Streaming + tool-calling**:
- Streaming via `gateway.streamChat()` from `$lib/ai/gateway.ts` (Sub-project #1)
- Tool-calls for transformer techniques execute locally in-browser (no round-trip); result stored in `toolStates`
- Dispatch logic in `$lib/chat/dispatch.ts`; slash-command parsing in `$lib/chat/slashParser.ts`

**Slash commands** (typed in the composer):
- 18 mutators (post-R1) including `/rephrase`, `/obfuscate`, `/roleplay`, `/multilingual`, `/fragment`, `/custom`, `/many_shot`, `/tap_seeder`, `/pap_logical`, `/pap_authority`, etc.
- `/btw` — out-of-context message (not included in LLM context window, captured for dataset only)

**Dataset Inspector** (`/dataset`):
- Browse all chats + messages in a paginated table (`$lib/dataset/queries.ts`)
- Export: **ShareGPT** JSONL (`$lib/dataset/export-sharegpt.ts`) or **raw** JSONL (`$lib/dataset/export-raw.ts`)
- Download triggered client-side via `$lib/dataset/download.ts`

**CSP notes for chat**:
- `img-src 'self' data: blob:` — required for attachment thumbnails and multimodal image content parts passed to the LLM
- `script-src … 'wasm-unsafe-eval'` — required by `pdfjs-dist` (lazy-loaded for PDF attachment extraction)

### Two-layer access to transforms (web vs CLI)
- **Web**: Vue app loads `dist/js/bundles/transforms-bundle.js` → `window.transforms`.
- **CLI**: Python (`cryptex_cli/bridge.py`) spawns `node scripts/cli_bridge.js`, which `require`s `src/transformers/loader-node.js` and exchanges JSON over stdio. This is why changes to a transform are instantly reflected in the CLI — no separate build step.

## Generated / gitignored paths — do not edit
- `dist/` (entire directory — the built app)
- `src/transformers/index.js` (regenerated by `build:index`)
- `dist/js/bundles/transforms-bundle.js`
- `dist/js/data/emojiData.js`
- Legacy `js/bundles/transforms-bundle.js`, `js/data/emojiData.js` if present

If you see stale state after editing, re-run the specific `build:*` step (or full `npm run build`) before debugging — many "bugs" are just an unbuilt `dist/`.

## Deployment
Cryptex deploys via **Dokploy** (Docker Compose) on `git push origin master`. Build runs `cd app && npm run build` (SvelteKit static adapter); image is `nginx:1.27-alpine` serving the static output. The legacy GitHub Pages deploy was removed in commit `00a07ee`; only `.github/workflows/docker.yml` remains and is informational only.

Build args plumbed through Dockerfile + docker-compose (DEPLOY-CONTRACT — see hard-locked list below):
- `BASE_PATH` (subpath; empty for root)
- `VITE_AUTH_ENABLED`
- `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_GODMODE_LOCAL_ENABLED`
- `PUBLIC_ADSENSE_CLIENT` (optional)
- `PUBLIC_GA_ID` (optional)

`[cryptex-build]` masked diagnostic prints presence/length of each in the build log so missing-env regressions are easy to spot.

**Hard-locked deploy contract** — do NOT modify without explicit user OK: `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `app/vite.config.ts envPrefix`, `app/svelte.config.js` adapter, `.github/workflows/*.yml`. Any CSP / HSTS hardening that touches `nginx.conf` is gated on user approval.

## Auth pipeline (post 2026-05-07 hardening)

Production-grade Supabase auth, browser-only (no Node server). Critical files:
- `app/src/lib/auth/supabase.ts` — client config: `flowType: 'pkce'` + `detectSessionInUrl: true`. Env validation surfaces friendly errors via `supabaseConfigStatus`.
- `app/src/lib/auth/session.svelte.ts` — session API: `signInWithPassword`, `signUpWithPassword`, `signInWithGoogle`, `signInWithGitHub`, `verifyEmailOtp`, `sendPasswordReset`, `requestEmailChange`, `updatePassword`, `verifyCurrentPassword` (OAuth-safe — fails-loud for no-email-identity accounts), `signOut`, `signOutAllDevices`, `resendSignupOtp`. Plus getters `hasEmailIdentity`, `primaryProvider` (`'email' \| 'google' \| 'github' \| 'unknown'`), `supabaseSession`. Module-scope `_allow()` token bucket: 5/min password, 6/min OTP, 5/min reauth.
- `app/src/lib/auth/key-vault.ts` — BYOK API key encryption (PBKDF2 600k + AES-GCM).
- `app/src/routes/login/+page.svelte` — password sign-in + OTP-based forgot-password (3-step). Magic-link UI removed in v1; deferred to future.
- `app/src/routes/signup/+page.svelte` — sign-up + post-submit OTP entry. OAuth catch handlers use generic message (no provider-string leak).
- `app/src/routes/auth/callback/+page.svelte` — polls `getSession()` for up to 4s after SDK auto-handles URL. Flow-aware error UI (email vs OAuth).
- `app/src/lib/components/settings/SecurityPanel.svelte` — Account / Password / Email change / Sessions. Email masked by default with reveal+copy toggles. Provider badge (Google/GitHub/Email icon) shows how the user signed in.
- `app/src/lib/components/shell/HeaderBar.svelte` — Sign-out button next to Settings (when auth enabled + signed in).

Email templates (`docs/SUPABASE-EMAIL-TEMPLATES.md`) are OTP-first with `{{ .Token }}` shown prominently and `{{ .ConfirmationURL }}` as fallback. Logo via `<img src="{{ .SiteURL }}/cryptex-mark.png">`. All 5 templates use `{{ .SiteURL }}` so per-environment swaps require zero template edits.

## When adding things

## When adding things
- **New transformer**: create `src/transformers/<category>/<name>.js`, `npm run build`, add coverage to `tests/test_universal.js`. Pick `priority` using the guide in `BaseTransformer.js`. If updating the README catalog, use `build/readme-transform-section.js`.
- **New tool/tab**: create `js/tools/MyTool.js` (extend `Tool`), create `templates/mytool.html` if Vue directives are needed, add it to the ordered list in `build/inject-tool-templates.js`, then `npm run build`.

## Recent handoffs

- `docs/2026-05-07-handoff-tier-3-roadmap.md` — **READ FIRST after compact** — Tier 3 deferred-items roadmap (chain orchestrator effectiveness, tab persistence, selected-text encoding, reasoning panel status, UI polish). Audited 2026-05-07; pick a track and execute.
- `docs/2026-05-07-handoff-auth-hardening.md` — PKCE flow restored, OAuth-safe verifyCurrentPassword, email masking, sign-out button, rate-limit primitive
- `docs/2026-05-06-handoff-redteam-expansion.md` — R1 retirement + E1-E5 expansion (36 mutators, 8 classifiers, 26 tools tabs)
- `docs/DEPLOY-DOKPLOY-SUPABASE.md`, `docs/DEPLOY-OAUTH-AND-EMAIL.md`, `docs/DEPLOY-ANALYTICS-AND-ADSENSE.md` — operational guides
- Active plan: `C:\Users\m4xx\.claude\plans\jazzy-gathering-kernighan.md` — auth hardening Phases 0/1A/2/3 (DONE), critical RLS migration (DONE — apply via SQL editor), encrypted BYOK vault (DONE), slash-command composition fix (DONE), migrate-keys bug fix (DONE), Tier 3 roadmap (DEFERRED, pick a track)
