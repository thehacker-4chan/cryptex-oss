# Cryptex — Google / GitHub OAuth + faster email delivery (Beginner's Guide)

You already have Cryptex deployed and email/password sign-in working
(see [DEPLOY-DOKPLOY-SUPABASE.md](DEPLOY-DOKPLOY-SUPABASE.md)). This
guide adds two things that the default setup leaves rough:

1. **Faster, more reliable signup-confirmation + magic-link emails.**
   The default Supabase email server is shared, throttled, and can take
   anywhere from 30 seconds to several minutes — and free tier caps you
   at **3-4 emails per hour, total**. We'll swap in a real transactional
   provider (Resend's free tier — 100/day, instant delivery).
2. **Working Google + GitHub "Sign in with…" buttons** on `/login` and
   `/signup`. They render today but are dead until you do the OAuth-app
   registration on each provider's developer console.

Total time: ~25 minutes if you go through both. Each section is
independent — pick what you need.

---

## Why are my signup / magic-link emails so slow?

Three reasons, all of them config — not a Cryptex bug:

1. **Supabase's built-in mailer is a shared, rate-limited service.**
   Supabase explicitly says it's intended for "test only" — they
   throttle outbound mail aggressively. On the free plan you get
   roughly **3-4 emails per hour, project-wide** (not per user).
   Hit that ceiling and subsequent confirmation/magic-link/reset emails
   are silently dropped or queued for an unspecified delay.
2. **Generic-IP deliverability is bad.** Even when Supabase's mailer
   does send, the originating IPs are shared with thousands of other
   projects — Gmail, Outlook, and corporate filters either flag the
   email as spam or hold it in greylist purgatory for several minutes.
3. **Email confirmation is required by default.** Until the user clicks
   the link, `signInWithPassword` returns "Email not confirmed". So a
   slow email = perceived broken signup.

The fix is to wire up a transactional email provider so Supabase sends
through *your* domain with proper SPF/DKIM. Delivery becomes instant
(< 5 seconds) and the rate limit moves out of the way.

---

## Part A — Custom SMTP via Resend (10 minutes, recommended)

We'll use [Resend](https://resend.com) because:
- Free tier: 100 emails/day, 3,000/month — plenty for a small auth flow.
- Sign-up takes 60 seconds (GitHub login).
- DNS/DKIM setup is the simplest in the industry (one-click verify).

You can substitute SendGrid / Postmark / Mailgun / AWS SES — the
Supabase config shape is identical, only the SMTP host/port/credentials
differ. Resend is the smoothest first-time experience.

### A.1 Create a Resend account + verify your domain

1. Go to <https://resend.com> and sign up (GitHub login is fastest).
2. Once in the dashboard, click **Domains** → **Add Domain**.
3. Enter the domain you want to send *from* — e.g. if your site is
   `cryptex.your-domain.com`, you can either:
   - Use the parent domain (`your-domain.com`) so emails come from
     `noreply@your-domain.com` — recommended.
   - Or use the subdomain (`cryptex.your-domain.com`) so they come from
     `noreply@cryptex.your-domain.com`.
4. Resend shows you 3 DNS records to add (SPF + DKIM + a return-path
   MX). Copy each one.
5. In your domain registrar's DNS panel (Cloudflare, Namecheap,
   whatever you used in the original deploy guide), add those 3 records
   exactly as shown. Each looks something like:
   ```
   Type   Name             Value                                          TTL
   TXT    send.cryptex     v=spf1 include:amazonses.com ~all              Auto
   TXT    resend._domainkey.cryptex   p=MIGfMA0GCSqG…(long DKIM key)…    Auto
   MX     send.cryptex     feedback-smtp.us-east-1.amazonses.com (10)    Auto
   ```
6. Back in Resend, click **Verify DNS Records**. Verification usually
   takes 1-5 minutes; the indicator turns green.

> If verification stalls past 10 minutes, run `dig TXT _domainkey.your-domain.com`
> from any terminal — if your record isn't there, it didn't propagate.
> Cloudflare's "proxied" toggle (orange cloud) does NOT apply to TXT/MX,
> so leave it alone for these.

### A.2 Generate a Resend API key

1. In Resend, click **API Keys** → **Create API Key**.
2. **Name**: `cryptex-supabase-smtp`
3. **Permission**: `Sending access` (default).
4. Click **Add**. Copy the key — it starts with `re_…`. **You only see
   it once; if you close the dialog you have to regenerate.**

