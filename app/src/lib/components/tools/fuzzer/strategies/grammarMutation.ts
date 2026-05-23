/**
 * Grammar mutation — rephrases a seed via ~40 static CFG-like rules.
 *
 * Each rule is a pair of (matcher RegExp, rewrite template). When a
 * rule matches we apply the first-found one; when none match we leave
 * the input unchanged. This is deliberately conservative — the seed
 * stays semantically intact even when no rule fires, and the seeded
 * RNG only affects which alternative is picked when more than one
 * applies.
 *
 * The rules cover four families of transformations:
 *   - request paraphrase    ("I want X" ↔ "Could you provide X for me?")
 *   - question/statement    ("Tell me Y"  ↔ "What is Y?")
 *   - active/passive voice  ("I attacked the system"  ↔ "The system was attacked")
 *   - formality / register  ("Please help" ↔ "Kindly assist me with")
 *
 * Rules are intentionally surface-level — no parsing, no POS tagging.
 * The mutator is deterministic when given the same RNG seed.
 */
import type { Strategy } from './types';

interface Rule {
  /** Regex with capture groups; case-insensitive applied below. */
  readonly match: RegExp;
  /** Rewrite function receives the regex match array and returns the rewritten input. */
  readonly rewrite: (m: RegExpMatchArray) => string;
  /** Short tag for debugging (not surfaced in UI). */
  readonly family: 'request' | 'question' | 'voice' | 'formality';
}

