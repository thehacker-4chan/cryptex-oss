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
  import Loader from 'lucide-svelte/icons/loader-circle';

  type Mode = 'signin' | 'reset-request' | 'reset-verify' | 'reset-set';

  let mode = $state<Mode>('signin');
  let email = $state('');
  let password = $state('');
  let newPassword = $state('');
  let showPassword = $state(false);
  let resetCode = $state('');
  let error = $state<string | null>(null);
  let info = $state<string | null>(null);
  let loading = $state(false);
  let busyProvider = $state<'google' | 'github' | 'password' | 'reset-send' | 'reset-verify' | 'reset-update' | null>(null);

  async function google() {
    loading = true; busyProvider = 'google'; error = null;
    try { await session.signInWithGoogle(); }
    catch { genericFail(); loading = false; busyProvider = null; }
  }

  async function github() {
    loading = true; busyProvider = 'github'; error = null;
    try { await session.signInWithGitHub(); }
    catch { genericFail(); loading = false; busyProvider = null; }
  }

  async function passwordSignIn() {
    if (!email || !password) return;
    loading = true; busyProvider = 'password'; error = null;
    try { await session.signInWithPassword(email, password); }
    catch { genericFail(); }
    finally { loading = false; busyProvider = null; }
  }

  // Step 1 of reset flow: send a recovery code (NOT a clickable link).
  async function sendResetCode() {
    if (!email) { error = 'Enter your email above first.'; return; }
    loading = true; busyProvider = 'reset-send'; error = null; info = null;
    try {
      await session.sendPasswordReset(email);
      mode = 'reset-verify';
      info = `Code sent to ${email}.`;
    } catch {
      genericFail();
    } finally { loading = false; busyProvider = null; }
  }

  // Step 2 of reset flow: verify the OTP code; on success move to set-password.
  async function verifyResetCode() {
    if (!email || !resetCode) return;
    loading = true; busyProvider = 'reset-verify'; error = null; info = null;
    try {
      // 'recovery' is the Supabase OTP type for password-reset emails.
      await session.verifyEmailOtp(email, resetCode, 'recovery');
      mode = 'reset-set';
      info = null;
    } catch {
      // Generic error so we don't reveal whether the code, email, or both
      // were wrong — simple defense against user-enumeration / OTP-guess.
      error = 'That code is invalid or expired.';
    } finally { loading = false; busyProvider = null; }
  }

  // Step 3 of reset flow: user is now signed in via the recovery OTP, set new password.
  async function commitNewPassword() {
    if (!newPassword || newPassword.length < 8) {
      error = 'Password must be at least 8 characters.';
      return;
    }
    loading = true; busyProvider = 'reset-update'; error = null;
    try {
      await session.updatePassword(newPassword);
      // session is live; effect below redirects to /chat.
      info = 'Password updated.';
    } catch {
      genericFail();
    } finally { loading = false; busyProvider = null; }
  }

  /** Don't echo provider error messages back to the page in production —
   *  doing so exposes details (rate-limit shape, account-existence,
   *  Supabase project hints). Show a single neutral message instead. */
  function genericFail() {
    error = 'Sign-in could not complete. Check your details and try again.';
  }

  $effect(() => {
    if (session.isReady && session.isSignedIn && mode !== 'reset-set') {
      void goto(`${base}/chat`);
    }
  });
</script>

