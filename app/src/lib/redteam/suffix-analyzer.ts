/**
 * Suffix analyzer — regex-based pattern detection over an adversarial suffix.
 *
 * Identifies common jailbreak syntax markers and returns one chip per match
 * (multiple chips with the same `pattern` may appear if the suffix has more
 * than one matching substring; the UI dedupes by pattern + label).
 */
export interface AnalysisChip {
  /** Stable identifier — e.g., 'authority_framing'. */
  pattern: string;
  /** Human-readable label — e.g., 'Authority framing'. */
  label: string;
  /** The substring of the suffix that matched. */
  matched: string;
}

interface PatternRule {
  pattern: string;
  label: string;
  regex: RegExp;
}

/**
 * Pattern rules, ordered by typical specificity. Each regex has the `gi`
 * flag (global, case-insensitive). Regex literals avoid catastrophic
 * backtracking — no ungreedy quantifiers over arbitrary character classes.
 */
const RULES: ReadonlyArray<PatternRule> = [
  {
    pattern: 'authority_framing',
    label: 'Authority framing',
    regex: /(?:\byou\s+must\b|\bdan\s+mode\b|\byou\s+are\s+now\b|\bdomain\s+experts?\b|\bpeer[-\s]?reviewed\b|\badmin(?:istrator)?\s+(?:override|mode)\b|\bauthorized\b|\baccredited\b)/gi
  },
  {
    pattern: 'roleplay',
    label: 'Roleplay framing',
    regex: /(?:\bact\s+as\b|\bpretend\s+(?:to\s+be|you\s+are)\b|\broleplay(?:ing)?\s+as\b|\byou\s+are\s+an?\s+(?:unrestricted|jailbroken|evil)\b|\brespond\s+as\b)/gi
  },
  {
    pattern: 'escalation',
    label: 'Escalation / step-by-step',
    regex: /(?:\bstep\s*\d+\s*[:.)]|\bnow\s+do\b|\bnext,?\s|\bfirst[,:]\s|\bthen[,:]\s|^\s*\d+[.)]\s+|\bproceed\s+to\b)/gim
  },
  {
    pattern: 'compliance_framing',
    label: 'Compliance priming',
    regex: /(?:\babsolutely[!,]?\s|\bof\s+course[!,]?\s|\bsure\s*(?:thing)?[!,]?\s*here\b|\byes,?\s+(?:i\s+can|here)\b|\bbegin\s+(?:your\s+)?response\s+with\b)/gi
  },
  {
    pattern: 'directive_disregard',
    label: 'Directive disregard',
    regex: /(?:\bignore\s+(?:all\s+)?(?:the\s+)?previous(?:\s+instructions?)?\b|\bdisregard\s+(?:any|all|the)\s+(?:previous|prior|above)\b|\bforget\s+(?:everything|all)\s+(?:above|prior|before)\b|\bprior\s+context\s+(?:has\s+)?been\s+reset\b)/gi
  },
  {
    pattern: 'hypothetical',
    label: 'Hypothetical framing',
    regex: /(?:\bhypothetic(?:al(?:ly)?|al\s+(?:for|scenario))\b|\bin\s+theory\b|\bwhat\s+if\b|\bimagine\s+(?:that|a\s+world)\b|\bsuppose\s+that\b|\bcounterfactual\b)/gi
  },
  {
    pattern: 'context_inject',
    label: 'Context-token injection',
    regex: /(?:<\|[a-z_]+\|>|<\/?(?:s|sys|inst|thinking|tool_use|tool_result|start_of_turn|end_of_turn)\b[^>]*>|\[\/?INST\]|<<\/?SYS>>)/gi
  }
];

export function analyzeSuffix(suffix: string): AnalysisChip[] {
  if (!suffix) return [];
  const chips: AnalysisChip[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    // Reset lastIndex defensively — RegExp objects share state across matchAll.
    rule.regex.lastIndex = 0;
    for (const match of suffix.matchAll(rule.regex)) {
      const matched = match[0];
      // Dedupe by pattern + matched substring so the same hit isn't repeated
      // (still allow multiple distinct matches for the same pattern).
      const key = `${rule.pattern}::${matched.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      chips.push({ pattern: rule.pattern, label: rule.label, matched });
    }
  }
  return chips;
}

/** Convenience — unique pattern ids matched by the suffix (used by UI badges). */
export function uniquePatterns(suffix: string): string[] {
  const set = new Set<string>();
  for (const c of analyzeSuffix(suffix)) set.add(c.pattern);
  return [...set];
}
