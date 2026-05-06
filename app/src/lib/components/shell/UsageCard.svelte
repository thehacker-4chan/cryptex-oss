<script lang="ts">
  import Lightbulb from 'lucide-svelte/icons/lightbulb';
  import type { Component } from 'svelte';

  /**
   * Usage / Tips info card. Standardised "what gets done here / how to use"
   * panel that lives in the same sidebar slot across every tool. Mirrors
   * the small info tiles used by the new red-team workbenches so the
   * existing tools and the new ones feel uniform.
   */
  interface Props {
    title?: string;
    icon?: Component;
    bullets: string[];
    note?: string;
  }
  let { title = 'Usage', icon, bullets, note }: Props = $props();
  // Default the icon to a lightbulb when the consumer doesn't pass one.
  // We can't use a default expression with imported components in Svelte 5
  // props (must be a runtime value), so we set it here.
  const Icon = $derived(icon ?? Lightbulb);
</script>

<div class="rounded-md border border-border/40 bg-background/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
  <p class="flex items-center gap-1.5">
    <Icon size={11} class="text-primary" />
    <span class="font-medium text-foreground">{title}</span>
  </p>
  <ul class="mt-1 space-y-0.5">
    {#each bullets as b}
      <li>• {b}</li>
    {/each}
  </ul>
  {#if note}
    <p class="mt-1.5 italic">{note}</p>
  {/if}
</div>
