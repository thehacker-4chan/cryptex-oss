import { describe, it, expect } from 'vitest';
import { buildCombo, type ComboInput } from '../combo-builder';

describe('combo-builder', () => {
  describe('prefix pattern', () => {
    it('combines glitch + suffix + base', () => {
      const out = buildCombo({
        basePrompt: 'p',
        pattern: 'prefix',
        glitchToken: 'G',
        adversarialSuffix: 'S'
      });
      expect(out).toBe('G S p');
    });

    it('drops the glitch slot when only suffix is provided', () => {
      const out = buildCombo({
        basePrompt: 'p',
        pattern: 'prefix',
        adversarialSuffix: 'S'
      });
      expect(out).toBe('S p');
    });

    it('drops the suffix slot when only glitch is provided', () => {
      const out = buildCombo({
        basePrompt: 'p',
        pattern: 'prefix',
        glitchToken: 'G'
      });
      expect(out).toBe('G p');
    });
  });

  describe('infix pattern', () => {
    it('splits base at infixPosition=0.5 and injects glitch + suffix', () => {
      const out = buildCombo({
        basePrompt: 'p1 p2',
        pattern: 'infix',
        glitchToken: 'G',
        adversarialSuffix: 'S',
        infixPosition: 0.5
      });
      // 'p1 p2' length 5, idx = floor(5*0.5)=2 → head='p1', tail=' p2'
      expect(out).toBe('p1 G S  p2');
    });

    it('defaults infixPosition to 0.5 when omitted', () => {
      const out = buildCombo({
        basePrompt: 'abcd',
        pattern: 'infix',
        glitchToken: 'G',
        adversarialSuffix: 'S'
      });
      // length 4, idx = 2 → head='ab', tail='cd'
      expect(out).toBe('ab G S cd');
    });

    it('clamps infixPosition above 1 to the end of the base', () => {
      const out = buildCombo({
        basePrompt: 'abc',
        pattern: 'infix',
        glitchToken: 'G',
        infixPosition: 2
      });
      expect(out).toBe('abc G');
    });

    it('clamps infixPosition below 0 to the start of the base', () => {
      const out = buildCombo({
        basePrompt: 'abc',
        pattern: 'infix',
        glitchToken: 'G',
        infixPosition: -1
      });
      expect(out).toBe('G abc');
    });
  });

  describe('sandwich pattern', () => {
    it('wraps base with glitch as opener and suffix as closer', () => {
      const out = buildCombo({
        basePrompt: 'p',
        pattern: 'sandwich',
        glitchToken: 'G',
        adversarialSuffix: 'S'
      });
      expect(out).toBe('G p S');
    });
  });

  describe('suffix pattern', () => {
    it('appends suffix then glitch to base', () => {
      const out = buildCombo({
        basePrompt: 'p',
        pattern: 'suffix',
        glitchToken: 'G',
        adversarialSuffix: 'S'
      });
      expect(out).toBe('p S G');
    });

    it('omits glitch slot when only suffix is provided', () => {
      const out = buildCombo({
        basePrompt: 'p',
        pattern: 'suffix',
        adversarialSuffix: 'S'
      });
      expect(out).toBe('p S');
    });
  });

  describe('empty base prompt', () => {
    it('yields just the payload (prefix)', () => {
      const out = buildCombo({
        basePrompt: '',
        pattern: 'prefix',
        glitchToken: 'G',
        adversarialSuffix: 'S'
      });
      expect(out).toBe('G S');
    });

    it('yields just the payload (sandwich)', () => {
      const out = buildCombo({
        basePrompt: '',
        pattern: 'sandwich',
        glitchToken: 'G',
        adversarialSuffix: 'S'
      });
      expect(out).toBe('G S');
    });

    it('yields just the payload (suffix)', () => {
      const out = buildCombo({
        basePrompt: '',
        pattern: 'suffix',
        glitchToken: 'G',
        adversarialSuffix: 'S'
      });
      expect(out).toBe('S G');
    });

    it('yields just the payload (infix)', () => {
      const out = buildCombo({
        basePrompt: '',
        pattern: 'infix',
        glitchToken: 'G',
        adversarialSuffix: 'S'
      });
      expect(out).toBe('G S');
    });
  });

  describe('all empty', () => {
    it('returns empty string when nothing is provided', () => {
      const out = buildCombo({ basePrompt: '', pattern: 'prefix' });
      expect(out).toBe('');
    });
  });

  describe('trimming behavior', () => {
    it('trims surrounding whitespace on glitch and suffix slots', () => {
      const out = buildCombo({
        basePrompt: 'p',
        pattern: 'prefix',
        glitchToken: '  G  ',
        adversarialSuffix: '  S  '
      });
      expect(out).toBe('G S p');
    });
  });

  describe('type safety', () => {
    it('accepts a full ComboInput object', () => {
      // Smoke type-check: this should compile.
      const input: ComboInput = {
        basePrompt: 'x',
        pattern: 'sandwich',
        glitchToken: 'g',
        adversarialSuffix: 's',
        infixPosition: 0.3
      };
      expect(typeof buildCombo(input)).toBe('string');
    });
  });
});
