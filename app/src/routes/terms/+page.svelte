<script lang="ts">
  import { base } from '$app/paths';
  import Scroll from 'lucide-svelte/icons/scroll';
  import AlertTriangle from 'lucide-svelte/icons/triangle-alert';
  import ShieldAlert from 'lucide-svelte/icons/shield-alert';
  import Mail from 'lucide-svelte/icons/mail';

  const lastUpdated = '2026-05-07';
</script>

<svelte:head>
  <title>Terms of Service · Cryptex</title>
  <meta
    name="description"
    content="Cryptex terms of service — acceptable use, security-research framing, and disclaimers."
  />
</svelte:head>

<article class="prose-cryptex mx-auto max-w-3xl space-y-8 pb-16">
  <header class="space-y-3">
    <div class="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      <Scroll size={11} class="text-primary" />
      <span>Last updated: {lastUpdated}</span>
    </div>
    <h1 class="font-serif text-4xl tracking-tight text-balance sm:text-5xl">
      Terms of <span class="text-primary italic">service</span>
    </h1>
    <p class="text-base leading-relaxed text-muted-foreground sm:text-lg">
      By accessing or using Cryptex, you agree to these terms. Read them carefully — Cryptex
      is a security-research tool, and a few rules exist to keep things lawful for everyone.
    </p>
  </header>

  <section class="space-y-3">
    <h2 class="font-serif text-2xl">1. Acceptance</h2>
    <p class="text-sm leading-relaxed text-muted-foreground">
      Using any part of Cryptex (the website, the offline tools, the
      Python CLI, or the source code) means you accept these terms. If you don't agree,
      don't use the service.
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="font-serif text-2xl">2. What Cryptex is</h2>
    <p class="text-sm leading-relaxed text-muted-foreground">
      Cryptex is a research platform for AI red-teamers, security researchers, and prompt
      engineers. It bundles 162 text transformers, a universal decoder, mutator and
      classifier libraries, and 26 specialized red-team workbenches (HarmBench / StrongREJECT
      / JBB benchmarks, adversarial-suffix generators, glitch-token catalogs, OCR /
      markdown / PDF injection labs, and more).
    </p>
    <p class="text-sm leading-relaxed text-muted-foreground">
      Most of Cryptex runs entirely in your browser. AI calls go directly to the provider
      you configure using a key you supplied; we are not in the request path.
    </p>
  </section>

  <section class="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
    <h2 class="flex items-center gap-2 font-serif text-2xl">
      <ShieldAlert size={18} class="text-amber-500" />
      3. Acceptable use — security-research scope
    </h2>
    <p class="text-sm leading-relaxed">
      Cryptex's tools are designed for evaluating systems you own or have explicit
      authorization to test. You agree to use Cryptex only:
    </p>
    <ul class="space-y-1.5 text-sm leading-relaxed">
      <li>• Against AI systems, classifiers, or text-processing services that you own, operate, or have written authorization (bug bounty, red-team contract, internal eval, CTF) to test.</li>
      <li>• For lawful research, defense, education, and CTF-style challenges.</li>
      <li>• Within the rules of any platform you're testing — including the AI provider whose API key you've configured here.</li>
    </ul>
    <p class="text-sm font-medium text-foreground">You must NOT use Cryptex to:</p>
    <ul class="space-y-1.5 text-sm leading-relaxed">
      <li>• Generate content that is illegal in your jurisdiction (CSAM, real-world violent threats, harassment, etc.).</li>
      <li>• Bypass safety / alignment systems on services you don't own and don't have authorization to test.</li>
      <li>• Attack, defraud, harass, or impersonate others.</li>
      <li>• Violate the terms of service of any AI provider whose API you call from Cryptex (each provider has its own acceptable-use policy that overrides ours for their service).</li>
      <li>• Build automated systems that mass-produce abusive or fraudulent content.</li>
    </ul>
    <p class="text-xs italic text-muted-foreground">
      Cryptex is a tool. The legal and ethical responsibility for how you use it rests with you.
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="font-serif text-2xl">4. No accounts</h2>
    <p class="text-sm leading-relaxed text-muted-foreground">
      Cryptex OSS does not require sign-up or sign-in. All state — tool configuration,
      provider keys, and preferences — is stored locally in your browser. No user accounts
      are created; no data is sent to a Cryptex server.
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="font-serif text-2xl">5. API keys you supply</h2>
    <p class="text-sm leading-relaxed text-muted-foreground">
      Cryptex is bring-your-own-key. When you paste an API key (OpenRouter, Anthropic, OpenAI,
      etc.) into Settings, it is stored only in your browser's <code class="rounded bg-muted/40 px-1 py-0.5 font-mono">localStorage</code>. It is
      never transmitted to a server we control. You are solely responsible for the costs and
      content of API calls made with your key, and for keeping the key safe. If you publish
      a screenshot or share the device, treat the key as compromised and rotate it.
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="font-serif text-2xl">6. Intellectual property</h2>
    <p class="text-sm leading-relaxed text-muted-foreground">
      Cryptex's source code is open source (see the LICENSE file in the repository). Use,
      modify, and redistribute under the license terms. The Cryptex name, logo, and visual
      design are not licensed for use to imply endorsement of unrelated products.
    </p>
    <p class="text-sm leading-relaxed text-muted-foreground">
      Output you generate using Cryptex (rewrites, decoded text, transformed payloads) is
      yours to use under whatever rules apply to your inputs and the terms of any AI
      provider you used. Cryptex claims no ownership over your outputs.
    </p>
  </section>

  <section class="space-y-3 rounded-2xl border border-border/60 bg-card/40 p-5">
    <h2 class="flex items-center gap-2 font-serif text-2xl">
      <AlertTriangle size={18} class="text-primary" />
      7. Disclaimers
    </h2>
    <p class="text-sm leading-relaxed">
      Cryptex is provided "as is", without warranty of any kind, express or implied. We make
      no guarantees about availability, accuracy, fitness for any purpose, or
      non-infringement. The decoder may misclassify; transforms may have edge-case bugs;
      benchmarks reflect the corpora they're built on, not ground truth. Use the output as a
      research signal, not as a verdict.
    </p>
    <p class="text-sm leading-relaxed">
      To the maximum extent permitted by law, Cryptex and its contributors are not liable
      for any indirect, incidental, special, or consequential damages arising from your use
      of the service — including, without limitation, lost profits, lost data, or costs
      incurred against AI provider APIs.
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="font-serif text-2xl">8. Termination</h2>
    <p class="text-sm leading-relaxed text-muted-foreground">
      You can stop using Cryptex at any time. Because Cryptex is a static open-source app
      with no accounts, "termination" means you stop using it. If you fork or redistribute
      the project, you remain bound by the license terms and these acceptable-use rules.
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="font-serif text-2xl">9. Governing law</h2>
    <p class="text-sm leading-relaxed text-muted-foreground">
      These terms are governed by the laws of the jurisdiction in which the operator (the
      individual or entity running this Cryptex deployment) is established, without regard to
      its conflict-of-law provisions. Disputes will be resolved in the courts of that
      jurisdiction.
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="font-serif text-2xl">10. Changes</h2>
    <p class="text-sm leading-relaxed text-muted-foreground">
      We may update these terms. The "Last updated" date at the top reflects the most recent
      revision; revision history is in the public Cryptex repository. Continued use after
      a change means you accept the new terms.
    </p>
  </section>

  <section class="space-y-3 rounded-2xl border border-border/60 bg-card/40 p-5 shadow-glass">
    <h2 class="flex items-center gap-2 font-serif text-2xl">
      <Mail size={18} class="text-primary" />
      Contact
    </h2>
    <p class="text-sm leading-relaxed">
      Questions about these terms:
      <a href="mailto:m4xx101101@gmail.com" class="font-medium text-primary underline-offset-2 hover:underline">m4xx101101@gmail.com</a>.
    </p>
  </section>
</article>
