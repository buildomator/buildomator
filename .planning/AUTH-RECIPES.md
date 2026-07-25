# Auth Recipes

How this project authenticates to external systems. Replay these recipes when setting up a fresh dev environment or after credential rotation.

## buildomator.com-deploy

**Auth method:** SSH key-based access to the deploy box, plus passwordless `sudo` for `jnuyens`. Reached through the `m1` SSH-config alias. NOTE: despite the "m1" name, the box is `www.linuxbe.com` (Ubuntu 24.04, x86_64), not an Apple Silicon M1.

**Setup commands:**

```bash
# Connect (key auth already configured; no password). Both work, same box:
ssh m1                 # ~/.ssh/config alias (has proxy hops), lands on www.linuxbe.com
ssh m1.linuxbe.com     # also resolves to the same host

# The site is a git-driven hourly deploy on that box:
#   source checkout: /var/www/buildomator.com/source   (git: buildomator/buildomator.com, branch main)
#   docroot:         /var/www/buildomator.com/current  (owned www-data; served by Caddy-in-containers since 2026-07-25, was nginx)
#   deploy log:      /var/www/buildomator.com/deploy.log
#   cron (jnuyens):  0 * * * * /var/www/buildomator.com/source/rebuild-buildomator.sh
# rebuild-buildomator.sh is tracked in the buildomator.com repo. It hard-syncs
# origin/main, runs npm install, npm run build, and publishes dist/ to current/
# ONLY on a successful build. So committed == what runs; push to main and it goes
# live within the hour. Force a deploy now:
ssh m1 /var/www/buildomator.com/source/rebuild-buildomator.sh
```

**Credentials location:**
- `~/.ssh/config` (the `Host m1` alias) and the SSH private key it uses. No secrets are stored in this recipe.

**Verification:**

```bash
ssh -o BatchMode=yes m1 'hostname; whoami; uname -m'   # -> www.linuxbe.com  jnuyens  x86_64
ssh -o BatchMode=yes m1 'sudo -n true && echo passwordless-sudo-ok'
grep -o 'v[0-9]\.[0-9]\.[0-9]' <(curl -s https://buildomator.com/) | head -1   # live version
```

**Notes:**
- Two ownership gotchas that silently break the hourly deploy (both fixed 2026-07-23): `source/.git` must be owned by `jnuyens`, not `www-data`, or `git pull` fails with "dubious ownership"; and `deploy.log` must be writable by `jnuyens` (cron runs as `jnuyens`).
- The site build fetches the latest Buildomator GitHub release at build time, which is why the hourly rebuild exists (to refresh the version shown on the site).
- The passwordless `sudo` is used by the deploy to write into the docroot.

**2026-07-25 update: the webserver moved from nginx to Caddy running in Docker containers** (the `caddy-sites` compose stack, with Cloudflare in front) to improve security; nginx is retired (inactive). The site still serves (verified 2026-07-25: buildomator.com returns HTTP 200, v4.3.0, with v4.3.1 due on the next hourly rebuild). CAVEAT: the deploy flow also looks re-architected in that migration. A `deploy-webhook.php` and a root-owned `rebuild-buildomator.sh` reappeared at `/var/www/buildomator.com/` (the loose path removed on 2026-07-23), alongside the `caddy-sites` containers. So the cron + `source/rebuild-buildomator.sh` + `www-data`-chown flow documented above is likely SUPERSEDED and should be re-mapped against the new Caddy/webhook setup before relying on it.

**Captured:** 2026-07-22 23:34 UTC. **Updated:** 2026-07-25 (nginx -> Caddy-in-containers).
