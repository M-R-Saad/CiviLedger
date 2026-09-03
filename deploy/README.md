# deploy/

Single-droplet production deployment for the CiviLedger backend, database, and a
local blockchain. The frontend deploys separately to Cloudflare Pages.

| File | Purpose |
|---|---|
| `docker-compose.prod.yml` | The stack: caddy → backend → postgres + chain |
| `Caddyfile` | Auto-HTTPS reverse proxy (sslip.io hostname, no domain needed) |
| `.env.production.example` | Copy to `.env.production` on the droplet and fill in. Never commit the real one. |
| `setup-droplet.sh` | One-time provisioning (Docker, deploy user, bare git repo, swap, firewall) |
| `hooks/post-receive` | Git hook that builds + deploys on every push to `production` |
| `manage.sh` | Ops shortcuts (logs, restart, reseed, nuke) |

**Full runbook: [`../docs/06_DEPLOYMENT.md`](../docs/06_DEPLOYMENT.md).**

Deploy after the first-time setup is just:

```bash
git push production main
```
