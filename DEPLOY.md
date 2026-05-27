# Deploying Cryptex

Cryptex is a single-container static site. Four tested targets:

0. **[Pull from GHCR (fastest)](#0-pull-from-ghcr-fastest)** — one `docker run`, zero build.
1. **[Dokploy on a VPS](#1-dokploy-on-hostinger-or-any-vps)** — recommended for self-hosters with a custom domain + Let's Encrypt.
2. **[Plain Docker](#2-plain-docker)** — anywhere with Docker.
3. **[GitHub Pages](#3-github-pages)** — for forks of this repo.

---

## 0. Pull from GHCR (fastest)

The prebuilt multi-arch image (`linux/amd64` + `linux/arm64`) is published to GHCR on every push to `main` and every `v*.*.*` tag. Use it straight from `docker run`:

```bash
docker run -d --name cryptex --restart unless-stopped \
  -p 8080:80 ghcr.io/m4xx101/cryptex-oss:latest
```

Open <http://localhost:8080>. That's the entire install. No clone, no build.

**Updates**:
```bash
docker pull ghcr.io/m4xx101/cryptex-oss:latest
docker stop cryptex && docker rm cryptex
docker run -d --name cryptex --restart unless-stopped \
  -p 8080:80 ghcr.io/m4xx101/cryptex-oss:latest
```

**Pin to a release** instead of `:latest`:
```bash
docker run -d --name cryptex --restart unless-stopped \
  -p 8080:80 ghcr.io/m4xx101/cryptex-oss:v2.0.0
```

Available tag patterns: `:latest`, `:vX.Y.Z` (exact release), `:vX.Y`, `:vX`, `:main`, `:sha-<short>`.

**Compose** (drop-in replacement for `docker-compose.yml`):
```yaml
services:
  cryptex:
    image: ghcr.io/m4xx101/cryptex-oss:latest
    container_name: cryptex
    restart: unless-stopped
    ports:
      - "8080:80"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

Put a reverse proxy (nginx, Caddy, Traefik) in front for TLS, or skip ahead to the Dokploy section for an automated Let's Encrypt path.

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
| `TZ` | `UTC` or `Asia/Kolkata`, etc. | Container log timezone. |

> **`BASE_PATH` is build-time** — Vite inlines it into the static bundle. Changing it requires a full **Rebuild** in Dokploy, not just restart. `DOMAIN` and `TZ` are runtime; they take effect on Restart.

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

---

## 2. Plain Docker

The committed `docker-compose.yml` is **Dokploy-first** — it joins the external `dokploy-network` so Traefik can route to it. For a standalone Docker host (no Dokploy), the easiest path is the GHCR pull from [Section 0](#0-pull-from-ghcr-fastest). To build from source instead (custom changes, fork, etc.):

```bash
git clone https://github.com/m4xx101/cryptex-oss.git
cd cryptex-oss

# Build (pass build args inline — these bake into the static bundle)
docker build \
  --build-arg BASE_PATH="" \
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
docker build --build-arg BASE_PATH="/cryptex" -t cryptex:latest .
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
   - Runs app unit tests (`npm run test:unit`)
   - Runs `svelte-check`
   - Builds with `BASE_PATH` derived from your repo name
   - Publishes `app/build/` to Pages.

Pages URL: `https://<your-handle>.github.io/<repo-name>/`.

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

### GitHub Pages shows blank page

Check repo **Settings → Pages** — Source must be **GitHub Actions**, not a branch. The workflow needs `pages: write` permission (already set in the provided workflow).

---

## Configuration reference

| Variable | When | Default | Notes |
|---|---|---|---|
| `BASE_PATH` | Build-time | `""` | Subpath (e.g. `/cryptex`). Empty for root. |
| `DOMAIN` | Deploy-time (Dokploy) | `cryptex.localhost` | Hostname for Traefik routing + Let's Encrypt. Dokploy path only. |
| `TZ` | Runtime | `UTC` | Container log timezone. |
| `CRYPTEX_PORT` | Runtime | `8080` | Host-side port (standalone only). |

All other app state is client-side: BYOK provider keys live in `localStorage` on the visitor's machine, never on the server.

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

### Image / PDF / WASM CSP requirements

**`img-src 'self' data: blob:`** — required for two reasons:
- Image upload thumbnails rendered from `FileReader.readAsDataURL()` produce `data:` URIs (used by `/redteam/ocr-injection`, `/redteam/markdown-exfil`, vault preview cards).
- Multimodal image attachments passed to vision-capable LLMs are sent as `data:` base64 strings.

**`script-src … 'wasm-unsafe-eval'`** — required by `pdfjs-dist`, lazy-loaded when the user attaches a PDF (used by `/redteam/pdf-injection`). The PDF.js worker uses WebAssembly internally. Without this directive the worker fails silently and PDF text extraction returns empty.

**`connect-src`** — every provider Cryptex calls (OpenRouter, Anthropic, Groq, Together, Fireworks, DeepInfra, Cerebras, SambaNova) is allow-listed above. Custom OpenAI-compatible endpoints users configure in Settings must be added manually; see [`docs/CUSTOM-ENDPOINTS.md`](docs/CUSTOM-ENDPOINTS.md).

Add extra headers via Traefik middleware if you are terminating TLS at Traefik instead of serving directly from nginx.
