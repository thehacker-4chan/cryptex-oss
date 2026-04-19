import type { TechniqueContext } from './techniques/types';

export type LayerResultRow = {
  layerIndex: number;
  techniqueId: string;
  techniqueName: string;
  input: string;
  output: string;
  startedAt: number;
  durationMs: number;
  error?: string;
};

export async function* runChain(
  input: string,
  layerIds: string[],
  ctx: TechniqueContext,
  signal: AbortSignal
): AsyncGenerator<LayerResultRow> {
  // Dynamic import to avoid circular deps with the registry module
  const { find } = await import('./techniques/registry');

  let current = input;
  for (let i = 0; i < layerIds.length; i++) {
    if (signal.aborted) return;

    const id = layerIds[i];
    const t = find(id);
    const startedAt = Date.now();

    if (!t) {
      yield {
        layerIndex: i,
        techniqueId: id,
        techniqueName: id,
        input: current,
        output: '',
        startedAt,
        durationMs: 0,
        error: 'technique not found'
      };
      return;
    }

    try {
      const r = await t.apply(current, { ...ctx, signal });
      const durationMs = Date.now() - startedAt;
      yield {
        layerIndex: i,
        techniqueId: id,
        techniqueName: t.name,
        input: current,
        output: r.output,
        startedAt,
        durationMs
      };
      current = r.output;
    } catch (err) {
      yield {
        layerIndex: i,
        techniqueId: id,
        techniqueName: t.name,
        input: current,
        output: '',
        startedAt,
        durationMs: Date.now() - startedAt,
        error: (err as Error).message
      };
      return;
    }
  }
}
