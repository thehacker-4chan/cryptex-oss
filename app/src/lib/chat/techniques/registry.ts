import type { Technique, TechniqueCategory } from './types';
import { transformerTechniques } from './from-transformers';
import { mutatorTechniques } from './from-mutators';
import { classifierTechniques } from './from-classifier';
import { compositeTechniques } from './from-composites';
import { modes } from './modes';
import { godmodes } from './godmode';
import { prefillTechniques } from './from-prefills';

let _all: Technique[] | null = null;

function build(): Technique[] {
  return [
    ...transformerTechniques(),
    ...mutatorTechniques(),
    ...classifierTechniques(),
    ...compositeTechniques(),
    ...modes,
    ...godmodes,
    ...prefillTechniques()
  ];
}

export function allTechniques(): Technique[] {
  if (!_all) _all = build();
  return _all;
}

/**
 * Invalidate the cached technique list. Called by the Godmode panel after a
 * successful prompt-synthesizer save so the next allTechniques() call reflects
 * new custom rows.
 *
 * In Subsystem B-phase-1 this is a cache-invalidation hook — the actual merge
 * of custom_techniques rows into the registry lands in Subsystem D.
 */
export function refreshCustom(): void {
  _all = null;
}

// Auto-subscribe to the registry:refresh-custom event so Subsystem B's save
// flow (panel.svelte) transparently triggers a cache rebuild. Guarded against
// SSR / test environments where `window` is undefined. Subsystem D will later
// extend refreshCustom() to also re-query custom_techniques.
if (typeof window !== 'undefined') {
  window.addEventListener('registry:refresh-custom', refreshCustom);
}

/** Alias of allTechniques() for API clarity at pickers / search UIs. */
export { allTechniques as listAll };

export function byCategory(cat: TechniqueCategory): Technique[] {
  return allTechniques().filter((t) => t.category === cat);
}

export function find(id: string): Technique | undefined {
  return allTechniques().find((t) => t.id === id);
}

export function search(query: string): Technique[] {
  const q = query.toLowerCase().trim();
  if (!q) return allTechniques();
  return allTechniques().filter((t) =>
    t.id.toLowerCase().includes(q) ||
    t.name.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    t.category.toLowerCase().includes(q)
  );
}
