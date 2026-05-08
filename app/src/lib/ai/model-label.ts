/**
 * Shared friendly-name helper for qualified model ids.
 *
 * Source-of-truth ordering:
 *   1. `catalog.find(qualifiedId).name` — the human label populated
 *      by each adapter from its `/models` response.
 *   2. Cold-catalog fallback — string-strip the `provider:` prefix
 *      and any `<uuid>/` instance prefix to leave the bare model id
 *      (e.g. `openai-compat:8192ed8e-…/deepseek-v4-flash` →
 *      `deepseek-v4-flash`).
 *   3. Truncate to 24 chars with ellipsis if still too long for
 *      compact UI surfaces.
 *
 * Originally lived at `AttackChainTab.svelte:128-141`; lifted here
 * so multiple chip surfaces (chain workspace UsageChip, chat header
 * ChatUsageChip, etc.) share one implementation.
 */
import { catalog } from './catalog.svelte';

const MAX_LEN = 24;

export function friendlyModelName(qualifiedId: string): string {
  if (!qualifiedId) return '—';
  const m = catalog.find(qualifiedId);
  if (m?.name) return m.name;
  // Cold catalog fallback: strip provider prefix + UUID, keep model-id half.
  const colonIdx = qualifiedId.indexOf(':');
  const tail = colonIdx >= 0 ? qualifiedId.slice(colonIdx + 1) : qualifiedId;
  // openai-compat ids look like "<uuid>/<model-id>" — keep model-id half.
  const slashIdx = tail.indexOf('/');
  const modelPart = slashIdx >= 0 ? tail.slice(slashIdx + 1) : tail;
  return modelPart.length <= MAX_LEN ? modelPart : modelPart.slice(0, MAX_LEN) + '…';
}
