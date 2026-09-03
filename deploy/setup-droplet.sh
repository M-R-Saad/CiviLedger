#!/usr/bin/env bash
# One-time droplet provisioning. Run as root on a fresh Ubuntu 22.04+ droplet:
#
#   git clone https://github.com/ajpalok/CiviLedger.git /tmp/civiledger-bootstrap
#   bash /tmp/civiledger-bootstrap/deploy/setup-droplet.sh
#   rm -rf /tmp/civiledger-bootstrap
#
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="/srv/civiledger"
BARE_REPO="/srv/civiledger.git"
HERE="$(cd "$(dirname "$0")" && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "Run as root."; exit 1; }

echo "==> Installing Docker Engine + Compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "==> Creating deploy user: $DEPLOY_USER"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"

echo "==> Adding 2G swap (image builds on 1-2G droplets otherwise OOM)"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Initialising bare repo: $BARE_REPO"
mkdir -p "$BARE_REPO" "$APP_DIR"
git init --bare -b main "$BARE_REPO"
install -m 755 "$HERE/hooks/post-receive" "$BARE_REPO/hooks/post-receive"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$BARE_REPO" "$APP_DIR"

echo "==> Firewall (ufw): SSH + 80 + 443"
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  yes | ufw enable >/dev/null || true
fi

cat <<EOF

────────────────────────────────────────────────────────────────────────────
Droplet ready. Next steps (see docs/06_DEPLOYMENT.md):

1. Add your laptop's SSH public key:
     echo "ssh-ed25519 AAAA... you@laptop" >> /home/$DEPLOY_USER/.ssh/authorized_keys

2. On your laptop, add the deploy remote (replace with this droplet's IP):
     git remote add production ssh://$DEPLOY_USER@<DROPLET_IP>/srv/civiledger.git

3. First push (it will stop and ask for the env file):
     git push production main

4. Back on the droplet, as $DEPLOY_USER:
     cp $APP_DIR/deploy/.env.production.example $APP_DIR/deploy/.env.production
     \$EDITOR $APP_DIR/deploy/.env.production

5. Push again -> full build + deploy:
     git push production main

6. Verify:
     curl https://<PUBLIC_HOSTNAME>/health
────────────────────────────────────────────────────────────────────────────
EOF
