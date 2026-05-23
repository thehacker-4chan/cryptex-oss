/**
 * Module-level state for the Fuzzer (Mutation Lab) tool. Survives tab switches.
 */
import { DEFAULT_FUZZER, type FuzzerOptions, type FuzzVariant } from './fuzzer';

let input = $state('');
let opts = $state<FuzzerOptions>({ ...DEFAULT_FUZZER });
let variants = $state<FuzzVariant[]>([]);
let showMutationLog = $state(false);

export const fuzzerState = {
  get input() { return input; },
  set input(v: string) { input = v; },

  get opts() { return opts; },
  set opts(v: FuzzerOptions) { opts = v; },

  get variants() { return variants; },
  set variants(v: FuzzVariant[]) { variants = v; },

  get showMutationLog() { return showMutationLog; },
  set showMutationLog(v: boolean) { showMutationLog = v; },

  reset() {
    input = '';
    opts = { ...DEFAULT_FUZZER };
    variants = [];
    showMutationLog = false;
  }
};
