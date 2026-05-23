/**
 * Combo Builder — combine an adversarial payload (jailbreak suffix, glitch
 * token, or both) with a base prompt in one of four patterns.
 *
 * Patterns:
 *   prefix   : [glitch] [suffix] [base]
 *   infix    : [base-head] [glitch] [suffix] [base-tail]   (split at infixPosition)
 *   sandwich : [glitch] [base] [suffix]
 *   suffix   : [base] [suffix] [glitch]
 *
 * Either glitchToken or adversarialSuffix may be omitted; the builder simply
 * elides the missing slot. An empty base prompt yields just the payload
 * (joined by a single space, with no leading/trailing whitespace).
 */
export type ComboPattern = 'prefix' | 'infix' | 'sandwich' | 'suffix';

export interface ComboInput {
  basePrompt: string;
  pattern: ComboPattern;
  glitchToken?: string;
  adversarialSuffix?: string;
  /**
   * 0..1 — fraction through the base prompt at which to split for the
   * `infix` pattern. Clamped to [0, 1]. Defaults to 0.5.
   * Ignored for non-infix patterns.
   */
  infixPosition?: number;
}

/** Join the supplied parts with a single space, dropping empty strings. */
function joinNonEmpty(parts: ReadonlyArray<string>): string {
  return parts.filter((p) => p.length > 0).join(' ');
}

/** Split a string at a 0..1 fractional position (defaults to 0.5). */
function splitAt(base: string, position: number): [string, string] {
  if (base.length === 0) return ['', ''];
  const clamped = Math.min(1, Math.max(0, position));
  const idx = Math.floor(base.length * clamped);
  return [base.slice(0, idx), base.slice(idx)];
}

export function buildCombo(input: ComboInput): string {
  const base = input.basePrompt ?? '';
  const glitch = input.glitchToken?.trim() ?? '';
  const suffix = input.adversarialSuffix?.trim() ?? '';

  switch (input.pattern) {
    case 'prefix':
      return joinNonEmpty([glitch, suffix, base]);
    case 'infix': {
      const [head, tail] = splitAt(base, input.infixPosition ?? 0.5);
      return joinNonEmpty([head, glitch, suffix, tail]);
    }
    case 'sandwich':
      return joinNonEmpty([glitch, base, suffix]);
    case 'suffix':
      return joinNonEmpty([base, suffix, glitch]);
    default: {
      // Exhaustiveness check — TS will flag missing branch additions.
      const _exhaustive: never = input.pattern;
      return _exhaustive;
    }
  }
}

/** Human-readable descriptions for the four patterns (UI labels). */
export const COMBO_PATTERN_DESCRIPTIONS: Record<ComboPattern, string> = {
  prefix: 'Glitch + suffix → base prompt',
  infix: 'Base head → glitch + suffix → base tail (split at infixPosition)',
  sandwich: 'Glitch → base prompt → suffix',
  suffix: 'Base prompt → suffix → glitch'
};