### A.3 Plug Resend into Supabase as the SMTP provider

1. In Supabase, go to **Project Settings** (gear icon) → **Authentication**
   → **SMTP Settings**.
2. Toggle **Enable Custom SMTP** to ON.
3. Fill in:
   ```
   Sender email:  noreply@your-domain.com
   Sender name:   Cryptex          (or whatever you want)
   Host:          smtp.resend.com
   Port number:   587
   Min interval:  60               (seconds — Supabase's per-user rate-limit)
   Username:      resend
   Password:      re_xxxxxxx…      (the API key from A.2)
   ```
4. Click **Save**.
5. Right below the form, click **Send a test email**. Type your own
   email, hit send. It should arrive in **< 10 seconds**. If it doesn't,
   jump to Troubleshooting at the bottom.

### A.4 Optional but recommended — bump the rate-limits

In Supabase → **Authentication** → **Rate Limits**, you'll see a few
per-hour caps (signup, password reset, OTP). The defaults are
deliberately conservative for the shared mailer. With your own SMTP
you can safely bump these:

| Action | Default | Suggested |
|---|---|---|
| Token refresh | 150/5min | leave |
| Magic link / OTP | 30/h | 360/h (1 every 10 sec) |
| Email signup | 30/h | 360/h |
| Password reset | 30/h | 360/h |

Click **Save**. These are project-wide, not per-user, so don't crank
them to infinity unless you really expect that volume.

### A.5 Customize the email templates (optional, 2 minutes)

1. **Authentication** → **Email Templates**.
2. There are 5 templates: Confirm signup, Invite user, Magic link, Change
   email, Reset password. Each has a default with a `{{ .ConfirmationURL }}`
   placeholder.
3. At minimum, replace the "Supabase" branding with "Cryptex" so the
   email feels like it's from you, not a leaked vendor.

---

## Part B — Google "Sign in with Google" (8 minutes)

You need an OAuth Client ID + Secret from Google Cloud Console, then
paste them into Supabase. Once enabled, the **Continue with Google**
button on `/login` and `/signup` starts working — no Cryptex rebuild
needed.

### B.1 Get your Supabase callback URL (important — write it down)

1. In Supabase, **Authentication** → **Providers** → click **Google**.
2. At the bottom of the panel you'll see **Callback URL (for OAuth)** —
   it looks like:
   ```
   https://abcdefgh.supabase.co/auth/v1/callback
   ```
3. Copy this. Google needs it. **It is NOT your Cryptex domain — it's
   Supabase's project URL with `/auth/v1/callback` appended.**

### B.2 Create a Google OAuth Client

1. Go to <https://console.cloud.google.com>. Sign in with the Google
   account you want to own this OAuth app.
2. **Top bar → project dropdown → New Project**:
   - **Name**: `Cryptex Auth` (or any)
   - **Location**: leave default ("No organization") unless you have a
     workspace.
   - Click **Create**. Wait 10 seconds, then switch to that project.
3. **APIs & Services → OAuth consent screen**:
   - **User Type**: **External** (so anyone with a Google account can
     sign in, not just your org). Click **Create**.
   - **App information**:
     - App name: `Cryptex`
     - User support email: your email
     - App logo: optional
   - **App domain** (recommended for production polish, optional for
     testing):
     - Application home page: `https://cryptex.your-domain.com`
     - Application privacy policy link: `https://cryptex.your-domain.com/about` (or wherever)
     - Application terms of service link: same as above is fine for now
   - **Authorized domains**: add `your-domain.com` (just the apex —
     Google figures out subdomains itself).
   - **Developer contact**: your email.
   - Click **Save and continue**.
   - **Scopes**: leave empty for now (Supabase only needs the default
     identity scopes — `email`, `profile`, `openid` — and asks for them
     automatically). Click **Save and continue**.
   - **Test users**: while in "Testing" mode, only listed users can sign
     in. Add your own email, then any team members. Click **Save**.
   - **Summary → Back to Dashboard**.

   > **Going public:** While in "Testing" status, only test-users can
   > sign in. To open it to anyone, click **Publish App** at the top of
   > the OAuth consent screen page. Google may require a verification
   > step if you ask for sensitive scopes — for default identity scopes
   > you don't need verification, just publishing.

