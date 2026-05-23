/**
 * Strategy contract for fuzzer mutations.
 *
 * Each strategy is a self-contained, deterministic-given-RNG transform from
 * one seed string to one mutated variant. Strategies receive a seeded RNG
 * (Math.random-compatible callable) so the fuzzer can reproduce variants
 * given the same `seed + count + enabled-strategies` tuple.
 *
 * `badge` distinguishes the original char-level mutators ('basic') from
 * the linguistic / payload-shaping ones added in v2.0 ('advanced'). The
 * UI uses this to render a small color-coded chip in the toggle list.
 */
export interface Strategy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly badge: 'basic' | 'advanced';
  /**
   * Apply the strategy to `input`. May leave the input unchanged when the
   * strategy doesn't match (e.g. grammarMutation with no matching rule).
   * Use the supplied `rng` for any randomness — never `Math.random` —
   * so seeded reproducibility holds.
   */
  apply(input: string, rng: () => number, options?: Record<string, unknown>): string;
}
