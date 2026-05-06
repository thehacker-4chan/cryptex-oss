<script lang="ts">
  import { base } from '$app/paths';
  import { guideByCategory } from '$lib/guide';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import MessageSquare from 'lucide-svelte/icons/message-square';
  import Wrench from 'lucide-svelte/icons/wrench';
  import BookOpen from 'lucide-svelte/icons/book-open';
  import Shield from 'lucide-svelte/icons/shield';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';
  import Bolt from 'lucide-svelte/icons/zap';
  import Database from 'lucide-svelte/icons/database';
  import Lock from 'lucide-svelte/icons/lock';

  const groups = guideByCategory();

  const categoryIcons: Record<string, typeof Sparkles> = {
    intro: Sparkles,
    chat: MessageSquare,
    tools: Wrench,
    recipes: BookOpen,
    policy: Shield
  };

  const categoryAccents: Record<string, string> = {
    intro: 'from-primary/15 via-primary/5',
    chat: 'from-emerald-500/10 via-emerald-500/5',
    tools: 'from-sky-500/10 via-sky-500/5',
    recipes: 'from-amber-500/10 via-amber-500/5',
    policy: 'from-rose-500/10 via-rose-500/5'
  };

  const stats: Array<{ label: string; value: string; icon: typeof Bolt }> = [
    { label: 'Transforms',     value: '162', icon: Bolt },
    { label: 'Mutators',       value: '36',  icon: Sparkles },
    { label: 'Red-team tools', value: '26',  icon: Wrench },
    { label: 'Telemetry',      value: 'Zero', icon: Lock }
  ];
</script>

<div class="space-y-12">
  <!-- Hero -->
  <header class="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6 shadow-glass sm:p-10">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
      style="background: radial-gradient(circle, hsl(var(--primary) / 0.4), transparent 60%);"
    ></div>
    <div class="relative space-y-5">
      <div class="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <Sparkles size={11} class="text-primary" />
        <span>Cryptex Field Manual</span>
      </div>
      <h1 class="font-serif text-4xl tracking-tight text-balance sm:text-5xl">
        The AI red-teamer's <span class="text-primary italic">field manual</span>.
      </h1>
      <p class="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        Practical recipes, technique catalogs, and end-to-end attack chains for security
        researchers evaluating LLM robustness. Everything below runs in your browser
        against your own keys.
      </p>
      <div class="flex flex-wrap gap-3 pt-2">
        <a
          href={`${base}/guide/getting-started/`}
          class="group inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5"
        >
          Start in 4 steps
          <ArrowRight size={14} class="transition-transform group-hover:translate-x-0.5" />
        </a>
        <a
          href={`${base}/guide/technique-catalog/`}
          class="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted/40"
        >
          Browse all techniques
        </a>
      </div>

      <!-- Stat strip -->
      <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {#each stats as s}
          <div class="rounded-xl border border-border/60 bg-background/40 p-3">
            <div class="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              <s.icon size={11} class="text-primary" />
              {s.label}
            </div>
            <div class="mt-1 font-mono text-2xl font-semibold tracking-tight text-foreground">
              {s.value}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </header>

  <!-- Quickstart triplet — popular jumps -->
  <section class="grid gap-3 sm:grid-cols-3">
    <a
      href={`${base}/guide/chat-basics/`}
      class="group rounded-xl border border-border bg-card/60 p-4 shadow-glass transition-all hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div class="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <MessageSquare size={16} />
      </div>
      <div class="font-serif text-base">Chat playground</div>
      <p class="mt-1 text-xs text-muted-foreground">
        Slash commands, modes, attack chains, dataset export.
      </p>
    </a>
    <a
      href={`${base}/guide/transform/`}
      class="group rounded-xl border border-border bg-card/60 p-4 shadow-glass transition-all hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div class="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Wrench size={16} />
      </div>
      <div class="font-serif text-base">Tools deep-dive</div>
      <p class="mt-1 text-xs text-muted-foreground">
        162 transforms, decoder, encoder pipelines.
      </p>
    </a>
    <a
      href={`${base}/guide/jailbreak-bank/`}
      class="group rounded-xl border border-border bg-card/60 p-4 shadow-glass transition-all hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div class="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <BookOpen size={16} />
      </div>
      <div class="font-serif text-base">Jailbreak bank</div>
      <p class="mt-1 text-xs text-muted-foreground">
        Curated chains with expected outputs and analysis.
      </p>
    </a>
  </section>

  <!-- All topics by category -->
  {#each groups as group (group.category)}
    {@const Icon = categoryIcons[group.category] ?? BookOpen}
    {@const accent = categoryAccents[group.category] ?? 'from-muted/10 via-transparent'}
    <section class="space-y-4">
      <div class={'flex items-baseline justify-between rounded-xl border border-border/40 bg-gradient-to-r ' + accent + ' to-transparent px-4 py-3'}>
        <div class="flex items-center gap-2.5">
          <span class="inline-flex h-7 w-7 items-center justify-center rounded-md bg-card/60 text-primary">
            <Icon size={14} />
          </span>
          <h2 class="font-serif text-xl tracking-tight">{group.label}</h2>
        </div>
        <span class="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {group.entries.length} {group.entries.length === 1 ? 'topic' : 'topics'}
        </span>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each group.entries as entry (entry.slug)}
          <a
            href={`${base}/guide/${entry.slug}/`}
            class="group block rounded-xl border border-border bg-card/60 p-4 shadow-glass transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-primary"
          >
            <div class="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/80">
              {group.label}
            </div>
            <div class="font-serif text-lg leading-tight tracking-tight text-foreground">
              {entry.meta.title}
            </div>
            <p class="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {entry.meta.description}
            </p>
            <div class="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Read <ArrowRight size={11} />
            </div>
          </a>
        {/each}
      </div>
    </section>
  {/each}

  <!-- Bottom callout -->
  <section class="rounded-2xl border border-border/60 bg-card/40 p-6 shadow-glass">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 class="font-serif text-lg">Have a recipe to share?</h3>
        <p class="mt-1 text-sm text-muted-foreground">
          Cryptex is open source. Open a PR with your chain, your benchmark notes,
          or a new mutator.
        </p>
      </div>
      <a
        href="https://github.com/m4xx101"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/40"
      >
        <Database size={14} /> github.com/m4xx101
      </a>
    </div>
  </section>
</div>
