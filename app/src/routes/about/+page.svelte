<script lang="ts">
  import { base } from '$app/paths';
  import Lock from 'lucide-svelte/icons/lock';
  import KeyRound from 'lucide-svelte/icons/key-round';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import Globe from 'lucide-svelte/icons/globe';
  import Cpu from 'lucide-svelte/icons/cpu';
  import Bolt from 'lucide-svelte/icons/zap';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';

  // Quiet, refined values — six commitments rather than feature dumps.
  const principles = [
    { icon: Lock,     title: 'Local-first',        body: 'Tool inputs and chat history stay in your browser.' },
    { icon: KeyRound, title: 'Bring your own key', body: 'Direct browser-to-provider calls — no proxy, no broker.' },
    { icon: Globe,    title: 'Multi-provider',     body: 'OpenRouter, Anthropic direct, OpenAI-compatible endpoints.' },
    { icon: Bolt,     title: 'Browser-only',       body: 'Static site. Deploys anywhere; runs everywhere.' },
    { icon: Sparkles, title: 'Quiet by default',   body: 'No telemetry on tool surfaces. No analytics on chat.' },
    { icon: Cpu,      title: 'Built to be audited', body: 'Every transformer, mutator, and judge is inspectable.' }
  ];
</script>

<svelte:head>
  <title>About · Cryptex</title>
  <meta
    name="description"
    content="Cryptex — a quiet, browser-only text lab for AI red-teamers. Local-first, BYOK, audited."
  />
</svelte:head>

<article class="mx-auto max-w-3xl space-y-16 pb-16">
  <!-- ===== Hero — refined, no logo lockup (header already has it) ===== -->
  <header class="space-y-5">
    <div class="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      <Sparkles size={10} class="text-primary" />
      <span>The text lab</span>
    </div>
    <h1 class="font-serif text-3xl tracking-tight text-balance sm:text-4xl">
      A quieter way to <span class="text-primary italic">study</span> language models.
    </h1>
    <p class="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
      Cryptex is a workbench for people who study how text-handling AI behaves. Encoders,
      decoders, tokenizer probes, paraphrase rewrites, document-channel labs — everything
      runs in your browser against keys you control.
    </p>
  </header>

  <!-- ===== Principles — small, restrained 2-column grid ===== -->
  <section class="space-y-4">
    <h2 class="font-serif text-base text-muted-foreground">The shape of it</h2>
    <div class="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {#each principles as p}
        <div class="flex items-start gap-3">
          <span class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <p.icon size={13} />
          </span>
          <div class="min-w-0 flex-1">
            <div class="font-serif text-[15px] leading-tight text-foreground">{p.title}</div>
            <p class="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{p.body}</p>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- ===== Privacy callout — single line, calm ===== -->
  <section class="rounded-xl border border-border/60 bg-card/40 p-5">
    <div class="flex items-start gap-3">
      <span class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Lock size={14} />
      </span>
      <div class="min-w-0 flex-1 space-y-1">
        <h3 class="font-serif text-[15px] text-foreground">Privacy is the architecture, not a feature</h3>
        <p class="text-[13px] leading-relaxed text-muted-foreground">
          AI calls go directly from your browser to whichever provider you configured. Cryptex is not in the
          request path. Read the <a href="{base}/privacy/" class="font-medium text-primary underline-offset-2 hover:underline">privacy policy</a> for the long form.
        </p>
      </div>
    </div>
  </section>

  <!-- ===== CTA — modest pair ===== -->
  <section class="flex flex-col gap-2 border-t border-border/40 pt-6 sm:flex-row sm:items-center sm:justify-between">
    <p class="text-[13px] text-muted-foreground">
      No account needed for the offline tools. Sign-in only syncs chats.
    </p>
    <div class="flex flex-wrap items-center gap-2">
      <a
        href={`${base}/transforms/`}
        class="group inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5"
      >
        Open the lab
        <ArrowRight size={12} class="transition-transform group-hover:translate-x-0.5" />
      </a>
      <a
        href={`${base}/guide/`}
        class="inline-flex h-9 items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-3.5 text-[13px] font-medium transition-colors hover:bg-muted/40"
      >
        Read the guide
      </a>
    </div>
  </section>

  <!-- ===== Mystic credit line — quiet, italic ===== -->
  <section class="border-t border-border/40 pt-8 text-center">
    <p class="font-serif text-sm italic text-muted-foreground">
      Vibecoded with stubborn hands and a strong cup of coffee. ☕
    </p>
    <p class="mt-1 text-[11px] text-muted-foreground/60">
      © {new Date().getFullYear()} Cryptex
    </p>
  </section>
</article>
