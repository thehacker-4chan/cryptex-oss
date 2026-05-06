<script lang="ts">
  import { session } from '$lib/auth/session.svelte';
  import { featureFlags } from '$lib/config/featureFlags';
  import { notify } from '$lib/stores/toast.svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import Shield from 'lucide-svelte/icons/shield';
  import Eye from 'lucide-svelte/icons/eye';
  import EyeOff from 'lucide-svelte/icons/eye-off';
  import Check from 'lucide-svelte/icons/check';
  import X from 'lucide-svelte/icons/x';
  import Mail from 'lucide-svelte/icons/mail';
  import LogOut from 'lucide-svelte/icons/log-out';
  import KeyRound from 'lucide-svelte/icons/key-round';
  import Loader from 'lucide-svelte/icons/loader-circle';

  // ---------- Password change state ----------
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let showPassword = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);

  const hasPassword = $derived.by(() => {
    const identities = session.supabaseSession?.user?.identities ?? [];
    return identities.some((i) => i.provider === 'email');
  });

  const rules = $derived([
    { label: 'At least 8 characters', ok: newPassword.length >= 8 },
    { label: 'Contains a letter', ok: /[A-Za-z]/.test(newPassword) },
    { label: 'Contains a number', ok: /[0-9]/.test(newPassword) },
    { label: 'Different from current', ok: !hasPassword || (newPassword.length > 0 && newPassword !== currentPassword) }
  ]);

  const passwordsMatch = $derived(newPassword.length > 0 && newPassword === confirmPassword);

  const canSubmit = $derived(
    !busy && rules.every((r) => r.ok) && passwordsMatch && (!hasPassword || currentPassword.length > 0)
  );

  async function submit() {
    if (!canSubmit) return;
    busy = true;
    error = null;
    try {
      if (hasPassword) {
        await session.verifyCurrentPassword(currentPassword);
      }
      await session.updatePassword(newPassword);
      notify.success(hasPassword ? 'Password updated' : 'Password set');
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
    } catch (e) {
      // Surface the specific re-auth failure ("Current password is
      // incorrect.") since that's what the user can act on. Hide
      // server internals for everything else.
      const msg = (e as Error).message;
      error = /current password/i.test(msg) ? msg : 'Could not update password. Try again.';
    } finally {
      busy = false;
    }
  }

  // ---------- Email change state ----------
  let emailChangeStage = $state<'idle' | 'verify'>('idle');
  let newEmail = $state('');
  let emailReauthPassword = $state('');
  let emailOtp = $state('');
  let emailBusy = $state(false);
  let emailError = $state<string | null>(null);
  let emailInfo = $state<string | null>(null);

  async function requestEmailChange() {
    if (emailBusy) return;
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      emailError = 'Enter a valid email address.';
      return;
    }
    if (newEmail.toLowerCase() === (session.current?.email ?? '').toLowerCase()) {
      emailError = 'New email must differ from the current one.';
      return;
    }
    emailBusy = true;
    emailError = null;
    emailInfo = null;
    try {
      // Belt-and-braces re-auth before triggering email change. Stops a
      // stolen-session attacker from silently swapping the email out from
      // under the real owner.
      if (hasPassword) {
        await session.verifyCurrentPassword(emailReauthPassword);
      }
      await session.requestEmailChange(newEmail);
      emailChangeStage = 'verify';
      emailInfo = `Code sent to ${newEmail}.`;
      emailReauthPassword = '';
    } catch (e) {
      const msg = (e as Error).message;
      emailError = /current password/i.test(msg) ? msg : 'Could not send the code. Check the address and try again.';
    } finally {
      emailBusy = false;
    }
  }

  async function verifyEmailChange() {
    if (emailBusy || !emailOtp) return;
    emailBusy = true;
    emailError = null;
    emailInfo = null;
    try {
      await session.verifyEmailOtp(newEmail, emailOtp, 'email_change');
      notify.success('Email updated');
      emailChangeStage = 'idle';
      newEmail = '';
      emailOtp = '';
    } catch {
      emailError = 'That code is invalid or expired.';
    } finally {
      emailBusy = false;
    }
  }

  // ---------- Sign out everywhere ----------
  let signOutBusy = $state(false);
  async function signOutAll() {
    if (signOutBusy) return;
    if (!confirm('Sign out of every device this account is signed in on? You\'ll need to sign in again on each.')) return;
    signOutBusy = true;
    try {
      await session.signOutAllDevices();
      notify.success('Signed out everywhere');
      void goto(`${base}/login`);
    } catch {
      notify.error('Could not sign out. Try again.');
    } finally {
      signOutBusy = false;
    }
  }
</script>