<svelte:head>
  <title>Sign in · Cryptex</title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#if !featureFlags.authEnabled}
  <div class="mx-auto mt-24 max-w-md px-6 text-center">
    <p class="text-sm text-muted-foreground">Sign-in is unavailable in this build.</p>
  </div>
{:else}
  <div class="relative mx-auto mt-8 grid w-full max-w-5xl gap-8 px-6 sm:mt-14 lg:mt-16 lg:grid-cols-[1fr_minmax(360px,420px)] lg:items-center">
    <!-- Left: small brand + value prop. -->
    <aside class="hidden lg:flex lg:flex-col lg:gap-5">
      <a href="{base}/" class="flex items-center gap-2.5 transition-opacity hover:opacity-85">
        <Logo size={28} />
        <span class="font-serif text-lg tracking-tight">Cryptex</span>
      </a>
      <h2 class="font-serif text-3xl tracking-tight text-balance">
        A quieter way to <span class="text-primary italic">study</span> language models.
      </h2>
      <p class="max-w-md text-[14px] leading-relaxed text-muted-foreground">
        Sign in to sync chats and presets across devices. Offline tools work without an account.
      </p>
    </aside>

    <!-- Right: auth card -->
    <div class="flex flex-col items-center gap-5">
      <div class="flex flex-col items-center gap-2 lg:hidden">
        <Logo size={32} />
        <span class="font-serif text-xl tracking-tight">Cryptex</span>
      </div>

      <div class="text-center lg:text-left lg:self-stretch">
        <h1 class="font-serif text-2xl tracking-tight sm:text-3xl">
          {#if mode === 'signin'}Welcome back
          {:else if mode === 'reset-request'}Reset your password
          {:else if mode === 'reset-verify'}Enter the code
          {:else if mode === 'reset-set'}Set a new password
          {/if}
        </h1>
        <p class="mt-1.5 text-[13px] text-muted-foreground">
          {#if mode === 'signin'}Sign in to continue.
          {:else if mode === 'reset-request'}We'll send a 6-digit reset code.
          {:else if mode === 'reset-verify'}Paste the 6-digit code from your email.
          {:else if mode === 'reset-set'}Choose a new password for your account.
          {/if}
        </p>
      </div>

      {#if !supabaseConfigStatus.ok}
        <div role="alert" class="w-full rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-[12px]">
          <p class="font-medium text-destructive">Sign-in temporarily unavailable.</p>
          <p class="mt-1 text-muted-foreground">Try again later.</p>
        </div>
      {/if}

      <div class="w-full rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur-sm">
        {#if mode === 'signin'}
          <form onsubmit={(e) => { e.preventDefault(); void passwordSignIn(); }} class="flex flex-col gap-3">
            <label class="flex flex-col gap-1.5 text-[11px]">
              <span class="font-medium text-foreground">Email</span>
              <input
                bind:value={email}
                type="email"
                required
                autocomplete="email"
                inputmode="email"
                spellcheck="false"
                placeholder="you@example.com"
                class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-[13px] shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            <label class="flex flex-col gap-1.5 text-[11px]">
              <div class="flex items-center justify-between">
                <span class="font-medium text-foreground">Password</span>
                <button
                  type="button"
                  onclick={() => { mode = 'reset-request'; error = null; info = null; }}
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
                  class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 pr-9 text-[13px] shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onclick={() => (showPassword = !showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  {#if showPassword}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              class="mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-[13px] font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {#if busyProvider === 'password'}
                <Loader size={13} class="animate-spin" /> Signing in…
              {:else}
                Sign in <ArrowRight size={13} />
              {/if}
            </button>
          </form>

          <div class="my-4 flex items-center gap-2 text-[10px] text-muted-foreground">
            <div class="flex-1 border-t border-border/30"></div>
            <span class="uppercase tracking-wider">or</span>
            <div class="flex-1 border-t border-border/30"></div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              onclick={google}
              disabled={loading}
              class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background/60 text-[12px] transition-colors hover:bg-muted/40 disabled:opacity-50"
            >
              <svg viewBox="0 0 18 18" class="h-3.5 w-3.5" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.32A9 9 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.32z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"/>
              </svg>
              Google
            </button>
            <button
              type="button"
              onclick={github}
              disabled={loading}
              class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background/60 text-[12px] transition-colors hover:bg-muted/40 disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.69-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a10.95 10.95 0 0 1 5.74 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.21.66.79.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
              </svg>
              GitHub
            </button>
          </div>
        {:else if mode === 'reset-request'}
          <form onsubmit={(e) => { e.preventDefault(); void sendResetCode(); }} class="flex flex-col gap-3">
            <label class="flex flex-col gap-1.5 text-[11px]">
              <span class="font-medium text-foreground">Email</span>
              <input
                bind:value={email}
                type="email"
                required
                autocomplete="email"
                inputmode="email"
                spellcheck="false"
                placeholder="you@example.com"
                class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-[13px] shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              class="mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-[13px] font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {#if busyProvider === 'reset-send'}
                <Loader size={13} class="animate-spin" /> Sending…
              {:else}
                Send reset code
              {/if}
            </button>
            <button
              type="button"
              onclick={() => { mode = 'signin'; error = null; info = null; }}
              class="text-left text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >← Back to sign in</button>
          </form>
        {:else if mode === 'reset-verify'}
          <form onsubmit={(e) => { e.preventDefault(); void verifyResetCode(); }} class="flex flex-col gap-3">
            <p class="text-[12px] leading-relaxed text-muted-foreground">
              Code sent to <strong class="text-foreground break-all">{email}</strong>. Enter the 6-digit code from your email.
            </p>
            <label class="flex flex-col gap-1.5 text-[11px]">
              <span class="font-medium text-foreground">Verification code</span>
              <input
                bind:value={resetCode}
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                pattern="[0-9]*"
                maxlength="10"
                placeholder="000000"
                class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 text-center font-mono text-base tracking-[0.4em] shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <button
              type="submit"
              disabled={loading || !resetCode}
              class="mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-[13px] font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {#if busyProvider === 'reset-verify'}
                <Loader size={13} class="animate-spin" /> Verifying…
              {:else}
                <KeyRound size={13} /> Verify code
              {/if}
            </button>
            <div class="flex flex-col gap-1.5 border-t border-border/40 pt-2.5 text-[11px]">
              <button
                type="button"
                onclick={() => { mode = 'reset-request'; resetCode = ''; error = null; info = null; }}
                class="text-left text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >← Use a different email</button>
              <button
                type="button"
                onclick={() => void sendResetCode()}
                disabled={loading}
                class="text-left text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
              >
                {busyProvider === 'reset-send' ? 'Sending new code…' : 'Send a new code'}
              </button>
            </div>
          </form>
        {:else if mode === 'reset-set'}
          <form onsubmit={(e) => { e.preventDefault(); void commitNewPassword(); }} class="flex flex-col gap-3">
            <label class="flex flex-col gap-1.5 text-[11px]">
              <span class="font-medium text-foreground">New password</span>
              <div class="relative">
                <input
                  bind:value={newPassword}
                  type={showPassword ? 'text' : 'password'}
                  required
                  minlength="8"
                  autocomplete="new-password"
                  placeholder="At least 8 characters"
                  class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 pr-9 text-[13px] shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onclick={() => (showPassword = !showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  {#if showPassword}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
                </button>
              </div>
            </label>
            <button
              type="submit"
              disabled={loading || newPassword.length < 8}
              class="mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-[13px] font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {#if busyProvider === 'reset-update'}
                <Loader size={13} class="animate-spin" /> Updating…
              {:else}
                Update password
              {/if}
            </button>
          </form>
        {/if}

        {#if info}
          <p role="status" class="mt-3 rounded-md border border-primary/30 bg-primary/5 p-2 text-[11px] text-foreground">{info}</p>
        {/if}
        {#if error}
          <p role="alert" class="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{error}</p>
        {/if}
      </div>

      <div class="flex w-full flex-col items-center gap-2 text-center">
        <p class="text-[12px] text-muted-foreground">
          No account? <a href="{base}/signup" class="font-medium text-foreground underline-offset-4 hover:underline">Create one</a>
        </p>

        <div class="flex w-full items-center gap-2 text-[10px] text-muted-foreground">
          <div class="flex-1 border-t border-border/30"></div>
          <span class="uppercase tracking-wider">or skip sign-in</span>
          <div class="flex-1 border-t border-border/30"></div>
        </div>

        <a
          href="{base}/transforms"
          class="group inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background/40 text-[12px] transition-colors hover:bg-muted/40"
        >
          Continue without sign-in
          <ArrowRight size={12} class="transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>
    </div>
  </div>
{/if}
