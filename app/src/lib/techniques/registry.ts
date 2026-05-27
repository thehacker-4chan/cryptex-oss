import type { Technique, TechniqueCategory } from './types';
import { mutatorTechniques } from './from-mutators';
import { classifierTechniques } from './from-classifier';
import { compositeTechniques } from './from-composites';
import { modes } from './modes';
import { prefillTechniques } from './from-prefills';

let _all: Technique[] | null = null;

function build(): Technique[] {
  return [
    ...mutatorTechniques(),
    ...classifierTechniques(),
    ...compositeTechniques(),
    ...modes,
    ...prefillTechniques()
  ];
}

export function allTechniques(): Technique[] {
  if (!_all) _all = build();
  return _all;
}

/**
 * Invalidate the cached technique list. Callers that register a custom
 * technique at runtime can dispatch `registry:refresh-custom` on `window`
 * (or call this directly) to force the next `allTechniques()` call to
 * rebuild from source.
 */
export function refreshCustom(): void {
  _all = null;
}

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
