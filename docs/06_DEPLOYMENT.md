# CiviLedger — Deployment

Backend, database, and a local blockchain run on **one DigitalOcean droplet** via
Docker Compose. Deploys happen by **pushing to a git remote on the droplet itself**
(a bare repo with a `post-receive` hook). The **frontend** is a static build on
**Cloudflare Pages**.

No domain is required. GitHub (`origin`) stays the source-of-truth remote; there is
no GitHub Actions CI in this setup.

> Every address below is a placeholder. `<DROPLET_IP>` is your droplet's public IP;
> `203-0-113-10.sslip.io` stands in for the dashed-IP hostname. Never put the real IP
> in a tracked file or a commit message.

---

## Topology

```
  Browser
    │  https://civiledger.pages.dev            (Cloudflare Pages, static build)
    │
    │  https://<dashed-ip>.sslip.io            (API calls)
    ▼
  ┌─────────────────────── droplet ───────────────────────┐
  │  caddy  :80/:443   auto-HTTPS (Let's Encrypt)         │
  │    └─> backend :4000   Express API                    │
  │          ├─> postgres        off-chain data (volume)  │
  │          └─> chain :8545     local Hardhat node       │
  │        contracts-deploy      one-shot: deploy + seed  │
  └───────────────────────────────────────────────────────┘
```

---

## What you need

- A DigitalOcean droplet: Ubuntu 22.04+, **2 GB RAM minimum** (image builds need it;
  `setup-droplet.sh` also adds 2 GB swap).
- SSH access to the droplet as `root` for first-time setup.
- An SSH key on your laptop (`ssh-ed25519 …`) for the `deploy` user.
- A Cloudflare account (free) with access to Pages.
- Docker is **not** needed on your laptop.

---

## Part A — Droplet (backend + database + chain)

### 1. Provision (once)

SSH in as root, then:

```bash
git clone https://github.com/ajpalok/CiviLedger.git /tmp/civiledger-bootstrap
bash /tmp/civiledger-bootstrap/deploy/setup-droplet.sh
rm -rf /tmp/civiledger-bootstrap
```

This installs Docker, creates a `deploy` user (in the `docker` group), adds swap,
opens ports 80/443, and initialises the bare repo at `/srv/civiledger.git` with the
deploy hook.

### 2. Add your SSH key for the `deploy` user

```bash
echo "ssh-ed25519 AAAA... you@laptop" >> /home/deploy/.ssh/authorized_keys
```

### 3. Add the deploy remote (on your laptop)

```bash
git remote add production ssh://deploy@<DROPLET_IP>/srv/civiledger.git
```

`git remote -v` should now list `origin` (GitHub) and `production` (the droplet).

### 4. First push

```bash
git push production main
```

It checks out the code and then **stops** with:

```
!! /srv/civiledger/deploy/.env.production is missing.
```

That is expected on the first push.

### 5. Fill in the production env (on the droplet, as `deploy`)

```bash
sudo -iu deploy
cd /srv/civiledger/deploy
cp .env.production.example .env.production
nano .env.production
```