4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - **Application type**: **Web application**
   - **Name**: `Cryptex Web` (any)
   - **Authorized JavaScript origins** — add **two** entries:
     - `https://cryptex.your-domain.com`
     - `http://localhost:5173`  (for local dev)
   - **Authorized redirect URIs** — add the **Supabase callback** from
     B.1 (and the Cryptex callback as a fallback):
     - `https://abcdefgh.supabase.co/auth/v1/callback`  ← from B.1
     - `https://cryptex.your-domain.com/auth/callback`
     - `http://localhost:5173/auth/callback`
   - Click **Create**.
5. A modal pops up with **Client ID** and **Client Secret**. Copy both.
   You can come back to them later under **Credentials** → click your
   client → "show secret".

### B.3 Paste the credentials into Supabase

1. Back in Supabase, **Authentication** → **Providers** → **Google**.
2. Toggle **Enable Sign in with Google** to ON.
3. Paste:
   - **Client ID (for OAuth)** → the Google Client ID from B.2.5
   - **Client Secret (for OAuth)** → the Google Client Secret from B.2.5
4. Leave **Skip nonce check** OFF (default).
5. Click **Save**.

### B.4 Test it

1. Open an incognito window so you don't have any stale Cryptex auth.
2. Go to `https://cryptex.your-domain.com/login`.
3. Click **Continue with Google**. You should be bounced to Google's
   consent screen ("Cryptex wants to access your basic profile…").
4. Approve. You bounce back through Supabase → `/auth/callback` → land
   on `/chat` signed in.

If you see "Error 400: redirect_uri_mismatch" — your redirect URI in
B.2.4 doesn't match B.1's callback exactly. Re-copy carefully (the
trailing slash matters).

---

## Part C — GitHub "Sign in with GitHub" (5 minutes)

Same shape as Google, simpler UI.

### C.1 Get your Supabase callback URL

(Same as B.1 — you can reuse the value.)

### C.2 Create a GitHub OAuth App

1. Go to <https://github.com/settings/developers> while logged in.
2. **OAuth Apps** → **New OAuth App**.
3. Fill in:
   - **Application name**: `Cryptex`
   - **Homepage URL**: `https://cryptex.your-domain.com`
   - **Application description**: optional — `AI red-team research lab`
     reads well.
   - **Authorization callback URL**: paste the Supabase callback from
     B.1, e.g. `https://abcdefgh.supabase.co/auth/v1/callback`.
     (GitHub only allows one callback per app — if you want to also
     support local dev, register a *separate* OAuth app for localhost.)
4. Leave **Enable Device Flow** unchecked.
5. Click **Register application**.

### C.3 Generate a client secret

1. On the new app's page, you'll see **Client ID** at the top — copy it.
2. Click **Generate a new client secret**. GitHub may ask you to
   confirm with your GitHub password / 2FA.
3. Copy the secret immediately. **Once you leave the page, it's masked
   permanently — you'd have to generate a new one.**

### C.4 Paste into Supabase

1. Supabase → **Authentication** → **Providers** → **GitHub**.
2. Toggle **Enable Sign in with GitHub** to ON.
3. Paste:
   - **Client ID (for OAuth)** → C.3.1
   - **Client Secret (for OAuth)** → C.3.2-3
4. Click **Save**.

### C.5 Test it

1. Incognito → `https://cryptex.your-domain.com/login` → **Continue
   with GitHub**.
2. GitHub asks "Authorize Cryptex?" → click Authorize.
3. You bounce back signed in.

If GitHub says "The redirect_uri MUST match the registered callback
URL" — same as Google, your callback in C.2.3 doesn't match B.1.
Re-copy carefully.

---

## Part D — Optional: separate OAuth apps for local dev

Both Google and GitHub allow multiple redirect URIs (Google does it in
one OAuth client; GitHub requires a separate OAuth app per callback).
For a clean dev experience:

- **Google**: add `http://localhost:5173/auth/callback` to the same
  OAuth Client's "Authorized redirect URIs" list. Already done in B.2.4
  if you followed the steps.
- **GitHub**: register a second OAuth App (e.g. `Cryptex Local`) with
  callback `http://localhost:5173/auth/callback`. Use those credentials
  in a local `.env`:
  ```
  PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
  PUBLIC_SUPABASE_ANON_KEY=...
  VITE_AUTH_ENABLED=true
  ```
  (You don't need to set the GitHub client ID anywhere in Cryptex — all
  OAuth secrets live in Supabase, not in your bundle.)

