# Deploying Cryptex

Cryptex is a single-container static site. Three tested targets:

1. **[Dokploy on a VPS](#1-dokploy-on-hostinger-or-any-vps)** — recommended for self-hosters.
2. **[Plain Docker](#2-plain-docker)** — anywhere with Docker.
3. **[GitHub Pages](#3-github-pages)** — for forks of this repo.

---

## 1. Dokploy (on Hostinger or any VPS)

Dokploy is an open-source PaaS that builds from your GitHub repo, handles Traefik routing, and provisions Let's Encrypt certs automatically. This is the path we optimize for.

### 1.1. Install Dokploy on the VPS

SSH to your Hostinger / Contabo / whatever VPS as root, then:

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

The installer sets up Docker + Traefik + the Dokploy dashboard. After it finishes, open `http://<your-server-ip>:3000` and complete the first-run admin setup (email, password, organization name).

### 1.2. Point your DNS at the VPS

Create an `A` record for the domain you want (e.g. `cryptex.your-domain.com`) pointing at the VPS public IP. Give DNS ~2 minutes to propagate.

**If your DNS is on Cloudflare:** leave the proxy **off** (grey cloud / DNS-only) for the first deploy. Let's Encrypt uses an HTTP-01 challenge that needs to reach *your* VPS, not Cloudflare's edge. Orange-cloud proxying intercepts the challenge and silently breaks cert issuance. Once the cert is issued, you can re-enable the proxy (see Cloudflare section below).

Verify DNS points at your VPS, not Cloudflare:
```bash
dig +short cryptex.your-domain.com
# Must return YOUR VPS IP.
# If you see 104.x.x.x or 172.67.x.x it's still Cloudflare-proxied.
```

### 1.3. Add Cryptex as a Dokploy application

1. Dokploy dashboard → **Create Application**.
2. **Source**: GitHub → pick your Cryptex fork, branch `master`.
3. **Build Type**: Docker Compose (auto-detected from `docker-compose.yml`).
4. **DO NOT add an entry in the Domains tab.** The compose file handles all
   Traefik routing + Let's Encrypt via labels — adding a Domain entry in the
   UI causes label collisions and silently breaks cert issuance. You set the
   domain via the `DOMAIN` env var below.

### 1.4. Set environment variables

Under the application's **Environment** tab:

| Variable | Value | Purpose |
|---|---|---|
| **`DOMAIN`** | `cryptex.your-domain.com` | **Required for HTTPS.** Traefik routes this host + Let's Encrypt issues a cert for it. |
| `BASE_PATH` | *(leave empty)* | Set to `/cryptex` if serving at a subpath. |
| `PUBLIC_ADSENSE_CLIENT` | `ca-pub-XXXXXXXXXXXXXXXX` | Optional. Omit to disable ads entirely. |
| `TZ` | `UTC` or `Asia/Kolkata`, etc. | Container log timezone. |

> **`DOMAIN` + `PUBLIC_ADSENSE_CLIENT` are build-time** — Vite inlines them into the static bundle. Changing either requires a full **Rebuild** in Dokploy, not just restart.

### 1.5. First deploy

Hit **Deploy**. First build takes ~2-3 minutes. The webhook Dokploy registers in your GitHub repo auto-deploys on subsequent pushes.

During deploy Traefik:
1. Picks up the Host rule from the compose labels.
2. Opens port 80 to serve the Let's Encrypt HTTP-01 challenge.
3. Issues a cert (takes ~15-45 seconds after first successful deploy).
4. Redirects all HTTP → HTTPS permanently.

When done, `https://cryptex.your-domain.com` serves with a valid Let's Encrypt cert.

### 1.7. Verify

```bash
# Healthcheck (used by Docker + Traefik)
curl https://cryptex.your-domain.com/health
# → "ok"

# Tool route
curl -sI https://cryptex.your-domain.com/transforms/ | head -1
# → HTTP/2 200
```

### 1.8. AdSense approval flow

If you set `PUBLIC_ADSENSE_CLIENT`:

1. Sign into https://adsense.google.com and add `cryptex.your-domain.com` as a site.
2. Google reviews your site (days to weeks). During review, ads don't render — but the consent banner and `<ins>` placeholders are in the DOM.
3. Once approved, ads appear on `/guide/*` and `/about/*` only. Tool pages stay ad-free regardless of consent.
4. Visitors see the consent banner once; **Accept** loads the AdSense script, **Reject** keeps the page script-free for that visitor.

---

## 2. Plain Docker

The committed `docker-compose.yml` is **Dokploy-first** — it joins the external `dokploy-network` so Traefik can route to it. For a standalone Docker host (no Dokploy), use plain `docker build` + `docker run`:

```bash
git clone https://github.com/m4xx101/cryptex.git
cd cryptex

# Build (pass build args inline — these bake into the static bundle)
docker build \
  --build-arg BASE_PATH="" \
  --build-arg PUBLIC_ADSENSE_CLIENT="" \
  -t cryptex:latest .

# Run
docker run -d \
  --name cryptex \
  --restart unless-stopped \
  -p 8080:80 \
  -e TZ=UTC \
  cryptex:latest
```

Cryptex serves on `http://localhost:8080`. Put a reverse proxy (nginx, Caddy, Traefik) in front for TLS.

### Rebuild after env change

```bash
docker stop cryptex && docker rm cryptex
docker build --build-arg PUBLIC_ADSENSE_CLIENT="ca-pub-…" -t cryptex:latest .
docker run -d --name cryptex --restart unless-stopped -p 8080:80 cryptex:latest
```

### View logs

```bash
docker logs -f cryptex
```

### Stop

```bash
docker stop cryptex && docker rm cryptex
```

---

## 3. GitHub Pages

The workflow at `.github/workflows/deploy.yml` publishes `app/build/` to Pages on every push to `main`/`master`.

1. Fork this repo.
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. Push a commit. The workflow:
   - Runs legacy transformer tests (`npm run test:all`)
   - Runs app unit tests (`npm run test:unit`)
   - Runs `svelte-check`
   - Builds with `BASE_PATH` derived from your repo name
   - Publishes `app/build/` to Pages.

Pages URL: `https://<your-handle>.github.io/<repo-name>/`.

> GitHub Pages **cannot set `PUBLIC_ADSENSE_CLIENT`** without exposing the value in the public workflow. For ads, use Dokploy or plain Docker.

---

## Upgrading

Cryptex follows semantic versioning on the image tag. To pin:

```yaml
# In docker-compose.yaml
services:
  cryptex:
    image: cryptex:v1.2.3  # instead of :latest
```

On Dokploy: click **Pull new image + Redeploy** after each push to `main`.

---

## Troubleshooting

### "Connection is not secure" / self-signed cert / wrong cert served

This is almost always one of three things. In order of likelihood:

**1. `DOMAIN` env var isn't set or doesn't match the hostname you're visiting.**

Dokploy → Environment tab → confirm `DOMAIN=cryptex.your-domain.com` (exactly matching the URL you hit in the browser). After changing, click **Rebuild** (not just Restart) because `DOMAIN` is used in Traefik labels that are evaluated at deploy time.

**2. You ALSO added a Domain entry in Dokploy's Domains UI tab.**

This is the silent killer. Dokploy's UI domain config injects its own Traefik router labels, which collide with the labels already in `docker-compose.yml`. The cert resolver attaches to one router, traffic goes through the other, you get the Traefik default self-signed cert. **Delete the Domain entry from the UI**; keep only the `DOMAIN` env var.

**3. DNS hasn't propagated yet → Let's Encrypt HTTP-01 challenge failed → Traefik serves its default self-signed cert as fallback.**

```bash
# On any machine:
dig +short cryptex.your-domain.com
# must return your VPS public IP

# On the VPS:
docker logs dokploy-traefik 2>&1 | grep -Ei "acme|certificate|cryptex" | tail -30
# Look for "unable to generate a certificate" or "ACME challenge failed"
```

Fix: wait for DNS, then force cert re-issuance by restarting Traefik:
```bash
docker restart dokploy-traefik
```

**Verify it's actually fixed:**
```bash
curl -vI https://cryptex.your-domain.com/health 2>&1 | grep -E "(issuer|subject)"
# issuer:  C=US, O=Let's Encrypt, CN=R3        ← this is what you want
# subject: CN=cryptex.your-domain.com
```
If you see `issuer: CN=TRAEFIK DEFAULT CERT` instead, cert issuance failed — go back to step 1.

### Health check failing

```bash
docker exec $(docker ps -qf name=cryptex) wget -qO- http://127.0.0.1/health
# Should return: ok
```

If this fails inside the container, the build likely didn't produce `app/build/index.html`. Inspect build logs; the most common cause is a missing `PUBLIC_*` env var the app code expects.

### CSP blocks something

Open the browser DevTools console. CSP violations show as `Refused to load …`. Edit `nginx.conf`'s `Content-Security-Policy` header and redeploy.

### Ads don't appear after Google approval

1. Visit `/settings` → check **Ad consent** = `accepted`.
2. DevTools → Network → refresh → look for `adsbygoogle.js` loading. If absent, AdSense wasn't configured at build time — rebuild with `PUBLIC_ADSENSE_CLIENT` set.
3. Visit `/guide/` — ads only render on content routes, never on tool routes.
4. Google AdSense takes ~30 minutes after approval before ads actually serve inventory.

### GitHub Pages shows blank page

Check repo **Settings → Pages** — Source must be **GitHub Actions**, not a branch. The workflow needs `pages: write` permission (already set in the provided workflow).

---

## Configuration reference

| Variable | When | Default | Notes |
|---|---|---|---|
| `BASE_PATH` | Build-time | `""` | Subpath. Empty for root. |
| `PUBLIC_ADSENSE_CLIENT` | Build-time | *(unset)* | `ca-pub-…` for ads. |
| `TZ` | Runtime | `UTC` | Log timezone. |
| `CRYPTEX_PORT` | Runtime | `8080` | Host-side port (standalone only). |

All other app state is client-side: OpenRouter key lives in `localStorage` on the visitor's machine, never on the server.

---

## Content Security Policy

Cryptex ships CSP as a response header via nginx (see `nginx.conf`). Minimum
policy covering the multi-provider gateway and chat playground:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
font-src 'self' data:;
connect-src 'self'
  https://openrouter.ai
  https://api.anthropic.com
  https://api.groq.com
  https://api.together.xyz
  https://api.fireworks.ai
  https://api.deepinfra.com
  https://api.cerebras.ai
  https://api.sambanova.ai;
img-src 'self' data: blob: https:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
```

### Chat playground CSP notes

**`img-src 'self' data: blob:`** — required for two chat-specific reasons:
- Attachment thumbnails rendered from `FileReader.readAsDataURL()` produce `data:` URIs
- Multimodal image content parts passed to vision-capable LLMs are sent as `data:` base64 strings; the `<img>` preview in the message bubble uses the same URI

**`script-src … 'wasm-unsafe-eval'`** — required by `pdfjs-dist`, which is
lazy-loaded when the user attaches a PDF. The PDF.js worker uses WebAssembly
internally. Without this directive the worker fails silently and PDF text
extraction returns empty.

**No new `connect-src` hosts** — the chat playground only calls providers
already listed above via the multi-provider gateway. Custom OpenAI-compatible
endpoints users configure in Settings must be added manually; see
`docs/CUSTOM-ENDPOINTS.md`.

Add extra headers via Traefik middleware if you are terminating TLS at Traefik
instead of serving directly from nginx.
