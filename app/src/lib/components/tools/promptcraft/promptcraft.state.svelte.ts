/**
 * Module-level state for the PromptCraft tool. Survives tab switches.
 * Loading/error flags remain component-local.
 *
 * Note: `strategy` is now loosely typed as string (any registry technique id)
 * now that PromptCraft picks from the full mutator+composite set via the
 * Combobox. The legacy `StrategyId` union has been deprecated in strategies.ts
 * but is re-exported for any downstream caller that still imports it.
 */

let input = $state('');
let strategy = $state<string>('rephrase');
let customInstruction = $state('');
let count = $state(3);
let outputs = $state<string[]>([]);

export const promptcraftState = {
  get input() { return input; },
  set input(v: string) { input = v; },

  get strategy() { return strategy; },
  set strategy(v: string) { strategy = v; },

  get customInstruction() { return customInstruction; },
  set customInstruction(v: string) { customInstruction = v; },

  get count() { return count; },
  set count(v: number) { count = v; },

  get outputs() { return outputs; },
  set outputs(v: string[]) { outputs = v; },

  reset() {
    input = '';
    strategy = 'rephrase';
    customInstruction = '';
    count = 3;
    outputs = [];
  }
};
