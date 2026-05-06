<script lang="ts">
  import { session } from '$lib/auth/session.svelte';
  import { featureFlags } from '$lib/config/featureFlags';
  import { supabaseConfigStatus } from '$lib/auth/supabase';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import Logo from '$lib/components/brand/Logo.svelte';
  import Eye from 'lucide-svelte/icons/eye';
  import EyeOff from 'lucide-svelte/icons/eye-off';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';
  import KeyRound from 'lucide-svelte/icons/key-round';
  import Mail from 'lucide-svelte/icons/mail';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import Loader from 'lucide-svelte/icons/loader-circle';

  let mode = $state<'password' | 'magic'>('password');
  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let error = $state<string | null>(null);
  let info = $state<string | null>(null);
  let loading = $state(false);
  let busyProvider = $state<'google' | 'github' | 'password' | 'magic' | 'reset' | null>(null);
  let resetMode = $state(false);

  async function google() {
    loading = true; busyProvider = 'google'; error = null;
    try { await session.signInWithGoogle(); }
    catch (e) { error = (e as Error).message; loading = false; busyProvider = null; }
  }

  async function github() {
    loading = true; busyProvider = 'github'; error = null;
    try { await session.signInWithGitHub(); }
    catch (e) { error = (e as Error).message; loading = false; busyProvider = null; }
  }

  async function passwordSignIn() {
    if (!email || !password) return;
    loading = true; busyProvider = 'password'; error = null; info = null;
    try { await session.signInWithPassword(email, password); }
    catch (e) { error = (e as Error).message; loading = false; busyProvider = null; }
  }

  async function magicLink() {
    if (!email) return;
    loading = true; busyProvider = 'magic'; error = null; info = null;
    try {
      await session.signInWithMagicLink(email);
      info = `Magic link sent to ${email}. Check your inbox.`;
    } catch (e) {
      error = (e as Error).message;
    } finally { loading = false; busyProvider = null; }
  }

  async function resetPassword() {
    if (!email) { error = 'Enter your email above first.'; return; }
    loading = true; busyProvider = 'reset'; error = null; info = null;
    try {
      await session.sendPasswordReset(email);
      info = `Password reset link sent to ${email}.`;
      resetMode = false;
    } catch (e) {
      error = (e as Error).message;
    } finally { loading = false; busyProvider = null; }
  }

  $effect(() => {
    if (session.isReady && session.isSignedIn) void goto(`${base}/chat`);
  });
</script>