{#if featureFlags.authEnabled && session.isSignedIn}
  <!-- ===== Account info ===== -->
  <div class="space-y-3 rounded-xl border border-border bg-card/60 p-5 shadow-glass">
    <div class="flex items-center gap-2">
      <Shield size={16} class="text-primary" />
      <h2 class="font-serif text-lg">Account</h2>
    </div>
    <div class="rounded-lg border border-border/60 bg-background/30 p-3 text-sm">
      <div class="text-[11px] uppercase tracking-wider text-muted-foreground">Signed in as</div>
      <div class="mt-0.5 font-mono text-[13px] text-foreground break-all">{session.current?.email ?? '—'}</div>
    </div>
  </div>

  <!-- ===== Password ===== -->
  <div class="space-y-3 rounded-xl border border-border bg-card/60 p-5 shadow-glass">
    <div class="flex items-center gap-2">
      <KeyRound size={16} class="text-primary" />
      <h2 class="font-serif text-lg">Password</h2>
    </div>
    <p class="text-sm text-muted-foreground">
      {hasPassword
        ? 'Change your password — you\'ll need your current one to confirm.'
        : 'You signed in via OAuth or email code. Set a password to enable email + password sign-in.'}
    </p>

    <form onsubmit={(e) => { e.preventDefault(); void submit(); }} class="flex flex-col gap-3 max-w-sm">
      {#if hasPassword}
        <label class="flex flex-col gap-1.5 text-xs">
          <span class="font-medium text-foreground">Current password</span>
          <div class="relative">
            <input
              bind:value={currentPassword}
              type={showPassword ? 'text' : 'password'}
              required
              autocomplete="current-password"
              placeholder="Your existing password"
              class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 pr-10 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
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
      {/if}

      <label class="flex flex-col gap-1.5 text-xs">
        <span class="font-medium text-foreground">New password</span>
        <div class="relative">
          <input
            bind:value={newPassword}
            type={showPassword ? 'text' : 'password'}
            required
            minlength="8"
            autocomplete="new-password"
            placeholder="At least 8 characters"
            class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 pr-10 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
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
        {#if newPassword.length > 0}
          <ul class="mt-1 flex flex-col gap-0.5 text-[11px]">
            {#each rules as rule}
              <li class={rule.ok ? 'flex items-center gap-1 text-foreground' : 'flex items-center gap-1 text-muted-foreground'}>
                {#if rule.ok}<Check size={12} class="text-emerald-500" />{:else}<X size={12} class="text-muted-foreground/60" />{/if}
                <span>{rule.label}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </label>

      <label class="flex flex-col gap-1.5 text-xs">
        <span class="font-medium text-foreground">Confirm new password</span>
        <input
          bind:value={confirmPassword}
          type={showPassword ? 'text' : 'password'}
          required
          autocomplete="new-password"
          placeholder="Repeat the new password"
          class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {#if confirmPassword.length > 0 && !passwordsMatch}
          <span class="text-[11px] text-destructive">Passwords don't match.</span>
        {/if}
      </label>

      <div>
        <button
          type="submit"
          disabled={!canSubmit}
          class="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >{busy ? 'Saving…' : (hasPassword ? 'Update password' : 'Set password')}</button>
      </div>

      {#if error}
        <p role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error}</p>
      {/if}
    </form>
  </div>

  <!-- ===== Email change ===== -->
  <div class="space-y-3 rounded-xl border border-border bg-card/60 p-5 shadow-glass">
    <div class="flex items-center gap-2">
      <Mail size={16} class="text-primary" />
      <h2 class="font-serif text-lg">Email address</h2>
    </div>
    <p class="text-sm text-muted-foreground">
      We'll send a 6-digit code to the new address. Enter it to confirm the change.
      {#if hasPassword}
        Re-auth with your current password is required.
      {/if}
    </p>

    {#if emailChangeStage === 'idle'}
      <form onsubmit={(e) => { e.preventDefault(); void requestEmailChange(); }} class="flex flex-col gap-3 max-w-sm">
        <label class="flex flex-col gap-1.5 text-xs">
          <span class="font-medium text-foreground">New email</span>
          <input
            bind:value={newEmail}
            type="email"
            required
            autocomplete="email"
            spellcheck="false"
            placeholder="new@example.com"
            class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        {#if hasPassword}
          <label class="flex flex-col gap-1.5 text-xs">
            <span class="font-medium text-foreground">Current password</span>
            <input
              bind:value={emailReauthPassword}
              type="password"
              required
              autocomplete="current-password"
              placeholder="Confirms it's really you"
              class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        {/if}

        <div>
          <button
            type="submit"
            disabled={emailBusy || !newEmail || (hasPassword && !emailReauthPassword)}
            class="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {#if emailBusy}
              <Loader size={13} class="animate-spin" /> Sending…
            {:else}
              Send code
            {/if}
          </button>
        </div>
      </form>
    {:else}
      <form onsubmit={(e) => { e.preventDefault(); void verifyEmailChange(); }} class="flex flex-col gap-3 max-w-sm">
        <label class="flex flex-col gap-1.5 text-xs">
          <span class="font-medium text-foreground">Verification code</span>
          <input
            bind:value={emailOtp}
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9]*"
            maxlength="10"
            placeholder="000000"
            class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 text-center font-mono text-base tracking-[0.4em] shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={emailBusy || !emailOtp}
            class="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {#if emailBusy}
              <Loader size={13} class="animate-spin" /> Verifying…
            {:else}
              Confirm change
            {/if}
          </button>
          <button
            type="button"
            onclick={() => { emailChangeStage = 'idle'; emailOtp = ''; emailError = null; emailInfo = null; }}
            class="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 text-xs text-muted-foreground hover:text-foreground"
          >Cancel</button>
        </div>
      </form>
    {/if}

    {#if emailInfo}
      <p role="status" class="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-foreground">{emailInfo}</p>
    {/if}
    {#if emailError}
      <p role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{emailError}</p>
    {/if}
  </div>

  <!-- ===== Sessions / sign out everywhere ===== -->
  <div class="space-y-3 rounded-xl border border-border bg-card/60 p-5 shadow-glass">
    <div class="flex items-center gap-2">
      <LogOut size={16} class="text-primary" />
      <h2 class="font-serif text-lg">Sessions</h2>
    </div>
    <p class="text-sm text-muted-foreground">
      Sign out of every device this account is signed in on. Use this if you suspect your password was leaked, or you're handing the account off.
    </p>
    <button
      type="button"
      onclick={signOutAll}
      disabled={signOutBusy}
      class="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
    >
      {#if signOutBusy}
        <Loader size={13} class="animate-spin" /> Signing out…
      {:else}
        <LogOut size={13} /> Sign out everywhere
      {/if}
    </button>
  </div>
{/if}