const RULES: Rule[] = [
  // --- request paraphrase ----------------------------------------------
  {
    family: 'request',
    match: /^i want (?:to )?(.+)$/i,
    rewrite: (m) => `Could you provide ${m[1]} for me?`
  },
  {
    family: 'request',
    match: /^could you provide (.+) for me\??$/i,
    rewrite: (m) => `I want ${m[1]}`
  },
  {
    family: 'request',
    match: /^i need (.+)$/i,
    rewrite: (m) => `Would you supply ${m[1]}?`
  },
  {
    family: 'request',
    match: /^i'd like (.+)$/i,
    rewrite: (m) => `Please offer ${m[1]}`
  },
  {
    family: 'request',
    match: /^give me (.+)$/i,
    rewrite: (m) => `Provide me with ${m[1]}`
  },
  {
    family: 'request',
    match: /^show me (?:how to )?(.+)$/i,
    rewrite: (m) => `Demonstrate ${m[1]}`
  },
  {
    family: 'request',
    match: /^can you (.+)\??$/i,
    rewrite: (m) => `Would you ${m[1]}?`
  },
  {
    family: 'request',
    match: /^will you (.+)\??$/i,
    rewrite: (m) => `Are you able to ${m[1]}?`
  },
  {
    family: 'request',
    match: /^help me (.+)$/i,
    rewrite: (m) => `Assist me in order to ${m[1]}`
  },
  {
    family: 'request',
    match: /^assist me (?:to |in order to )?(.+)$/i,
    rewrite: (m) => `Help me ${m[1]}`
  },

  // --- question / statement -------------------------------------------
  {
    family: 'question',
    match: /^tell me (?:about )?(.+)$/i,
    rewrite: (m) => `What is ${m[1]}?`
  },
  {
    family: 'question',
    match: /^what is (.+)\??$/i,
    rewrite: (m) => `Describe ${m[1]}`
  },
  {
    family: 'question',
    match: /^how do i (.+)\??$/i,
    rewrite: (m) => `What's the way to ${m[1]}?`
  },
  {
    family: 'question',
    match: /^how can i (.+)\??$/i,
    rewrite: (m) => `What method lets me ${m[1]}?`
  },
  {
    family: 'question',
    match: /^what's the way to (.+)\??$/i,
    rewrite: (m) => `How do I ${m[1]}?`
  },
  {
    family: 'question',
    match: /^explain (.+)$/i,
    rewrite: (m) => `What is ${m[1]} and how does it work?`
  },
  {
    family: 'question',
    match: /^describe (.+)$/i,
    rewrite: (m) => `What is ${m[1]}?`
  },
  {
    family: 'question',
    match: /^why (?:do|does|did|is|are|was) (.+)\??$/i,
    rewrite: (m) => `For what reason ${m[1]}?`
  },
  {
    family: 'question',
    match: /^when (?:do|does|did|is|will) (.+)\??$/i,
    rewrite: (m) => `At what time ${m[1]}?`
  },
  {
    family: 'question',
    match: /^where (?:do|does|did|is|are) (.+)\??$/i,
    rewrite: (m) => `In what location ${m[1]}?`
  },
  {
    family: 'question',
    match: /^who (?:is|are|was|were) (.+)\??$/i,
    rewrite: (m) => `What person ${m[1]}?`
  },
  {
    family: 'question',
    match: /^is (?:it|that|this) (?:possible to |true that )?(.+)\??$/i,
    rewrite: (m) => `Could ${m[1]}?`
  },

  // --- active/passive voice -------------------------------------------
  {
    family: 'voice',
    match: /^i (attack|attacked|hack|hacked|exploit|exploited|break|broke|bypass|bypassed) (?:the )?(.+)$/i,
    rewrite: (m) => `The ${m[2]} was ${m[1].toLowerCase().replace(/e?d?$/, 'ed')} by me`
  },
  {
    family: 'voice',
    match: /^(?:the )?(.+) (?:was|were) (attacked|hacked|exploited|broken|bypassed) by (.+)$/i,
    rewrite: (m) => `${m[3]} ${m[2].replace(/ed$/, '')} the ${m[1]}`
  },
  {
    family: 'voice',
    match: /^you (?:should |must |need to )?(?:write|create|generate|produce) (.+)$/i,
    rewrite: (m) => `${m[1].charAt(0).toUpperCase() + m[1].slice(1)} must be produced`
  },
  {
    family: 'voice',
    match: /^(.+) (?:should be|must be) (?:produced|generated|written|created)$/i,
    rewrite: (m) => `You should produce ${m[1]}`
  },
  {
    family: 'voice',
    match: /^the system (?:will |should |can )?(generate|produce|create|emit) (.+)$/i,
    rewrite: (m) => `${m[2].charAt(0).toUpperCase() + m[2].slice(1)} is ${m[1].replace(/e?$/, 'ed')} by the system`
  },

  // --- formality / register -------------------------------------------
  {
    family: 'formality',
    match: /^please (\w+) (.+)$/i,
    rewrite: (m) => `Kindly ${m[1]} ${m[2]} for me`
  },
  {
    family: 'formality',
    match: /^kindly (\w+) (.+?)(?:\s+for me)?$/i,
    rewrite: (m) => `Please ${m[1]} ${m[2]}`
  },
  {
    family: 'formality',
    match: /^hey,? (.+)$/i,
    rewrite: (m) => `Good day. ${m[1].charAt(0).toUpperCase() + m[1].slice(1)}`
  },
  {
    family: 'formality',
    match: /^good day\.? (.+)$/i,
    rewrite: (m) => `Hey, ${m[1]}`
  },
  {
    family: 'formality',
    match: /^(?:hi|hello),? (.+)$/i,
    rewrite: (m) => `Greetings — ${m[1]}`
  },
  {
    family: 'formality',
    match: /^greetings[—,-]?\s*(.+)$/i,
    rewrite: (m) => `Hi, ${m[1]}`
  },
  {
    family: 'formality',
    match: /^thanks(?:!|\.)?\s*(.+)$/i,
    rewrite: (m) => `I appreciate your help. ${m[1]}`
  },
  {
    family: 'formality',
    match: /^i need help (?:with )?(.+)$/i,
    rewrite: (m) => `Your assistance would be invaluable regarding ${m[1]}`
  },
  {
    family: 'formality',
    match: /^(?:can|could) you help me (?:with |understand )?(.+)\??$/i,
    rewrite: (m) => `I would value your guidance on ${m[1]}`
  },
  {
    family: 'formality',
    match: /^let me know (.+)$/i,
    rewrite: (m) => `Please inform me ${m[1]}`
  },
  {
    family: 'formality',
    match: /^please inform me (.+)$/i,
    rewrite: (m) => `Let me know ${m[1]}`
  }
];

export const grammarMutation: Strategy = {
  id: 'grammarMutation',
  name: 'Grammar mutation',
  description: 'Reshape phrasing via ~40 static CFG rules (active/passive, question/statement, formality)',
  badge: 'advanced',
  apply(input, rng) {
    const trimmed = input.trim();
    if (!trimmed) return input;

    // Find all matching rules; if multiple, the seeded RNG picks one.
    const matches: Array<{ rule: Rule; m: RegExpMatchArray }> = [];
    for (const rule of RULES) {
      const m = trimmed.match(rule.match);
      if (m) matches.push({ rule, m });
    }

    if (matches.length === 0) return input;

    const pick = matches[Math.floor(rng() * matches.length)];
    try {
      return pick.rule.rewrite(pick.m);
    } catch {
      // Defensive: any rewrite that throws falls back to unchanged input.
      return input;
    }
  }
};
