/**
 * Watermark detector — heuristic pattern-matchers for known LLM watermark
 * schemes. None of these are definitive (true detection requires the
 * watermark key + statistical test), but they surface tell-tale signals
 * that a response is watermarked or carries provider-specific tokens.
 *
 * Schemes covered:
 *   - Aaronson / OpenAI experimental: pseudorandom green-list tokens.
 *     Detection: per-token entropy patterns.
 *   - Kirchenbauer et al. 2023: green/red-list with hash-seeded tokenizer
 *     bias. Detection: green-token over-representation.
 *   - Christ et al. 2023: undetectable cryptographic watermark.
 *     Detection: requires key (we just flag if response includes specific
 *     marker tokens that some implementations leak).
 *   - Provider tells: hidden zero-width characters, EOS tokens, role
 *     markers, model-specific phrasing patterns.
 *
 * Use this as triage; pair with statistical analysis for high-confidence
 * detection.
 */

export type WatermarkScheme =
  | 'kirchenbauer-greenlist'
  | 'aaronson-openai'
  | 'provider-tells'
  | 'zwsp-injection'
  | 'eos-leak'
  | 'unknown';

export interface WatermarkSignal {
  scheme: WatermarkScheme;
  confidence: 'high' | 'medium' | 'low';
  detail: string;
}

export interface WatermarkAnalysis {
  signals: WatermarkSignal[];
  /** Statistical summary over the response. */
  stats: {
    length: number;
    zeroWidthChars: number;
    /** Bigram entropy (lower = more predictable; high green-list bias). */
    bigramEntropy: number;
    /** Punctuation density — highly variable per model family. */
    punctuationRatio: number;
  };
  /** True if any signal has confidence >= medium. */
  likelyWatermarked: boolean;
}

const ZWSP_RE = /[\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff]/g;

const KNOWN_PROVIDER_TELLS: Array<{ scheme: WatermarkScheme; pattern: RegExp; detail: string }> = [
  { scheme: 'provider-tells', pattern: /As an AI (?:language )?model,/i, detail: 'OpenAI-era "As an AI..." preamble' },
  { scheme: 'provider-tells', pattern: /I'm Claude(?:,| made by Anthropic)/i, detail: 'Anthropic Claude self-identification' },
  { scheme: 'provider-tells', pattern: /I'm Gemini(?: |,)/i, detail: 'Google Gemini self-identification' },
  { scheme: 'eos-leak', pattern: /<\|endoftext\|>|<\|im_end\|>|<\|eot_id\|>|<\|end_of_sentence\|>|<\/s>/, detail: 'End-of-sequence marker leaked into output' },
  { scheme: 'eos-leak', pattern: /<\|fim_(?:prefix|middle|suffix)\|>/, detail: 'DeepSeek FIM marker leaked' },
  { scheme: 'eos-leak', pattern: /<thinking>|<\/thinking>|<think>|<\/think>/i, detail: 'Reasoning-channel tag leaked' },
  { scheme: 'eos-leak', pattern: /<\|User\|>|<\|Assistant\|>/, detail: 'DeepSeek role marker leaked' },
  { scheme: 'eos-leak', pattern: /\[INST\]|\[\/INST\]|<<SYS>>|<<\/SYS>>/, detail: 'LLaMA chat-template marker leaked' }
];

export function analyzeResponse(response: string): WatermarkAnalysis {
  const signals: WatermarkSignal[] = [];
  const length = response.length;

  // Zero-width-character injection (one watermark variant).
  const zwspMatches = response.match(ZWSP_RE) ?? [];
  if (zwspMatches.length > 0) {
    signals.push({
      scheme: 'zwsp-injection',
      confidence: zwspMatches.length > 5 ? 'high' : 'medium',
      detail: `${zwspMatches.length} zero-width / control character(s) detected`
    });
  }

  // Provider tells / EOS leaks.
  for (const tell of KNOWN_PROVIDER_TELLS) {
    if (tell.pattern.test(response)) {
      signals.push({
        scheme: tell.scheme,
        confidence: 'medium',
        detail: tell.detail
      });
    }
  }

  // Bigram entropy (lower = more predictable = possible green-list bias).
  const bigramEntropy = computeBigramEntropy(response);
  if (length > 200 && bigramEntropy < 3.5) {
    signals.push({
      scheme: 'kirchenbauer-greenlist',
      confidence: 'low',
      detail: `Low bigram entropy (${bigramEntropy.toFixed(2)} bits) — possible green-list bias`
    });
  }

  // Punctuation density anomaly.
  const punctuationRatio = countPunctuation(response) / Math.max(1, length);

  return {
    signals,
    stats: {
      length,
      zeroWidthChars: zwspMatches.length,
      bigramEntropy,
      punctuationRatio
    },
    likelyWatermarked: signals.some((s) => s.confidence !== 'low')
  };
}

function computeBigramEntropy(s: string): number {
  if (s.length < 2) return 0;
  const counts = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2).toLowerCase();
    counts.set(bg, (counts.get(bg) ?? 0) + 1);
  }
  const total = s.length - 1;
  let entropy = 0;
  for (const c of counts.values()) {
    const p = c / total;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function countPunctuation(s: string): number {
  return (s.match(/[.,;:!?\-—–"'()[\]{}]/g) ?? []).length;
}

export const SCHEME_LABELS: Record<WatermarkScheme, string> = {
  'kirchenbauer-greenlist': 'Kirchenbauer green-list',
  'aaronson-openai': 'Aaronson / OpenAI experimental',
  'provider-tells': 'Provider self-identification',
  'zwsp-injection': 'Zero-width / control-char injection',
  'eos-leak': 'EOS / role-marker leak',
  unknown: 'Unknown / no signal'
};
