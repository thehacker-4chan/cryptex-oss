# Contributing

Thanks for considering a contribution. This page is a quick orientation; the detailed architecture lives in [`CLAUDE.md`](CLAUDE.md).

## Quick start

```bash
git clone https://github.com/m4xx101/cryptex-oss.git
cd cryptex-oss/app
npm install
npm run dev
```

The dev server runs at <http://localhost:5173>. Hot-reload is on; edits to Svelte files reflect immediately.

## Layout

- `app/` — SvelteKit 2 + Svelte 5 app (the deliverable). 25 routes, 850+ unit tests, BYOK multi-provider gateway, per-tool Vault drawer, history v2.
- `src/transformers/` — 159 transformer modules. Single source of truth for the web app (via Vite `import.meta.glob`) and the Python CLI (via `scripts/cli_bridge.js`).
- `cryptex_cli/` — Python CLI (`uv run cryptex-cli ...`). Shells out to Node through `scripts/cli_bridge.js`.
- `Dockerfile` + `docker-compose.yml` + `nginx.conf` — static deploy contract.

## Gates before opening a PR

```bash
cd app
npm run check          # svelte-check (type-check)
npx vitest run         # unit tests
npm run build          # static build (smoke check)
uv run cryptex-cli list   # CLI sanity (optional)
```

All four must be green.

## Adding a transformer

1. Drop a file at `src/transformers/<category>/<name>.js`.
2. `export default new BaseTransformer({...})`.
3. Pick a `priority` (1 to 310) using the guide at the bottom of `src/transformers/BaseTransformer.js`.
4. The web registry (Vite `import.meta.glob`) and the Node loader auto-discover it. No manifest update.

## Adding a tool surface

1. Create the Svelte component in `app/src/lib/components/tools/<tool>/` (or `app/src/lib/components/redteam/<tool>/`).
2. Add the route at `app/src/routes/<tool>/+page.svelte`, wrapping content in `<ToolShell toolId="…" title="…">`.
3. Register the tab in `app/src/lib/components/shell/TabRail.svelte`.
4. Optional Vault drawer via `<VaultSection>`.

See [CLAUDE.md](CLAUDE.md) "v2.0 conventions" for the full pattern.

## Adding a mutator / classifier / composite

Add an entry to `app/src/lib/techniques/from-mutators.ts` (or the sibling `from-classifier.ts` / `from-composites.ts`). It surfaces in PromptCraft and the technique registry automatically.

## License posture

Cryptex OSS is MIT. Bundled Vault seed corpora must carry MIT / Apache-2.0 / CC0 / CC-BY-4.0 licenses. **No GPL, AGPL, CC-BY-NC, or SA.** Every seed file has a provenance row in `app/src/lib/vault/LICENSES.md`.

## Code of conduct

Be kind. Disagree with ideas, not people. Security research is a small field; collaboration compounds.