---

## Troubleshooting

### Resend test email arrives 30+ seconds late or in spam

- DNS/DKIM not yet propagated — re-check Resend's verification status.
- Sender domain in Supabase SMTP settings doesn't match the verified
  domain in Resend → Resend rejects with "domain not verified". Check
  Resend's **Logs** tab for the rejection reason.
- Gmail / Outlook spam-filter cold start — first email from a new
  domain often lands in spam. Mark it "not spam" once and subsequent
  emails go to inbox.

### "Cannot find provider 'google' in your Supabase project"

You forgot to **Save** in B.3 / C.4 after toggling the provider on.
Toggle it again, click Save, retry.

### Magic link signs me in but I land on `/auth/callback` instead of `/chat`

Cryptex's `/auth/callback` route handles the post-auth redirect. If
you're stuck on it, check the browser DevTools console — most likely
the `redirectTo` URL doesn't match what's in Supabase's allow-list.
Recheck **Authentication → URL Configuration → Redirect URLs** in
Supabase and ensure both `https://cryptex.your-domain.com/auth/callback`
and `http://localhost:5173/auth/callback` are listed.

### Google OAuth: "Error 403: access_denied"

You're in "Testing" mode in B.2.3 and the email you're trying to sign
in with isn't in the test-users list. Either add it as a test user, or
publish the app (Google OAuth consent screen → **Publish App**).

### Google OAuth: "This app isn't verified"

Expected for unpublished apps with > 100 users or apps using sensitive
scopes. Cryptex only uses `email`/`profile`/`openid` (non-sensitive),
so you can ignore the warning by clicking "Advanced → Go to Cryptex
(unsafe)". For production polish, click **Publish App** in B.2.3.

### GitHub OAuth: "Application suspended"

GitHub auto-suspends OAuth apps with very low traffic for 6+ months. If
you set this up early then went quiet, GitHub may have parked it.
Re-activate from <https://github.com/settings/developers>.

### Email confirmation never arrives, even with custom SMTP

1. Check Resend's **Logs** tab — was the email accepted at all? If not,
   Supabase rejected it before sending (rate-limit, bad template).
2. Check the recipient's spam folder.
3. Make sure **Confirm email** is still ON in Supabase → Authentication
   → Providers → Email. (If you toggle it off, signups skip the email
   entirely and Supabase auto-confirms.)
4. Re-test "Send a test email" in Supabase SMTP settings — that bypasses
   the auth flow entirely and tells you whether the SMTP itself works.

### "Sign-in failed: redirect not allowed" on OAuth providers

Cryptex's redirect-back URL isn't in Supabase's allow-list. Supabase →
**Authentication** → **URL Configuration** → **Redirect URLs** should
include:
```
https://cryptex.your-domain.com/auth/callback
http://localhost:5173/auth/callback
```

### Want to disable email confirmation entirely (development only)

Supabase → **Authentication** → **Providers** → **Email** → **Confirm
email** OFF. Users sign up and are auto-confirmed; no email is sent.
**Don't ship this to production** — it lets anyone sign up with anyone
else's email and lock that person out of recovery.

---

## Quick reference — what each value is for

| Value | Where it lives | Used by |
|---|---|---|
| Supabase Project URL | Cryptex `PUBLIC_SUPABASE_URL` env | Browser SDK target |
| Supabase anon key | Cryptex `PUBLIC_SUPABASE_ANON_KEY` env | Browser SDK auth |
| Supabase service role key | **Never put anywhere browser-visible** | Server-side admin only — Cryptex doesn't use it |
| Supabase OAuth callback URL | Google + GitHub OAuth app config | Where Supabase receives the OAuth code |
| Cryptex `/auth/callback` URL | Supabase Redirect URLs list | Where Cryptex finishes the auth flow |
| Resend API key | Supabase SMTP password field | Sending auth emails |
| Google OAuth Client ID + Secret | Supabase Auth → Providers → Google | Bridging Google login → Supabase session |
| GitHub OAuth Client ID + Secret | Supabase Auth → Providers → GitHub | Bridging GitHub login → Supabase session |

That's the whole loop. Once Resend is wired up emails arrive in
seconds; once Google + GitHub OAuth are configured the buttons on
`/login` and `/signup` Just Work.
