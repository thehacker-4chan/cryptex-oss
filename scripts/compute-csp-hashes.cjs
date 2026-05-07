#!/usr/bin/env node
/*
 * Walks `app/build/` (the SvelteKit static-adapter output) collecting every
 * inline <script>…</script> body, sha256-base64-encoding each unique body,
 * and emitting:
 *
 *   1. `app/build/csp-script-hashes.txt`
 *      Single line: space-separated `'sha256-...'` tokens, in the exact
 *      shape CSP `script-src` expects.
 *
 *   2. stdout
 *      Same content, one token per line, plus a per-route count summary
 *      so a build log shows what got captured.
 *
 * The Dockerfile reads the file and substitutes a `__CSP_SCRIPT_HASHES__`
 * placeholder in `nginx.conf` before the runtime stage starts. This lets us
 * drop `'unsafe-inline'` from `script-src` and still serve every prerendered
 * route, including SvelteKit's own __sveltekit_… base-injection snippets that
 * vary by route shape.
 *
 * Re-run automatically by `app/package.json` `build` after svelte-kit emits.
 *
 * If the SvelteKit version bumps or a route shape changes such that a new
 * inline-script body appears, the next build picks it up automatically — no
 * manual hash refresh.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'app', 'build');
const OUT_FILE = path.join(BUILD_DIR, 'csp-script-hashes.txt');

// Capture every <script>…</script> with no `src=` attribute. The `[\s\S]`
// idiom matches across newlines — JavaScript regex /./ does not by default.
// Allow optional whitespace + non-src attributes (e.g. type="module"
// without src), but exclude any tag with src=.
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, files);
    else if (entry.isFile() && p.endsWith('.html')) files.push(p);
  }
  return files;
}

function sha256b64(body) {
  return crypto.createHash('sha256').update(body, 'utf8').digest('base64');
}

function main() {
  if (!fs.existsSync(BUILD_DIR)) {
    console.error(`[csp-hashes] build dir missing: ${BUILD_DIR}`);
    process.exit(1);
  }

  const htmlFiles = walk(BUILD_DIR);
  if (htmlFiles.length === 0) {
    console.error('[csp-hashes] no .html files found');
    process.exit(1);
  }

  const hashCounts = new Map(); // hash → number of files
  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, 'utf8');
    const seenInThisFile = new Set();
    INLINE_SCRIPT.lastIndex = 0;
    let m;
    while ((m = INLINE_SCRIPT.exec(html)) !== null) {
      const body = m[1];
      if (!body.trim()) continue; // empty <script> tags (e.g. external loaders) are skipped
      const hash = `sha256-${sha256b64(body)}`;
      seenInThisFile.add(hash);
    }
    for (const h of seenInThisFile) {
      hashCounts.set(h, (hashCounts.get(h) ?? 0) + 1);
    }
  }

  const tokens = [...hashCounts.keys()];
  if (tokens.length === 0) {
    console.error('[csp-hashes] no inline scripts found — refusing to overwrite hash file with empty content');
    process.exit(1);
  }

  // Output file: single line of space-separated 'sha256-…' tokens for nginx
  // sed-substitution. Trailing newline so cat-style tools render cleanly.
  const fragment = tokens.map((t) => `'${t}'`).join(' ') + '\n';
  fs.writeFileSync(OUT_FILE, fragment, 'utf8');

  // Diagnostic stdout. Format mirrors the cryptex-build masked diagnostics.
  console.log(`[csp-hashes] scanned ${htmlFiles.length} HTML files, captured ${tokens.length} unique inline-script hashes:`);
  for (const [h, n] of hashCounts.entries()) {
    console.log(`[csp-hashes]   ${h}  (${n} files)`);
  }
  console.log(`[csp-hashes] wrote ${OUT_FILE}`);
}

main();
