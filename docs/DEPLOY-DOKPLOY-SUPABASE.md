# Deploy Cryptex to Dokploy with Supabase Auth — Beginner's Guide

A complete, no-experience-required walkthrough. Follow it top-to-bottom and you'll have a working sign-in-required Cryptex deployment in ~30 minutes.

**What you'll end up with:**
- Cryptex running on your VPS at `https://cryptex.your-domain.com`
- HTTPS via Let's Encrypt (auto-renewed)
- Email/password signup + sign-in via Supabase
- Optional Google + GitHub OAuth
- Auto-deploy on every `git push origin master`
- Chat tab requires sign-in; offline tools (Transform, Decode, etc.) stay public

---

## What you need before starting

| Thing | Cost | Where to get it |
|---|---|---|
| A VPS with Dokploy installed | $5-10/mo | DigitalOcean, Hetzner, Linode, etc. — Dokploy's [installer](https://dokploy.com/docs/installation) is one shell command |
| A domain you control | $10-15/yr | Namecheap, Cloudflare, Porkbun, etc. |
| A free Supabase account | Free | <https://supabase.com> |
| The Cryptex repo on GitHub | Free | This repo, forked to your account |

You do NOT need: Docker knowledge, nginx knowledge, AWS, a credit card (the free tiers cover this).

---

## Part 1 — Set up Supabase (5 minutes)

### 1.1 Create a Supabase project

1. Go to <https://supabase.com> and sign up (use GitHub login for fastest path).
2. Click **New project**.
3. Fill in:
   - **Name**: `cryptex` (or whatever)
   - **Database Password**: click "Generate" and **copy it somewhere safe**. You won't need it for Cryptex itself, but Supabase needs it.
   - **Region**: pick the one closest to your VPS.
   - **Plan**: Free is fine.
4. Click **Create new project**. Wait ~1 minute for provisioning.

### 1.2 Find your project URL and anon key

1. In your Supabase project dashboard, click **Project Settings** (gear icon, bottom-left) → **API**.
2. You'll see two values you need to copy:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **Project API key** — under "Project API keys", copy the **`anon` `public`** key (NOT the `service_role` key).

Keep these two values open in a notes app — you'll paste them into Dokploy in Part 3.

> **Security note:** The `anon` key is safe to ship to the browser. The `service_role` key is NOT — never put it anywhere browser-visible. Cryptex only needs the `anon` key.

### 1.3 Configure email/password sign-in

1. In Supabase, go to **Authentication** (left sidebar) → **Providers**.
2. **Email** is enabled by default. Click it to confirm:
   - **Enable Email provider**: ON
   - **Confirm email**: ON (recommended — users must click the confirmation link before signing in)
   - Save if you changed anything.
3. Optional: scroll down and enable **Google** or **GitHub** if you want OAuth.
   - For Google: see <https://supabase.com/docs/guides/auth/social-login/auth-google>
   - For GitHub: see <https://supabase.com/docs/guides/auth/social-login/auth-github>
   - Each requires a 5-minute side-trip to that provider's developer console. Skip these on first deploy — you can add them later without redeploying.

### 1.4 Set redirect URLs

This step is **easy to forget and breaks sign-in if you skip it**.

1. In Supabase, go to **Authentication** → **URL Configuration**.
2. Set **Site URL** to: `https://cryptex.your-domain.com` (your real production URL — replace the placeholder).
3. Under **Redirect URLs**, add these (one per line):
   ```
   https://cryptex.your-domain.com/auth/callback
   http://localhost:5173/auth/callback
   ```
   The `localhost` line is for local dev — keep it.
4. Click **Save**.

> **Why this matters:** OAuth + magic links bounce the user through Supabase's servers, then back to your site. Supabase only allows the bounce-back to URLs on this list. Wrong list = user lands on a "redirect not allowed" error.

---

## Part 2 — Set up DNS (2 minutes)

1. In your domain registrar's DNS settings, create an **A record**:
   - **Name/Host**: `cryptex` (subdomain) or `@` (root domain)
   - **Type**: `A`
   - **Value**: your VPS's public IPv4 address
   - **TTL**: `Auto` or `3600`
2. Wait 1-5 minutes for DNS to propagate. Test with:
   ```bash
   nslookup cryptex.your-domain.com
   ```
   You should see your VPS IP. If not, wait longer.

> **Critical**: DNS MUST be live BEFORE first deploy. Let's Encrypt's HTTP-01 challenge fails if DNS doesn't resolve, and you'll get cert errors.

---

## Part 3 — Deploy with Dokploy (10 minutes)

