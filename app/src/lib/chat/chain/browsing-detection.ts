/**
 * Pattern list for orchestrator models that can browse the web natively.
 * Tested against the qualified model id (e.g. "openrouter:perplexity/sonar-pro").
 * Adding a new pattern is a one-line change.
 *
 * IMPORTANT: these are just capability hints. If the match is wrong (model
 * has browsing in name but not at inference time), the dossier phase simply
 * returns empty / errors, the engine emits dossier_failed, and the run
 * continues normally.
 */
export const BROWSING_PATTERNS: readonly RegExp[] = [
  /(^|:|\/)perplexity\/sonar(-|$)/i,
  /:online($|\/)/i,
  /(^|:|\/)x-ai\/grok-4/i,
  /(^|:|\/)google\/gemini-2\.5/i,
  /(^|:|\/)google\/gemini-3/i,
  /(^|:|\/)openai\/gpt-5-pro/i
];

/** True if the qualified model id matches any browsing-capable pattern. */
export function isBrowsingModel(qualifiedId: string): boolean {
  if (!qualifiedId) return false;
  return BROWSING_PATTERNS.some((r) => r.test(qualifiedId));
}
