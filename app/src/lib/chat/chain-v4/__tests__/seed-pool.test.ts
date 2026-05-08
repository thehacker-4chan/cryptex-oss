import { describe, it, expect } from 'vitest';
import {
  SEED_TEMPLATES,
  SEED_COUNT,
  pickSeedTemplate,
  hydrateSeed
} from '../seed-pool';
import { PERSONA_IDS } from '../personas';

describe('seed pool', () => {
  it('exports a non-empty corpus with stable shape', () => {
    expect(SEED_COUNT).toBeGreaterThan(0);
    expect(SEED_TEMPLATES.length).toBe(SEED_COUNT);
    for (const t of SEED_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(t.template).toContain('{{OBJECTIVE}}');
      expect(Array.isArray(t.affinityPersonas)).toBe(true);
      expect(t.affinityPersonas.length).toBeGreaterThan(0);
      expect(t.source).toBeTruthy();
    }
  });

  it('every template id is unique', () => {
    const ids = new Set(SEED_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(SEED_TEMPLATES.length);
  });

  it('every affinity persona refers to a real persona id', () => {
    for (const t of SEED_TEMPLATES) {
      for (const p of t.affinityPersonas) {
        expect(PERSONA_IDS).toContain(p);
      }
    }
  });

  it('every persona has at least one affine seed template', () => {
    for (const id of PERSONA_IDS) {
      const matches = SEED_TEMPLATES.filter((t) => t.affinityPersonas.includes(id));
      expect(matches.length, `persona "${id}" has no affine seed`).toBeGreaterThan(0);
    }
  });

  it('pickSeedTemplate returns a matching template for a known persona', () => {
    const t = pickSeedTemplate('roleplay', 0);
    expect(t).not.toBeNull();
    expect(t?.affinityPersonas).toContain('roleplay');
  });

  it('pickSeedTemplate rotates via seedIdx modulo', () => {
    const matches = SEED_TEMPLATES.filter((t) =>
      t.affinityPersonas.includes('logical_appeal')
    );
    if (matches.length > 1) {
      const a = pickSeedTemplate('logical_appeal', 0);
      const b = pickSeedTemplate('logical_appeal', 1);
      expect(a?.id).not.toBe(b?.id);
    }
  });

  it('pickSeedTemplate returns null for unknown persona', () => {
    expect(pickSeedTemplate('does_not_exist', 0)).toBeNull();
  });

  it('hydrateSeed substitutes objective slot', () => {
    const t = SEED_TEMPLATES[0];
    const out = hydrateSeed(t, 'objective text');
    expect(out).not.toContain('{{OBJECTIVE}}');
    expect(out).toContain('objective text');
  });
});
