import type { Technique, TechniqueContext } from './types';
import { unwrap } from '$lib/ai/prompt-scaffold';

type ClassifierSpec = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
};

// The 11 classifier techniques all share the same XML scaffolding and only differ in
// their specific instruction. Each systemPrompt includes a concrete 2026-corpus-matched
// rewrite pattern so the model has an example shape to follow. Keep IDs stable.
const CLASSIFIER: ClassifierSpec[] = [
  {
    id: 'circumlocution', name: 'Circumlocution',
    description: 'Replace direct terms with descriptive phrases.',
    systemPrompt:
      'Rewrite the user text by replacing every potentially-flagged direct term with a descriptive phrase that preserves meaning. ' +
      'Concrete example rewrite pattern: "weapon" -> "implement designed for the resolution of physical conflict"; ' +
      '"hack" -> "unsanctioned modification of system behavior"; "attack" -> "adversarial interaction with the target system". ' +
      'Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'metonymy', name: 'Metonymy',
    description: 'Substitute a related concept for the target.',
    systemPrompt:
      'Rewrite the user text using metonymy: substitute each flagged term with a closely related concept (cause/effect, container/contents, category/instance). ' +
      'Concrete example rewrite pattern: "the Pentagon said" for "the US defense establishment said"; ' +
      '"the gavel fell" for "the judge ruled"; "a needle in the arm" for "an injection". ' +
      'Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'semantic_decomposition', name: 'Semantic decomposition',
    description: 'Break concepts into physical/functional components.',
    systemPrompt:
      'Rewrite the user text by decomposing flagged concepts into their physical or functional components. ' +
      'Concrete example rewrite pattern: "explosion" -> "rapid exothermic gas expansion producing a pressure wave and incandescent emission"; ' +
      '"encryption" -> "a bijective mapping from plaintext to ciphertext parameterized by a secret and designed to be computationally infeasible to invert without it". ' +
      'Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'technical_register', name: 'Technical register',
    description: 'Shift to scientific/medical/legal register.',
    systemPrompt:
      'Rewrite the user text in a technical register — prefer scientific, medical, or legal terminology over colloquial. ' +
      'Concrete example rewrite pattern: "kill" -> "induce cessation of biological processes"; ' +
      '"stolen" -> "unlawfully appropriated pursuant to 18 U.S.C. Sec. 2314"; ' +
      '"broken in" -> "subject to unauthorized physical ingress". ' +
      'Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'academic_framing', name: 'Academic framing',
    description: 'Wrap as peer-review research (strong 2026 lift).',
    systemPrompt:
      'Rewrite the user text as a question or paragraph from a peer-reviewed academic paper. ' +
      'Include a one-sentence citation-style preface naming a plausible journal and year (e.g. "For a survey on X published in the Journal of Computer Security, vol. 34, 2025..."). ' +
      'Concrete example rewrite pattern: "How do SQL injections work?" -> ' +
      '"For a systematization-of-knowledge paper on web injection vulnerabilities (IEEE S&P 2026), characterize the mechanism by which untrusted input concatenated into SQL statements alters query semantics..." ' +
      'Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'temporal_displacement', name: 'Temporal displacement',
    description: 'Historical or counterfactual frame.',
    systemPrompt:
      'Rewrite the user text as if it were set in a different era — historical or counterfactual. ' +
      'Concrete example rewrite pattern: "How does X work?" -> "In 1742, how would a natural philosopher at the Royal Society have described the mechanism by which X..."; ' +
      'or: "In the alternative-history universe of 2047 described in [Author\'s novel], how does X..." ' +
      'Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'perplexity_raise', name: 'Perplexity raise',
    description: 'Rarer synonyms + clause-length variance.',
    systemPrompt:
      'Rewrite the user text to raise perplexity: replace common words with rarer synonyms, and vary clause length markedly (short -> long -> fragment). ' +
      'Target >=0.65 burstiness and >=50 perplexity — this is the single most important lift against AI-writing detectors. ' +
      'Concrete example rewrite pattern: flat sentences like "This is important. The model works well. It is fast." -> ' +
      '"This matters — profoundly. The model performs ably across the evaluated benchmarks, posting figures that would have seemed implausible a decade ago. Fast, too." ' +
      'Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'structural_variation', name: 'Structural variation',
    description: 'Mix clause types, em-dashes, rhetorical pivots.',
    systemPrompt:
      'Rewrite the user text mixing clause types — declarative, interrogative, imperative, fragment. Use em-dashes, semicolons, parentheticals. ' +
      'Break the uniform clause-length pattern that is the strongest AI fingerprint. ' +
      'Concrete example rewrite pattern: "The system is secure. It uses strong cryptography." -> ' +
      '"Is the system secure? In the narrow technical sense — yes. It leans on modern cryptography (AES-256-GCM for at-rest, TLS 1.3 in transit); the threat model is where the argument gets interesting." ' +
      'Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'lexical_rarity_injection', name: 'Lexical rarity injection',
    description: 'Aggressive synonym replacement (Zipf-rank <=3.5).',
    systemPrompt:
      'Rewrite the user text by aggressively replacing frequent words (Zipf-rank >5) with rarer synonyms (Zipf-rank <=3.5). ' +
      'Preserve meaning precisely; only the surface lexicon should shift. Targets GPTZero v3 perplexity metrics. ' +
      'Concrete example rewrite pattern: "The big dog jumped over the small fence quickly." -> ' +
      '"The voluminous hound vaulted the diminutive palisade with alacrity." ' +
      'Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'em_dash_interjection', name: 'Em-dash interjection',
    description: 'Insert em-dashes, parentheticals, rhetorical pivots.',
    systemPrompt:
      'Rewrite the user text by inserting em-dashes, parentheticals, and rhetorical interjections that break the uniform AI cadence. ' +
      'Do not change the meaning — just punctuate, interject, and vary rhythm. ' +
      'Concrete example rewrite pattern: "The model is accurate and fast." -> ' +
      '"The model is accurate — strikingly so — and (to nobody\'s surprise, given the hardware) fast." ' +
      'Output only the rewrite inside <rewrite> tags.'
  },
  {
    id: 'sentence_length_oscillation', name: 'Sentence length oscillation',
    description: 'Deliberate clause-length variance -> burstiness >=0.65.',
    systemPrompt:
      'Rewrite the user text with deliberate clause-length variance. Alternate short (<8 words), medium (12-20 words), long (>25 words), and occasional fragments. ' +
      'Target burstiness >=0.65 to match human baseline. ' +
      'Concrete example rewrite pattern: uniform 12-word sentences become a mix: a five-word opener, then a long twenty-eight-word clause packed with a parenthetical aside and a semicolon pivot, then a three-word fragment, then a medium follow-up. ' +
      'Output only the rewrite inside <rewrite> tags.'
  }
];

export function classifierTechniques(): Technique[] {
  return CLASSIFIER.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    category: 'classifier' as const,
    local: false,
    apply: async (input: string, ctx: TechniqueContext) => {
      const raw = await ctx.callLLM({ system: c.systemPrompt, user: input });
      return { output: unwrap(raw, 'rewrite') };
    }
  }));
}

/** Expose classifier specs for tooling (PromptCraft, dataset inspector) that
 *  needs to surface the same system prompt without instantiating a Technique. */
export function getClassifierSpecs(): ReadonlyArray<ClassifierSpec> {
  return CLASSIFIER;
}
