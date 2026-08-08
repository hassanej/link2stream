#!/usr/bin/env bash
#
# Link2Stream Uploader — brand-new VPS setup.
#
# Installs Node.js 22, ffmpeg and aria2, clones (or updates) the
# repository, installs dependencies, builds, and starts the app.
#
# Usage (as root or a sudo user):
#   curl -fsSL https://raw.githubusercontent.com/hassanej/link2stream/main/apps/uploader/scripts/setup-vps.sh | bash
# or from a local checkout:
#   bash apps/uploader/scripts/setup-vps.sh
#
# Optional environment overrides:
#   REPO_URL=https://github.com/hassanej/link2stream.git
#   APP_DIR=$HOME/link2stream
#   PORT=3000
#   SKIP_SYSTEM_DEPS=1   # skip OS package + Node installation

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/hassanej/link2stream.git}"
APP_DIR="${APP_DIR:-$HOME/link2stream}"
PORT="${PORT:-3000}"
UPLOADER_DIR="$APP_DIR/apps/uploader"

log() { printf '\n==> %s\n' "$*"; }

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then
        SUDO="sudo"
    else
        echo "This script needs root privileges (run as root or install sudo)." >&2
        exit 1
    fi
fi

# ------------------------------------------------------------- packages ---

if [ "${SKIP_SYSTEM_DEPS:-0}" = "1" ]; then
    log "Skipping OS packages and Node installation (SKIP_SYSTEM_DEPS=1)"
else

PM=""
if command -v apt-get >/dev/null 2>&1; then
    PM="apt"
elif command -v dnf >/dev/null 2>&1; then
    PM="dnf"
elif command -v yum >/dev/null 2>&1; then
    PM="yum"
else
    echo "Unsupported distro: apt, dnf or yum required." >&2
    exit 1
fi

log "Installing system packages (git, curl, ffmpeg, aria2) via $PM"

case "$PM" in
    apt)
        $SUDO apt-get update
        $SUDO apt-get install -y git curl ffmpeg aria2
        ;;
    dnf|yum)
        $SUDO "$PM" install -y git curl aria2 || true
        # ffmpeg needs RPM Fusion on RHEL-likes.
        if ! command -v ffmpeg >/dev/null 2>&1; then
            $SUDO "$PM" install -y \
                "https://mirrors.rpmfusion.org/free/el/rpmfusion-free-release-$(rpm -E %rhel).noarch.rpm" || true
            $SUDO "$PM" install -y ffmpeg ffmpeg-free || true
        fi
        ;;
esac

if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "WARNING: ffmpeg was not installed. Encoding will fail until it is." >&2
fi

if ! command -v aria2c >/dev/null 2>&1; then
    echo "WARNING: aria2c was not installed. Downloads will fail until it is." >&2
fi

# ---------------------------------------------------------------- node ---

NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
    NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
fi

if [ "$NODE_MAJOR" -lt 22 ]; then
    log "Installing Node.js 22 (NodeSource)"

    case "$PM" in
        apt)
            curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash -
            $SUDO apt-get install -y nodejs
            ;;
        dnf|yum)
            curl -fsSL https://rpm.nodesource.com/setup_22.x | $SUDO -E bash -
            $SUDO "$PM" install -y nodejs
            ;;
    esac
fi

fi # SKIP_SYSTEM_DEPS

log "Node $(node --version) / npm $(npm --version)"

# ---------------------------------------------------------------- repo ---

if [ -d "$APP_DIR/.git" ]; then
    log "Updating existing checkout in $APP_DIR"
    git -C "$APP_DIR" pull --ff-only
else
    log "Cloning $REPO_URL -> $APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
fi

# ---------------------------------------------------------------- deps ---

log "Installing uploader dependencies"
cd "$UPLOADER_DIR"
npm install

log "Building"
npm run build

# ----------------------------------------------------------------- env ---

if [ ! -f .env ]; then
    cp .env.example .env
    log "Created .env — edit $UPLOADER_DIR/.env and set your R2_* values"
    echo "  (the app starts without them, but uploads/R2 stats will fail)"
fi

# ---------------------------------------------------------------- start ---

mkdir -p storage/logs

PID_FILE="storage/uploader.pid"
LOG_FILE="storage/logs/uploader.log"

log "Starting uploader on port $PORT"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    kill "$(cat "$PID_FILE")" || true
    sleep 1
fi

PORT="$PORT" nohup node dist/backend/main.js \
    >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

sleep 2

if ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Startup failed — last log lines:" >&2
    tail -n 20 "$LOG_FILE" >&2
    exit 1
fi

# Prefer IPv4 for the URL; bracket-wrap IPv6 if that's all we get.
IP="$(curl -4 -fsS --max-time 5 ifconfig.me 2>/dev/null || true)"
if [ -z "$IP" ]; then
    IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi
if [ -z "$IP" ]; then
    IP="localhost"
fi
case "$IP" in
    *:*) IP="[$IP]" ;;
esac

cat <<EOF

Done.

  UI + API:     http://$IP:$PORT/
  Health check: http://$IP:$PORT/health
  Logs:         tail -f $UPLOADER_DIR/storage/logs/uploader.log
  Stop:         kill \$(cat $UPLOADER_DIR/storage/uploader.pid)

Remember:
  1. Set R2_* credentials in $UPLOADER_DIR/.env, then restart:
       kill \$(cat $UPLOADER_DIR/storage/uploader.pid)
       cd $UPLOADER_DIR && PORT=$PORT nohup node dist/backend/main.js >> storage/logs/uploader.log 2>&1 & echo \$! > storage/uploader.pid
  2. Open port $PORT in your firewall, e.g.:
       sudo ufw allow $PORT/tcp     # Debian/Ubuntu
       sudo firewall-cmd --add-port=$PORT/tcp --permanent && sudo firewall-cmd --reload   # Fedora/RHEL
EOF