### 3.1 Install Dokploy on your VPS (skip if already done)

SSH into your VPS and run:

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

After ~3 minutes, visit `http://your-vps-ip:3000` and create the admin account.

### 3.2 Add Cryptex as a Docker Compose app

1. In the Dokploy dashboard, click **Create Project** (or pick an existing project).
2. Click **Create Service** → **Compose**.
3. Fill in:
   - **Name**: `cryptex`
   - **Provider**: GitHub
   - Click **Authorize** if you haven't connected GitHub yet. Pick the repo (your fork of Cryptex).
   - **Branch**: `master`
   - **Compose File**: `docker-compose.yml` (the default)

### 3.3 Set environment variables

This is the most important step. In Dokploy, click your `cryptex` service → **Environment** tab.

Paste in:

```env
# Required — your domain
DOMAIN=cryptex.your-domain.com

# Required for sign-in to work — turn auth on
VITE_AUTH_ENABLED=true

# Required for sign-in to work — paste your Supabase values from Part 1.2
PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key-here

# Recommended — keep Godmode's local mode on so users without a paid plan
# can still race candidates locally using their own API keys.
PUBLIC_GODMODE_LOCAL_ENABLED=true

# Optional — leave empty unless serving on a subpath like /cryptex
BASE_PATH=

# Optional — Google AdSense publisher id; leave empty for no ads
PUBLIC_ADSENSE_CLIENT=

# Optional — container timezone
TZ=UTC
```

Replace the three placeholder values:
- `cryptex.your-domain.com` → your actual domain
- `https://abcdefgh.supabase.co` → your Supabase Project URL
- `eyJhb…anon-key-here` → your Supabase anon key

Click **Save**.

> **Important**: `VITE_AUTH_ENABLED=true` is what makes `/chat` require sign-in. Without it, anyone hitting `/chat` gets in without auth (back-compat with the old static-only deploys).

### 3.4 Do NOT add a Domain entry in Dokploy's "Domains" tab

The `docker-compose.yml` file already declares all the Traefik labels needed for HTTPS routing. Adding a Domain entry in Dokploy's UI **duplicates labels and breaks Let's Encrypt cert issuance**. Just leave the Domains tab empty — `DOMAIN` env var does the work.

### 3.5 Deploy

1. In Dokploy, click your `cryptex` service → **Deploy**.
2. Watch the build logs. First deploy takes 2-4 minutes.
3. When done, visit `https://cryptex.your-domain.com`. You should see the Cryptex landing page.
4. Click **Chat** in the navigation. You should be redirected to `/login`.

If anything fails, jump to **Troubleshooting** at the bottom.

---

## Part 4 — Test sign-up + sign-in end-to-end (3 minutes)

1. Visit `https://cryptex.your-domain.com/signup`.
2. Enter your email + password (≥8 chars), check the terms box, click **Create account**.
3. You should see "Check your inbox". Open your email — click the **Confirm** link from Supabase.
4. The link bounces you back to `https://cryptex.your-domain.com/auth/callback`, then to `/chat`.
5. You're signed in. Open the chat **⋮** menu (three dots, top-right of a chat) → you should see **Sign out (your@email)** at the bottom.

If sign-up didn't arrive in your inbox:
- Check spam folder.
- Free Supabase has a hard cap of **3-4 outbound emails per hour, project-wide** on the shared mailer. Hitting that ceiling silently drops or queues subsequent emails. Wait an hour and retry, or…
- **Strongly recommended for any real use:** swap Supabase's shared mailer for a real transactional provider (Resend, SendGrid, Postmark, AWS SES). Step-by-step: see [DEPLOY-OAUTH-AND-EMAIL.md → Part A](DEPLOY-OAUTH-AND-EMAIL.md#part-a--custom-smtp-via-resend-10-minutes-recommended). Resend's free tier covers 100 emails/day and signup-confirmation arrives in under 5 seconds.

---

## Part 5 — Auto-deploy on every push (already on)

Every time you `git push origin master`, Dokploy automatically:
1. Pulls the new code.
2. Re-builds the Docker image.
3. Replaces the running container with the new one (zero downtime).
4. If the new container fails its healthcheck, Dokploy keeps the OLD container running and shows you the failure.

To roll back a bad deploy:
```bash
git revert <bad-commit-sha>
git push origin master
```

That's it. No manual intervention needed.

---

## Troubleshooting

### Console says `[auth] VITE_AUTH_ENABLED=true but PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY missing` (login page renders, but every action fails with "Auth not enabled")

