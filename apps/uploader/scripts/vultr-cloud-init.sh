#!/usr/bin/env bash
#
# Link2Stream Uploader — Vultr first-boot (startup) script.
#
# How to use:
#   1. Fill in the R2 placeholders below.
#   2. In the Vultr dashboard: Products > Deploy Server > pick an
#      Ubuntu/Debian image > under "Server Settings > Startup Script"
#      add this script (or paste it as cloud-init user data).
#      Vultr runs it once, as root, on first boot.
#   3. Wait a few minutes, then open http://<server-ip>:3000/
#
# Progress is logged to /var/log/link2stream-vps-setup.log

set -euo pipefail
exec > >(tee -a /var/log/link2stream-vps-setup.log) 2>&1

# ======================================================================
# R2 CREDENTIALS — fill these in before deploying
# ======================================================================
R2_ACCOUNT_ID="CHANGE_ME_ACCOUNT_ID"
R2_ACCESS_KEY_ID="CHANGE_ME_ACCESS_KEY_ID"
R2_SECRET_ACCESS_KEY="CHANGE_ME_SECRET_ACCESS_KEY"
R2_BUCKET="CHANGE_ME_BUCKET"
R2_PUBLIC_URL=""          # optional, e.g. https://pub-xxxx.r2.dev

PORT=3000
REPO_URL="https://github.com/hassanej/link2stream.git"
APP_DIR="/opt/link2stream"
# ======================================================================

export DEBIAN_FRONTEND=noninteractive

echo "Link2Stream Vultr setup started: $(date -u +%FT%TZ)"

# ------------------------------------------------------------- network ---

echo "Waiting for network..."
for attempt in $(seq 1 30); do
    if curl -fsS --max-time 5 https://github.com >/dev/null 2>&1; then
        break
    fi
    echo "  attempt $attempt/30: network not ready, retrying in 3s"
    sleep 3
done

# ------------------------------------------------------------- packages ---

apt-get update
apt-get install -y git curl ffmpeg aria2

NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
    NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
fi

if [ "$NODE_MAJOR" -lt 22 ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

echo "Node $(node --version) / npm $(npm --version)"

# ----------------------------------------------------------------- repo ---

if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" pull --ff-only
else
    git clone "$REPO_URL" "$APP_DIR"
fi

# ------------------------------------------------------------------ env ---

UPLOADER_DIR="$APP_DIR/apps/uploader"

cat > "$UPLOADER_DIR/.env" <<EOF
PORT=$PORT
R2_ACCOUNT_ID=$R2_ACCOUNT_ID
R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY
R2_BUCKET=$R2_BUCKET
R2_PUBLIC_URL=$R2_PUBLIC_URL
EOF

chmod 600 "$UPLOADER_DIR/.env"

case "$R2_ACCOUNT_ID$R2_ACCESS_KEY_ID$R2_SECRET_ACCESS_KEY$R2_BUCKET" in
    *CHANGE_ME*)
        echo "WARNING: R2 placeholders were not replaced; uploads will fail."
        echo "         Edit $UPLOADER_DIR/.env and restart the app."
        ;;
esac

# ------------------------------------------------------------------ app ---

# OS packages and Node are done above; let the repo script do the rest.
SKIP_SYSTEM_DEPS=1 APP_DIR="$APP_DIR" PORT="$PORT" \
    bash "$UPLOADER_DIR/scripts/setup-vps.sh"

# --------------------------------------------------------------- firewall ---

if command -v ufw >/dev/null 2>&1; then
    ufw allow "$PORT"/tcp || true
    yes | ufw enable || true
fi

echo "Link2Stream Vultr setup finished: $(date -u +%FT%TZ)"