<svelte:head>
  <title>Sign in · Cryptex</title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#if !featureFlags.authEnabled}
  <div class="mx-auto mt-24 max-w-md px-6 text-center">
    <p class="text-muted-foreground">Auth is disabled in this build.</p>
    <p class="mt-2 text-xs text-muted-foreground">
      Set <code class="rounded bg-muted/40 px-1 py-0.5 font-mono">VITE_AUTH_ENABLED=true</code> +
      <code class="rounded bg-muted/40 px-1 py-0.5 font-mono">PUBLIC_SUPABASE_URL</code> +
      <code class="rounded bg-muted/40 px-1 py-0.5 font-mono">PUBLIC_SUPABASE_ANON_KEY</code>
      and rebuild.
    </p>
  </div>
{:else}
  <div class="relative mx-auto mt-8 grid w-full max-w-5xl gap-8 px-6 sm:mt-14 lg:mt-16 lg:grid-cols-[1fr_minmax(360px,420px)] lg:items-center">
    <!-- Left: brand + value prop. Hidden on mobile, the form takes priority. -->
    <aside class="hidden lg:flex lg:flex-col lg:gap-6">
      <a href="{base}/" class="flex items-center gap-3 transition-opacity hover:opacity-85">
        <Logo size={36} />
        <span class="font-serif text-2xl tracking-tight">Cryptex</span>
      </a>
      <h2 class="font-serif text-4xl tracking-tight text-balance">
        The AI red-teamer's <span class="text-primary italic">text lab</span>.
      </h2>
      <p class="max-w-md text-sm leading-relaxed text-muted-foreground">
        162 transforms, 36 mutators, 26 red-team workbenches, and a dataset pipeline.
        Sign in to sync chats across devices — or use the offline tools without an account.
      </p>
      <ul class="space-y-2.5 text-sm text-muted-foreground">
        <li class="flex items-start gap-2.5">
          <span class="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"></span>
          <span><strong class="text-foreground">Local-first</strong> — keys never leave your browser, no telemetry.</span>
        </li>
        <li class="flex items-start gap-2.5">
          <span class="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"></span>
          <span><strong class="text-foreground">BYOK</strong> — bring your OpenRouter / Anthropic / Groq / OpenAI-compat key.</span>
        </li>
        <li class="flex items-start gap-2.5">
          <span class="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"></span>
          <span><strong class="text-foreground">Open source</strong> — every transform, mutator, and judge is auditable.</span>
        </li>
      </ul>
    </aside>

    <!-- Right: auth card -->
    <div class="flex flex-col items-center gap-6">
      <div class="flex flex-col items-center gap-3 lg:hidden">
        <Logo size={40} />
        <span class="font-serif text-2xl tracking-tight">Cryptex</span>
      </div>

      <div class="text-center lg:text-left lg:self-stretch">
        <h1 class="font-serif text-3xl tracking-tight text-balance">
          {resetMode ? 'Reset your password' : 'Welcome back'}
        </h1>
        <p class="mt-2 text-sm text-muted-foreground">
          {resetMode
            ? "We'll send a reset link to your email."
            : 'Sign in to sync chats and presets across devices.'}
        </p>
      </div>

      {#if !supabaseConfigStatus.ok}
        <div role="alert" class="w-full rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-xs">
          <p class="mb-1 font-semibold text-destructive">Auth misconfigured at build time</p>
          <p class="text-muted-foreground">{supabaseConfigStatus.detail}</p>
          <p class="mt-2 text-muted-foreground">
            Fix the env var in Dokploy → your service → <strong>Environment</strong>, then click <strong>Rebuild</strong> (not just Redeploy — Vite inlines these at build time).
          </p>
        </div>
      {/if}

      <div class="w-full rounded-2xl border border-border/60 bg-card/60 p-6 shadow-glass backdrop-blur-sm">
        {#if !resetMode}
          <!-- Tab switcher -->
          <div class="mb-5 grid grid-cols-2 rounded-lg border border-border/40 bg-muted/30 p-0.5 text-xs">
            <button
              type="button"
              onclick={() => { mode = 'password'; error = null; info = null; }}
              class={mode === 'password'
                ? 'inline-flex items-center justify-center gap-1.5 rounded-md bg-card px-3 py-1.5 font-medium text-foreground shadow-sm'
                : 'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground'}
            ><KeyRound size={12} /> Password</button>
            <button
              type="button"
              onclick={() => { mode = 'magic'; error = null; info = null; }}
              class={mode === 'magic'
                ? 'inline-flex items-center justify-center gap-1.5 rounded-md bg-card px-3 py-1.5 font-medium text-foreground shadow-sm'
                : 'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground'}
            ><Sparkles size={12} /> Magic link</button>
          </div>

          {#if mode === 'password'}
            <form onsubmit={(e) => { e.preventDefault(); void passwordSignIn(); }} class="flex flex-col gap-3">
              <label class="flex flex-col gap-1.5 text-xs">
                <span class="font-medium text-foreground">Email</span>
                <input
                  bind:value={email}
                  type="email"
                  required
                  autocomplete="email"
                  inputmode="email"
                  spellcheck="false"
                  placeholder="you@example.com"
                  class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>

              <label class="flex flex-col gap-1.5 text-xs">
                <div class="flex items-center justify-between">
                  <span class="font-medium text-foreground">Password</span>
                  <button
                    type="button"
                    onclick={() => { resetMode = true; error = null; info = null; }}
                    class="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >Forgot?</button>
                </div>
                <div class="relative">
                  <input
                    bind:value={password}
                    type={showPassword ? 'text' : 'password'}
                    required
                    minlength="8"
                    autocomplete="current-password"
                    placeholder="At least 8 characters"
                    class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 pr-10 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    onclick={() => (showPassword = !showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  >
                    {#if showPassword}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                class="mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {#if busyProvider === 'password'}
                  <Loader size={14} class="animate-spin" /> Signing in…
                {:else}
                  Sign in <ArrowRight size={14} />
                {/if}
              </button>
            </form>
          {:else}
            <form onsubmit={(e) => { e.preventDefault(); void magicLink(); }} class="flex flex-col gap-3">
              <label class="flex flex-col gap-1.5 text-xs">
                <span class="font-medium text-foreground">Email</span>
                <input
                  bind:value={email}
                  type="email"
                  required
                  autocomplete="email"
                  inputmode="email"
                  spellcheck="false"
                  placeholder="you@example.com"
                  class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                class="mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {#if busyProvider === 'magic'}
                  <Loader size={14} class="animate-spin" /> Sending…
                {:else}
                  <Mail size={14} /> Send magic link
                {/if}
              </button>

              <p class="text-[11px] leading-relaxed text-muted-foreground">
                We'll email a one-time link. No password required. Check spam if it doesn't arrive within a minute.
              </p>
            </form>
          {/if}

          <div class="my-5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <div class="flex-1 border-t border-border/30"></div>
            <span class="uppercase tracking-wider">or continue with</span>
            <div class="flex-1 border-t border-border/30"></div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              onclick={google}
              disabled={loading}
              class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/60 text-sm transition-colors hover:bg-muted/40 disabled:opacity-50"
            >
              <svg viewBox="0 0 18 18" class="h-4 w-4" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.32A9 9 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.32z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"/>
              </svg>
              {busyProvider === 'google' ? '…' : 'Google'}
            </button>
            <button
              type="button"
              onclick={github}
              disabled={loading}
              class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/60 text-sm transition-colors hover:bg-muted/40 disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.69-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a10.95 10.95 0 0 1 5.74 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.21.66.79.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
              </svg>
              {busyProvider === 'github' ? '…' : 'GitHub'}
            </button>
          </div>
        {:else}
          <!-- Reset mode -->
          <form onsubmit={(e) => { e.preventDefault(); void resetPassword(); }} class="flex flex-col gap-3">
            <label class="flex flex-col gap-1.5 text-xs">
              <span class="font-medium text-foreground">Email</span>
              <input
                bind:value={email}
                type="email"
                required
                autocomplete="email"
                inputmode="email"
                spellcheck="false"
                placeholder="you@example.com"
                class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              class="mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {#if busyProvider === 'reset'}
                <Loader size={14} class="animate-spin" /> Sending…
              {:else}
                <Mail size={14} /> Send reset link
              {/if}
            </button>
            <button
              type="button"
              onclick={() => { resetMode = false; error = null; info = null; }}
              class="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >← Back to sign in</button>
          </form>
        {/if}

        {#if info}
          <p role="status" class="mt-4 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-foreground">{info}</p>
        {/if}
        {#if error}
          <p role="alert" class="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error}</p>
        {/if}
      </div>

      <div class="flex w-full flex-col items-center gap-3 text-center">
        <p class="text-xs text-muted-foreground">
          No account? <a href="{base}/signup" class="font-medium text-foreground underline-offset-4 hover:underline">Create one</a>
        </p>

        <div class="flex w-full items-center gap-2 text-[11px] text-muted-foreground">
          <div class="flex-1 border-t border-border/30"></div>
          <span class="uppercase tracking-wider">or skip sign-in</span>
          <div class="flex-1 border-t border-border/30"></div>
        </div>

        <a
          href="{base}/transforms"
          class="group inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/40 text-sm transition-colors hover:bg-muted/40"
        >
          Continue without sign-in
          <ArrowRight size={14} class="transition-transform group-hover:translate-x-0.5" />
        </a>
        <p class="text-[11px] text-muted-foreground">
          Transforms, decoder, and 26 red-team workbenches work fully offline.
        </p>
      </div>
    </div>
  </div>
{/if}