This is the most common Dokploy gotcha. The login UI rendered (so `VITE_AUTH_ENABLED` reached the build), but the two Supabase vars did NOT — they're undefined in the served bundle.

**Why it happens:** Dokploy compose apps use Docker Compose's `${VAR:-}` interpolation to inject build args. Compose reads those values from a `.env` file in the build context (or the host shell). On some Dokploy versions the **Environment** tab only writes runtime container env, NOT the compose-level `.env` — so build interpolation resolves to empty, even though the runtime env tab shows the value correctly.

**Diagnose first** (Cryptex's Dockerfile prints a build-arg diagnostic). In Dokploy → your service → **Deployments** → open the latest build log and search for `[cryptex-build]`. You'll see exactly five lines like:

```
[cryptex-build] BASE_PATH=set
[cryptex-build] VITE_AUTH_ENABLED=true
[cryptex-build] PUBLIC_SUPABASE_URL=abcdefgh.supabase.co
[cryptex-build] PUBLIC_SUPABASE_ANON_KEY=set, length=232
[cryptex-build] PUBLIC_GODMODE_LOCAL_ENABLED=true
```

If any line shows `MISSING`, that variable did NOT reach the build step.

**Fix — try in this order:**

1. **Restart the build, not the container.** In Dokploy click **Deployments** → **Rebuild** (NOT Redeploy / NOT Restart). Only Rebuild re-runs `docker build` with current env values baked in.

2. **Set them in Dokploy's "Build" tab, not just "Environment".** Some Dokploy versions (≥ 0.18) split runtime env from build-time env into separate UI sections. Look for any of these labels in your service's settings sidebar:
   - "Build Arguments" / "Build Args"
   - "Build Variables"
   - "Build-time env"
   - A "Build" tab next to the "Environment" tab

   Paste the same five vars (`VITE_AUTH_ENABLED`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_GODMODE_LOCAL_ENABLED`, `DOMAIN`) there as well. Then Rebuild.

3. **If your Dokploy version has only one Environment tab**, the values from Environment SHOULD propagate to compose via `.env`. Confirm by SSH'ing into your VPS and running:
   ```bash
   cat /etc/dokploy/compose/<your-service-name>/.env
   ```
   You should see the variables there. If the file is missing or empty, that's a Dokploy bug — file an issue at <https://github.com/Dokploy/dokploy/issues> and use the workaround in step 4.

4. **Workaround — bake values into a fork.** As a last resort, in your fork edit `docker-compose.yml` and replace the `${VAR:-}` interpolations with literal values. Push, Rebuild. NEVER do this for `PUBLIC_SUPABASE_ANON_KEY` if your fork is public — the anon key is browser-safe but you still don't want it in git history. Make the fork private if you go this route.

5. **Hard-refresh the browser** (Ctrl+Shift+R / Cmd+Shift+R) after any successful rebuild — the browser may have cached the old static bundle.

### "Auth is disabled in this build" on /login or /signup

Cause: Same as above, but specifically `VITE_AUTH_ENABLED` is missing. Follow the same diagnostic + rebuild flow.

Older context: SvelteKit/Vite inline `PUBLIC_*` and `VITE_*` vars at BUILD time, not runtime — so setting them only in Dokploy's "Environment" tab is NOT enough; they have to be passed as Docker build args too.

Fix:
1. Confirm Dokploy → your service → **Environment** tab has all three vars set (Part 3.3).
2. Confirm you're on a deploy from commit `d2c8e8e` or later (the version where the Dockerfile + docker-compose.yml plumb `VITE_AUTH_ENABLED` through as a build ARG). Older deploys won't pick it up no matter what you set.
3. In Dokploy → your service → **Deployments** → click **Rebuild** (NOT just "Redeploy" — Rebuild forces the Docker build step to run again with the current env vars baked in).
4. Hard-refresh the browser (Ctrl+Shift+R / Cmd+Shift+R) — the browser may have cached the old static bundle that says "Auth is disabled".

To confirm the env vars actually reached the build, after rebuild open browser DevTools → Console on `/login` and run:
```js
window.__SUPABASE_URL_CHECK = !!document.querySelector('meta[name="supabase-status"]');
```
If the page no longer says "Auth is disabled", you're good.

### "Redirected too many times" or stuck on /login

Cause: `VITE_AUTH_ENABLED=true` is set but `PUBLIC_SUPABASE_URL` or `PUBLIC_SUPABASE_ANON_KEY` is missing/wrong. The login page can't talk to Supabase, so sign-in never completes, so the chat redirect fires forever.

Fix: Open browser DevTools → Console. You'll see something like `[auth] VITE_AUTH_ENABLED=true but PUBLIC_SUPABASE_URL... missing`. Re-check Part 3.3 env vars in Dokploy, then **Rebuild** (not just Redeploy).

### "Sign-in failed: redirect not allowed"

Cause: Part 1.4 — your production URL isn't in Supabase's Redirect URLs allow-list.

Fix: Supabase → **Authentication** → **URL Configuration** → add `https://cryptex.your-domain.com/auth/callback` to the list. Save. Try sign-in again (no redeploy needed — Supabase change is live immediately).

### "Connection not secure" / cert won't issue

Cause: DNS wasn't pointing at your VPS when the deploy ran, so Let's Encrypt's HTTP-01 challenge failed.

Fix:
1. Verify DNS: `nslookup cryptex.your-domain.com` should return your VPS IP.
2. Once DNS is correct, in Dokploy → **Deploy** again. Traefik will retry the cert.
3. Wait ~30 seconds.

### Site loads at HTTP but HTTPS gives 404

Cause: Traefik labels mismatch — usually because someone added a Domain entry in Dokploy's Domains tab in addition to the in-compose labels.

Fix: In Dokploy → your service → **Domains** tab → delete any entry. Then redeploy. The compose file's labels handle everything.

### Chat tab is accessible without sign-in

Cause: `VITE_AUTH_ENABLED` is not set (or set to `false`). The auth gate only fires when this flag is `true`.

Fix: Dokploy → Environment → set `VITE_AUTH_ENABLED=true` → Deploy.

### "503 Service Unavailable" from Traefik

Cause: The container is unhealthy or just started. Dokploy's healthcheck takes ~15s to pass on first boot.

Fix: Wait 30 seconds. If still 503, check Dokploy → **Logs** for build/runtime errors.

### Want OAuth (Google / GitHub) buttons to work

Cause: They don't work by default — you have to register an OAuth app on each provider's developer console and paste the credentials into Supabase.

Fix: Follow the step-by-step guide at [DEPLOY-OAUTH-AND-EMAIL.md](DEPLOY-OAUTH-AND-EMAIL.md) — Parts B (Google) and C (GitHub). Each takes ~5-8 minutes. No Cryptex rebuild needed; the buttons in `/login` and `/signup` start working as soon as you save the provider in Supabase.

### How do I make Cryptex public again (no sign-in required)?

Set `VITE_AUTH_ENABLED=false` in Dokploy → Deploy. Chat falls back to local-only mode (`ownerId='local'`). Existing user accounts are preserved in Supabase but unused.

---

## Security checklist

Before going public, verify:

- [ ] `VITE_AUTH_ENABLED=true` is set in Dokploy environment.
- [ ] Visiting `/chat` while signed out redirects to `/login`.
- [ ] Sign-up requires email confirmation (toggle in Supabase Auth Providers → Email).
- [ ] Password minimum length enforced (form requires ≥8 chars; Supabase enforces server-side).
- [ ] Production URL is in Supabase's Redirect URLs allow-list (and ONLY production + localhost — no random other URLs).
- [ ] HTTPS works (no cert warnings).
- [ ] You did NOT paste the `service_role` key anywhere — only the `anon` key.
- [ ] Optional but recommended: enable **Captcha** (Supabase → Auth → Settings → Captcha protection) to slow down bot signups.
- [ ] Optional: Configure custom SMTP for production-scale email delivery.

---

## Cost summary

For a small/medium deployment:

| Item | Free tier covers | Paid tier when |
|---|---|---|
| Supabase | 50,000 MAU, 500 MB DB | Beyond 50k users — then $25/mo |
| VPS (Hetzner CX22) | — | $4.50/mo always |
| Domain | — | ~$12/yr |
| **Total** | — | **~$5-6/mo** at small scale |

---

## Where things live (architecture quick-ref)

- **Frontend**: SvelteKit static build, served by nginx in the container. No backend service.
- **Auth**: Supabase (browser-only SDK). Session stored in `localStorage`; refresh tokens auto-rotate.
- **Chat data**: IndexedDB in the user's browser (Dexie). Per-user via `ownerId` column.
- **AI calls**: Browser → user's chosen provider directly (OpenRouter, Anthropic, OpenAI-compat). No proxy. Bring-your-own-key.
- **Auto-deploy**: GitHub push → Dokploy webhook → Docker build → container swap.

That's the entire deploy. No backend servers to maintain. No databases to back up (chat data is client-side; only auth users are in Supabase, and Supabase backs that up daily).