| Variable | Value |
|---|---|
| `PUBLIC_HOSTNAME` | Your droplet IP with dashes + `.sslip.io`, e.g. `203-0-113-10.sslip.io` |
| `ACME_EMAIL` | Your email (Let's Encrypt expiry notices) |
| `FRONTEND_URL` | The Cloudflare Pages URL (fill after Part B; use `https://civiledger.pages.dev` for now) |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `DB_PASSWORD` | `openssl rand -hex 24` |
| `SEED_ON_START` | `true` for the demo dataset on first boot |
| `DERIVE_LOCAL_KEYS` | `true` (local chain; keys auto-derive from the standard Hardhat mnemonic) |

Leave the Amoy block commented out unless you are switching the chain (see below).

### 6. Push again

```bash
# on your laptop
git push production main
```

The hook now runs `docker compose … up -d --build`. First build takes a few minutes.

### 7. Verify

```bash
curl https://203-0-113-10.sslip.io/health
# {"status":"ok","uptime":…}
```

If the cert is still provisioning, retry after a minute, or check
`./manage.sh logs caddy`.

---

## Part B — Frontend (Cloudflare Pages)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick `ajpalok/CiviLedger`.
2. Build settings:
   - **Framework preset:** None (or Vite)
   - **Root directory:** `frontend`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. **Environment variables** (Production):
   - `VITE_API_BASE_URL` = `https://203-0-113-10.sslip.io`
   - `VITE_EXPLORER_BASE_URL` = *(empty for the local chain)*
4. **Save and Deploy.** Note the assigned URL, e.g. `https://civiledger.pages.dev`.

`frontend/public/_redirects` (`/* /index.html 200`) is committed so React Router deep
links resolve on Pages.

---

## Part C — Wire the two together

Set `FRONTEND_URL` on the droplet to the real Pages URL, then redeploy:

```bash
# on the droplet, as deploy
cd /srv/civiledger/deploy
nano .env.production          # FRONTEND_URL=https://civiledger.pages.dev
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

`FRONTEND_URL` drives both `CORS_ORIGIN` (the API only accepts that origin) and
`APP_BASE_URL` (the base of the share/QR links the API generates).

Test end to end: open the Pages URL, log in, and confirm no CORS errors in the
browser console.

---

## Everyday deploys

```bash
git push production main
```

The hook checks out `main`, rebuilds changed images, recreates changed containers,
and prunes old images. Pushing any other branch is ignored. GitHub pushes
(`git push origin …`) do nothing to the droplet.

The deploy hook keeps itself up to date: edits to `deploy/hooks/post-receive` take
effect on the **next** push after the one that delivered them.

---

## Why HTTPS on the backend (mixed content)

Cloudflare Pages serves the frontend over HTTPS. A browser on an HTTPS page **cannot**
call `http://<IP>:4000` — it is blocked as mixed content. That is why the stack runs
**Caddy** with an **sslip.io** hostname: `203-0-113-10.sslip.io` resolves to the
droplet IP, so Let's Encrypt issues a real certificate with no domain purchase, and
the frontend calls `https://203-0-113-10.sslip.io`.

If you genuinely want the raw `http://<IP>:4000` path (e.g. serving the frontend over
HTTP too, not on Pages): set `BACKEND_BIND=0.0.0.0` in `.env.production`, point
`VITE_API_BASE_URL` at `http://<DROPLET_IP>:4000`, and you can drop the `caddy`
service. Not recommended.

---

## Switching the chain to Polygon Amoy (durable anchors)

The bundled local Hardhat chain is **ephemeral**: a droplet reboot wipes on-chain
state, and credentials already in Postgres then point at anchors that no longer
exist. For anything that must survive, use Amoy (free, public explorer).

1. In `docker-compose.prod.yml`, comment out the `chain` and `contracts-deploy`
   services and the backend's `depends_on: contracts-deploy`.
2. From a machine with a funded Amoy key, deploy once:
   ```bash
   cd contracts
   AMOY_RPC_URL=… DEPLOYER_PRIVATE_KEY=… npx hardhat run scripts/deploy.js --network amoy
   npx hardhat run scripts/seed-demo-data.js --network amoy
   ```
3. Copy `contracts/deployments/amoy.json` and `backend/src/contracts-abi/*.json` onto
   the droplet into a directory you mount at `/chain` (or bake them into the backend
   image).
4. In `.env.production`:
   ```
   BLOCKCHAIN_RPC_URL=https://rpc-amoy.polygon.technology
   BLOCKCHAIN_NETWORK=amoy
   DEPLOYMENTS_FILE=/chain/deployments/amoy.json
   CONTRACTS_ABI_DIR=/chain/abi
   DERIVE_LOCAL_KEYS=false
   ADMIN_PRIVATE_KEY=…            # real funded keys, one per authority
   IDENTITY_AUTHORITY_PRIVATE_KEY=…
   EDUCATION_AUTHORITY_PRIVATE_KEY=…
   TRANSPORT_AUTHORITY_PRIVATE_KEY=…
   ```
5. Set `VITE_EXPLORER_BASE_URL=https://amoy.polygonscan.com` on Cloudflare Pages.
6. `git push production main`.

---

## Operations

From `/srv/civiledger/deploy` as the `deploy` user:

```bash
./manage.sh ps                 # container status
./manage.sh logs backend       # tail a service (omit name for all)
./manage.sh restart backend    # recreate a service
./manage.sh migrate            # run DB migrations now
./manage.sh reseed             # re-run seeders (applied ones are skipped)
./manage.sh redeploy-chain     # wipe local chain + addresses, redeploy contracts
./manage.sh nuke               # stop everything and DELETE all data volumes
```

### After a droplet reboot (local chain only)

The chain restarts empty. Recover with:

```bash
cd /srv/civiledger/deploy
./manage.sh redeploy-chain
./manage.sh nuke && git push production main   # if the DB also needs a clean slate
```

For a demo, re-seed shortly before you present rather than relying on old data.

---

## Security notes and follow-ups

- `deploy/.env.production` is git-ignored. Keep it that way. Real secrets live only on
  the droplet and in the Cloudflare dashboard.
- `helmet` is enabled and CORS is locked to `FRONTEND_URL`.
- **Not done yet:** rate limiting on `/auth`, and real signature verification on
  `POST /auth/wallet-login` (it currently trusts the wallet address). See
  `improvement_plan.md` 3.5. Add these before treating this as more than a pilot.
- Rotate `JWT_SECRET` if it is ever exposed (invalidates all sessions).
- The four `*_PRIVATE_KEY` values for the local chain are the **public** Hardhat test
  keys. They are worthless off a local chain. Never reuse them on Amoy or mainnet.
