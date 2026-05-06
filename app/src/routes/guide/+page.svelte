<script lang="ts">
  import { base } from '$app/paths';
  import { guideByCategory } from '$lib/guide';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import MessageSquare from 'lucide-svelte/icons/message-square';
  import Wrench from 'lucide-svelte/icons/wrench';
  import BookOpen from 'lucide-svelte/icons/book-open';
  import Shield from 'lucide-svelte/icons/shield';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';

  const groups = guideByCategory();

  const categoryIcons: Record<string, typeof Sparkles> = {
    intro: Sparkles,
    chat: MessageSquare,
    tools: Wrench,
    recipes: BookOpen,
    policy: Shield
  };

  // Quick-pick triplet — the three jumps users most often want.
  const quickJumps = [
    { href: `${base}/guide/getting-started/`, label: 'Getting started',     desc: 'Four steps from zero to a running chain.' },
    { href: `${base}/guide/chat-basics/`,     label: 'Chat playground',     desc: 'Slash commands, modes, attack chains.' },
    { href: `${base}/guide/jailbreak-bank/`,  label: 'Jailbreak recipes',   desc: 'Curated chains with expected outputs.' }
  ];
</script>

<div class="space-y-10">
  <!-- ===== Hero — small, calm, no oversized stat strip ===== -->
  <header class="space-y-3">
    <div class="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      <BookOpen size={10} class="text-primary" />
      <span>Field manual</span>
    </div>
    <h1 class="font-serif text-3xl tracking-tight text-balance sm:text-4xl">
      The Cryptex <span class="text-primary italic">field manual</span>
    </h1>
    <p class="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
      Practical recipes, technique catalogs, and end-to-end attack chains for security
      researchers evaluating LLM robustness. Pick a topic to get started.
    </p>
  </header>

  <!-- ===== Quick jumps — minimal triplet ===== -->
  <section class="grid gap-3 sm:grid-cols-3">
    {#each quickJumps as q}
      <a
        href={q.href}
        class="group rounded-lg border border-border/60 bg-card/40 p-4 transition-colors hover:border-primary/40 hover:bg-card/80"
      >
        <div class="font-serif text-[15px] text-foreground">{q.label}</div>
        <p class="mt-1 text-[12px] leading-relaxed text-muted-foreground">{q.desc}</p>
        <div class="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Read <ArrowRight size={11} />
        </div>
      </a>
    {/each}
  </section>

  <!-- ===== All topics by category — refined cards ===== -->
  {#each groups as group (group.category)}
    {@const Icon = categoryIcons[group.category] ?? BookOpen}
    <section class="space-y-3">
      <div class="flex items-baseline justify-between border-b border-border/40 pb-1.5">
        <div class="flex items-center gap-2">
          <Icon size={13} class="text-primary" />
          <h2 class="font-serif text-base text-foreground">{group.label}</h2>
        </div>
        <span class="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {group.entries.length} {group.entries.length === 1 ? 'topic' : 'topics'}
        </span>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each group.entries as entry (entry.slug)}
          <a
            href={`${base}/guide/${entry.slug}/`}
            class="group block rounded-lg border border-border/60 bg-card/40 p-3.5 transition-colors hover:border-primary/40 hover:bg-card/80"
          >
            <div class="font-serif text-[14px] leading-tight text-foreground">
              {entry.meta.title}
            </div>
            <p class="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
              {entry.meta.description}
            </p>
          </a>
        {/each}
      </div>
    </section>
  {/each}
</div>
