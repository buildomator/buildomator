# Auth Recipes

How this project authenticates to external systems. Replay these recipes when setting up a fresh dev environment or after credential rotation.

## buildomator.com-deploy

Re-mapped 2026-07-25 against the live box after the nginx -> Caddy-in-containers migration.

**Access:** SSH key-based, plus passwordless `sudo` for `jnuyens`. Reached through the `m1` SSH-config alias. NOTE: despite the "m1" name, the box is `www.linuxbe.com` (Ubuntu 24.04, x86_64), not an Apple Silicon M1.

```bash
ssh m1                 # ~/.ssh/config alias (proxy hops), lands on www.linuxbe.com
ssh m1.linuxbe.com     # same host
ssh -o BatchMode=yes m1 'hostname; whoami; uname -m'      # -> www.linuxbe.com jnuyens x86_64
ssh -o BatchMode=yes m1 'sudo -n true && echo sudo-ok'
```

**Serving architecture (Caddy in Docker, since 2026-07-25; nginx retired):**

- Edge: **Cloudflare** in front (origin responses show `server: cloudflare`).
- **Main Caddy container** `caddy-sites-caddy-1` terminates TLS and routes. The `buildomator.com` block in `/home/jnuyens/caddy-sites/Caddyfile` is:
  ```
  buildomator.com, www.buildomator.com {
    import security_headers
    tls /certs/cloudflare-origin-buildomator.pem /certs/cloudflare-origin-buildomator.key
    reverse_proxy site-buildomator-com:8080
  }
  ```
- **Per-site static container** `site-buildomator-com` (a Caddy static image, `*static-defaults`) serves the built site on :8080. It mounts, read-only:
  - `internal-caddyfiles/static.Caddyfile` -> `/etc/caddy/Caddyfile`
  - `/var/www/buildomator.com/current` -> `/srv`
- **Compose stack:** `/home/jnuyens/caddy-sites/` (`docker-compose.yml`, `Caddyfile`, `internal-caddyfiles/`, `certs/`, `dockerfiles/`), managed by `jnuyens`. Watchtower auto-updates images; `rebuild-php-images.sh` runs daily (04:30) for the PHP sibling sites (not needed for the static buildomator site).

So the request path is: Cloudflare -> `caddy-sites-caddy-1` -> `site-buildomator-com:8080` -> files under `/var/www/buildomator.com/current`.

**Build and publish (how `current/` gets its content):** there are currently TWO mechanisms, and they conflict (see KNOWN ISSUES).

1. **Webhook (event-driven, the intended new path):** GitHub push/release -> `/var/www/buildomator.com/deploy-webhook.php` (verifies an HMAC-SHA256 signature against `/var/www/buildomator.com/.webhook-secret`) -> runs `sudo -n -u jnuyens /var/www/buildomator.com/deploy.sh`. `deploy.sh` does: `git fetch` + `git reset --hard origin/main` in `source/`, `npm ci`, `npm run build`, writes a timestamped `releases/<ts>/`, atomically repoints `current` via `ln -sfn releases/<ts> current`, and prunes to the last 5 releases. Clean atomic-symlink deploy (uses node v22 from nvm).
2. **Cron (hourly, currently the ACTIVE deployer):** `0 * * * * /var/www/buildomator.com/rebuild-buildomator.sh >> /var/www/buildomator.com/deploy.log 2>&1 || echo "buildomator hourly rebuild failed; see .../deploy.log"` (root-owned loose file). It does `git pull`, `npm run build` (NO `npm ci`), then `sudo rm -rf current/*` + `cp dist/* current/` + `chown -R www-data current`. This makes `current` a real directory. As of 2026-07-25 the cron line redirects all output to `deploy.log` and emails only on a non-zero exit, so successful/no-op runs no longer mail "Already up to date." CAVEAT: the script swallows build failures (`npm run build ... || true`), so a broken build still exits 0 and does NOT trigger the failure email; reliable build-failure alerting needs the script's error handling restored (see KNOWN ISSUES).

**Credentials / secrets (noted, not stored here):**
- `~/.ssh/config` (`Host m1` alias) + its SSH private key.
- `/var/www/buildomator.com/.webhook-secret` (GitHub webhook HMAC secret).
- `/home/jnuyens/caddy-sites/certs/cloudflare-origin-buildomator.{pem,key}` (Cloudflare Origin CA cert).

**Verification:**
```bash
curl -sI https://buildomator.com/ | grep -iE '^HTTP|^server'          # HTTP/2 200, server: cloudflare
curl -s https://buildomator.com/ | grep -o 'v[0-9]\.[0-9]\.[0-9]' | head -1   # live version
ssh -o BatchMode=yes m1 'sudo -n docker ps --format "{{.Names}}" | grep -E "caddy-sites-caddy|site-buildomator"'
ssh -o BatchMode=yes m1 'ls -ld /var/www/buildomator.com/current; readlink /var/www/buildomator.com/current'   # symlink (deploy.sh) vs real dir (cron)
```

**KNOWN ISSUES (as of 2026-07-25 re-map, NOT yet fixed):**
- **Two deployers race over `current/`.** `deploy.sh` treats `current` as a symlink into `releases/<ts>`; the hourly `rebuild-buildomator.sh` treats it as a real directory (`rm -rf` + `cp`). They clobber each other. Right now the cron is winning: `current` is a real dir (last written on the hour) and `releases/` is frozen at 2026-07-01, so the webhook/atomic-symlink model is effectively overridden.
- **The active hourly script is a regressed, pre-4.2.1 version.** It is root-owned at the loose `/var/www/buildomator.com/` path (not the repo-tracked `source/` copy), and it dropped the two fixes made on 2026-07-23: it runs `npm run build` with NO `npm ci` (a new or changed dependency will not install, the exact class of failure that once froze the site), and it has no build-success guard before `rm -rf current/*` (a failed build wipes the docroot and publishes empty/stale output).
- Suggested consolidation (not done, this was a read-only re-map): pick ONE deployer. Preferred: keep the webhook `deploy.sh` (atomic `releases/` + `npm ci`) and retire the hourly cron; or, if the hourly refresh is wanted (the build fetches the latest GitHub release to show the version on the site), restore `npm ci` + the build-success guard to it and track it in the repo. Either way, don't run both against `current`.

Historical (nginx era, superseded): the 2026-07-23 fixes fixed `source/.git` dubious-ownership and `deploy.log` write permission for a cron that ran `source/rebuild-buildomator.sh`. That cron now runs the loose root-owned script instead.

**Captured:** 2026-07-22. **Re-mapped:** 2026-07-25 (Caddy-in-containers architecture + dual-deployer conflict documented).
