<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { supabase } from '$lib/auth/supabase';
  import KeyRound from 'lucide-svelte/icons/key-round';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';

  type Flow = 'email' | 'oauth' | 'unknown';

  let message = $state('Signing you in…');
  let detail = $state<string | null>(null);
  let showOtpFallback = $state(false);
  let showOAuthRetry = $state(false);
  let isError = $state(false);
  let flow = $state<Flow>('unknown');

  onMount(async () => {
    if (!supabase) {
      void goto(`${base}/`);
      return;
    }

    // 1. If we already have a session (e.g. user reloaded /auth/callback with
    //    a stale URL after signing in elsewhere), short-circuit to /chat.
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) {
      void goto(`${base}/chat`);
      return;
    }

    // 2. Inspect URL params for OAuth-style errors first. These come from
    //    Supabase BEFORE any code exchange — link expired, redirect not in
    //    allow-list, OAuth consent denied, etc.
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const err = params.get('error') ?? hashParams.get('error');
    const errDesc = params.get('error_description') ?? hashParams.get('error_description');
    const errCode = params.get('error_code') ?? hashParams.get('error_code');

    // Decide which flow this is — affects the recovery UI we show on error.
    flow = detectFlow(err, errDesc, params);

    if (err || errDesc) {
      handleProviderError(err, errDesc, errCode);
      return;
    }

    if (!params.get('code')) {
      message = 'Redirecting to sign in…';
      setTimeout(() => void goto(`${base}/login`), 1000);
      return;
    }

    // 3. PKCE exchange. Pass the full search string so the SDK can extract
    //    the code; it then reads the code_verifier from localStorage.
    const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.search);

    if (error) {
      isError = true;
      // PKCE code-verifier mismatch — link opened in a different browser
      // than the one that initiated sign-in. This is genuinely an
      // email-flow issue (OAuth doesn't generate a code_verifier on the
      // client), so the OTP fallback is the right recovery here.
      if (/code verifier/i.test(error.message) || /code_verifier/i.test(error.message)) {
        flow = 'email';
        message = 'Sign-in failed';
        detail = 'Open the email in the same browser you started from — or use the 6-digit code, which works from any browser.';
        showOtpFallback = true;
      } else if (flow === 'oauth') {
        message = 'Sign-in failed';
        detail = 'The provider rejected the sign-in. Try again, or use email + password.';
        showOAuthRetry = true;
      } else {
        message = 'Sign-in failed';
        detail = 'Try again, or use the 6-digit code from your email.';
        showOtpFallback = true;
      }
      return;
    }

    if (data.session) {
      void goto(`${base}/chat`);
    } else {
      isError = true;
      message = 'Sign-in incomplete';
      detail = 'No session was returned. Try again.';
      if (flow === 'oauth') showOAuthRetry = true;
      else showOtpFallback = true;
    }
  });

  /**
   * Heuristically tell email/OTP flows apart from OAuth flows by looking
   * at the URL Supabase redirected us to:
   *   - OAuth provider failures usually carry `provider=` or
   *     `error=server_error` plus `error_description` mentioning the
   *     external provider name.
   *   - Email flows surface `error_code=otp_expired` or
   *     `error_description` containing "email link" / "email expired".
   *   - Successful PKCE redirects always carry `?code=` (no error
   *     params) — flow stays 'unknown' and we don't show recovery UI.
   */
  function detectFlow(err: string | null, desc: string | null, params: URLSearchParams): Flow {
    const d = (desc ?? '').toLowerCase();
    if (
      /email link|email expired|otp_expired|magic link|signup.*confirm|recovery/i.test(d) ||
      params.get('error_code') === 'otp_expired'
    ) {
      return 'email';
    }
    if (
      err === 'server_error' ||
      /external|provider|oauth|consent/.test(d) ||
      params.has('provider')
    ) {
      return 'oauth';
    }
    return 'unknown';
  }

  function handleProviderError(err: string | null, desc: string | null, code: string | null) {
    isError = true;

    if (flow === 'oauth') {
      // OAuth provider rejection — Google / GitHub returned an error to
      // Supabase, which forwarded it here. Common causes: provider OAuth
      // app misconfigured, user denied consent, transient provider issue.
      // OTP path doesn't help here, so don't show it.
      if (err === 'access_denied') {
        message = 'Sign-in cancelled';
        detail = 'You cancelled at the provider\'s consent screen.';
      } else {
        message = 'Sign-in could not complete';
        detail = 'The provider rejected the sign-in. Try again, or use email + password.';
      }
      showOAuthRetry = true;
      return;
    }

    // Email flow — link expired / consumed / invalid. The OTP path is
    // the right recovery (codes are prefetch-resistant). We DON'T mention
    // why — that detail (security scanners consume single-use links) is
    // an attack-surface disclosure in production.
    if (code === 'otp_expired' || /expired|invalid/i.test(desc ?? '') || err === 'access_denied') {
      message = 'That sign-in link is no longer valid';
      detail = 'Use the 6-digit code from the email — it lasts longer and works from any browser.';
    } else {
      message = 'Sign-in could not complete';
      detail = 'Try again, or use the 6-digit code from your email.';
    }
    showOtpFallback = true;
  }
</script>

<svelte:head><title>Signing in… · Cryptex</title></svelte:head>

<div class="m-auto mt-16 flex max-w-md flex-col items-center gap-6 px-6 sm:mt-24">
  {#if !isError}
    <p class="text-center text-sm text-muted-foreground">{message}</p>
  {:else}
    <div class="w-full space-y-5 rounded-2xl border border-border/60 bg-card/60 p-6 shadow-glass">
      <div class="space-y-1.5 text-center">
        <h1 class="font-serif text-2xl tracking-tight">{message}</h1>
        {#if detail}
          <p class="text-sm leading-relaxed text-muted-foreground">{detail}</p>
        {/if}
      </div>

      {#if showOtpFallback}
        <div class="space-y-1.5 rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-[13px]">
          <div class="flex items-center gap-2 font-medium text-foreground">
            <KeyRound size={13} class="text-primary" />
            Try the 6-digit code
          </div>
          <p class="text-[12px] leading-relaxed text-muted-foreground">
            Open your email, copy the code, and enter it on the sign-in page.
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <a
            href="{base}/login"
            class="group inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-[13px] font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5"
          >
            Enter sign-in code
            <ArrowRight size={13} class="transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="{base}/login"
            class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background/60 text-[13px] font-medium transition-colors hover:bg-muted/40"
          >
            <RefreshCw size={13} /> Send a new code
          </a>
        </div>
      {:else if showOAuthRetry}
        <div class="flex flex-col gap-1.5">
          <a
            href="{base}/login"
            class="group inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-[13px] font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5"
          >
            Try again
            <ArrowRight size={13} class="transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      {:else}
        <div class="flex flex-col gap-1.5">
          <a
            href="{base}/login"
            class="group inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-[13px] font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5"
          >
            Back to sign in
            <ArrowRight size={13} class="transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      {/if}
    </div>
  {/if}
</div>
