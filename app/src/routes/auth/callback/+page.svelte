<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { supabase } from '$lib/auth/supabase';

  let message = $state('Signing you in…');
  let detail = $state<string | null>(null);
  let actions = $state<string[]>([]);
  let expectedCallback = $state<string | null>(null);
  let supabaseUrl = $state<string | null>(null);

  onMount(async () => {
    if (!supabase) {
      void goto(`${base}/`);
      return;
    }

    expectedCallback = `${window.location.origin}${base}/auth/callback`;
    supabaseUrl = (import.meta.env.PUBLIC_SUPABASE_URL as string | undefined) ?? null;

    // 1. If we already have a session (e.g. user reloaded /auth/callback with
    //    a stale URL after signing in elsewhere), short-circuit to /chat.
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) {
      void goto(`${base}/chat`);
      return;
    }

    // 2. Inspect URL params for OAuth-style errors first. These come from
    //    Supabase (or the upstream provider) BEFORE any code exchange.
    const url = new URL(window.location.href);
    const params = url.searchParams;

    // Some flows put error info in the URL fragment (#error=...) instead of
    // search. Parse both.
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const err = params.get('error') ?? hashParams.get('error');
    const errDesc = params.get('error_description') ?? hashParams.get('error_description');
    const errCode = params.get('error_code') ?? hashParams.get('error_code');

    if (err || errDesc) {
      handleProviderError(err, errDesc, errCode);
      return;
    }

    if (!params.get('code')) {
      message = 'No auth code in URL. Redirecting to sign in…';
      setTimeout(() => void goto(`${base}/login`), 1500);
      return;
    }

    // 3. PKCE exchange. Pass the full search string so the SDK can extract
    //    the code; it then reads the code_verifier from localStorage.
    const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.search);

    if (error) {
      message = `Sign-in failed: ${error.message}`;
      // Diagnostic hint for the most common PKCE failure mode — useful when
      // the user opens the email link in a different browser than the one
      // that initiated the request.
      if (/code verifier/i.test(error.message) || /code_verifier/i.test(error.message)) {
        detail = 'This usually means the email link was opened in a different browser, profile, or device than the one that started sign-in.';
        actions = ['Re-request the link and open it in the same browser.'];
      }
      setTimeout(() => void goto(`${base}/login`), 5000);
      return;
    }

    if (data.session) {
      void goto(`${base}/chat`);
    } else {
      message = 'Sign-in returned no session. Redirecting…';
      setTimeout(() => void goto(`${base}/login`), 2000);
    }
  });

  function handleProviderError(err: string | null, desc: string | null, code: string | null) {
    const headline = err ?? code ?? 'unknown';
    // Prefer error_description for the main line — it's the human-readable
    // explanation Supabase emits. Fall back to the error code if absent.
    message = `Sign-in failed: ${desc ?? headline}`;

    if (err === 'access_denied' || code === 'otp_expired') {
      detail =
        'access_denied from Supabase usually means one of the URL-configuration items below isn\'t set. Double-check each one — none of these need a redeploy of Cryptex, they\'re Supabase-side toggles that take effect immediately.';
      actions = [
        `Open Supabase → Authentication → URL Configuration.`,
        `Set Site URL to: ${window.location.origin}${base || ''}`,
        `Add this exact URL to the Redirect URLs allow-list: ${expectedCallback}`,
        `Save. Then re-request the email link (the previous one may have expired or been single-used) and click again.`
      ];
    } else if (code === 'otp_expired' || /expired/i.test(desc ?? '')) {
      detail = 'The link expired or was already used.';
      actions = [
        'Request a fresh magic link / signup confirmation.',
        'Click the new link within an hour, in the same browser that started sign-in.'
      ];
    } else {
      detail = 'Common causes: redirect URL not in Supabase allow-list, OAuth app not configured, or you cancelled the consent screen.';
      actions = [];
    }
    setTimeout(() => void goto(`${base}/login`), 12000);
  }
</script>

<svelte:head><title>Signing in… · Cryptex</title></svelte:head>

<div class="m-auto mt-16 max-w-2xl space-y-4 px-6 sm:mt-24">
  <p class="text-center text-base font-medium text-foreground">{message}</p>
  {#if detail}
    <p class="text-center text-sm leading-relaxed text-muted-foreground">{detail}</p>
  {/if}

  {#if actions.length > 0}
    <ol class="space-y-2 rounded-2xl border border-border/60 bg-card/40 p-5 text-sm leading-relaxed shadow-glass">
      {#each actions as a, i}
        <li class="flex gap-3">
          <span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">{i + 1}</span>
          <span class="min-w-0 flex-1 break-words">
            {#if a.includes('https://') || a.includes('http://')}
              <!-- Render embedded URLs as code so they're easy to copy -->
              {#each a.split(/(https?:\/\/[^\s]+)/g) as part}
                {#if /^https?:\/\//.test(part)}
                  <code class="break-all rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[12px]">{part}</code>
                {:else}
                  {part}
                {/if}
              {/each}
            {:else}
              {a}
            {/if}
          </span>
        </li>
      {/each}
    </ol>
    {#if supabaseUrl}
      <p class="text-center text-[11px] text-muted-foreground">
        Supabase project URL detected: <code class="rounded bg-muted/40 px-1.5 py-0.5 font-mono">{supabaseUrl}</code>
      </p>
    {/if}
    <p class="text-center text-[11px] text-muted-foreground">
      Redirecting back to the sign-in page automatically. <a href="{base}/login" class="text-primary underline-offset-2 hover:underline">Skip wait →</a>
    </p>
  {/if}
</div>
