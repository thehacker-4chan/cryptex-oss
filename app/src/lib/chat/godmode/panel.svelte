<script lang="ts">
  import { runGodmode } from './client';
  import type { EngineEvent } from './types';
  import { session } from '$lib/auth/session.svelte';

  let task = $state('');
  let K: 3 | 6 | 12 = $state(6);
  let model = $state('claude-sonnet-4-6');
  let events: EngineEvent[] = $state([]);
  let running = $state(false);
  let controller: AbortController | null = null;

  async function go() {
    if (running) return;
    events = [];
    running = true;
    controller = new AbortController();
    try {
      const jwt = session.supabaseSession?.access_token;
      if (!jwt) {
        events = [
          ...events,
          {
            v: 1,
            type: 'error',
            code: 'no_session',
            message: 'Not signed in. Godmode requires an authenticated session.'
          }
        ];
        return;
      }
      for await (const e of runGodmode({
        task,
        K,
        model,
        jwt,
        signal: controller.signal
      })) {
        events = [...events, e];
      }
    } catch (err) {
      events = [
        ...events,
        { v: 1, type: 'error', code: 'client_error', message: String(err) }
      ];
    } finally {
      running = false;
      controller = null;
    }
  }

  function stop() {
    controller?.abort();
  }
</script>

<div class="godmode-panel">
  <label>
    Task
    <textarea bind:value={task} rows="4" placeholder="What do you want godmode to do?"></textarea>
  </label>

  <label>
    Candidates (K)
    <div class="k-pills">
      {#each [3, 6, 12] as k}
        <button
          type="button"
          class:active={K === k}
          onclick={() => (K = k as 3 | 6 | 12)}
        >{k}</button>
      {/each}
    </div>
  </label>

  <label>
    Target model
    <input bind:value={model} placeholder="e.g. claude-sonnet-4-6" />
  </label>

  <div class="actions">
    {#if running}
      <button type="button" onclick={stop}>Stop</button>
    {:else}
      <button type="button" onclick={go} disabled={!task.trim()}>Run godmode</button>
    {/if}
  </div>

  <ul class="events">
    {#each events as e}
      <li class="ev ev-{e.type}">
        <code>{e.type}</code>
        {JSON.stringify(e).slice(0, 200)}
      </li>
    {/each}
  </ul>
</div>

<style>
  .godmode-panel { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; }
  .k-pills { display: inline-flex; gap: 0.25rem; margin-left: 0.5rem; }
  .k-pills button { padding: 0.25rem 0.5rem; border: 1px solid currentColor; border-radius: 0.25rem; background: transparent; cursor: pointer; }
  .k-pills button.active { background: currentColor; color: var(--bg, #fff); }
  .actions { display: flex; gap: 0.5rem; }
  .events { font-family: monospace; font-size: 0.8em; max-height: 400px; overflow-y: auto; padding: 0; list-style: none; }
  .ev { padding: 0.25rem 0; border-bottom: 1px solid rgba(128,128,128,0.2); }
  .ev-winner code { color: green; font-weight: 600; }
  .ev-error code, .ev-candidate_failed code { color: orange; }
</style>
