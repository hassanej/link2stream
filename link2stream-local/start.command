#!/bin/bash
#
# Link2Stream Local - one-click launcher (macOS).
# Double-click in Finder. First run installs dependencies and
# creates .env; every run starts the server and opens the UI.

cd "$(dirname "$0")" || exit 1

echo "==========================================="
echo "  Link2Stream Local"
echo "==========================================="
echo

# ---- node / npm -----------------------------------------------------------

if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: Node.js is not installed."
    echo "Install it first:  https://nodejs.org/  (v22 or newer)"
    echo "or with Homebrew:  brew install node"
    read -r -p "Press Enter to close..."
    exit 1
fi

echo "Node $(node --version) / npm $(npm --version)"

# ---- ffmpeg ----------------------------------------------------------------

if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "WARNING: ffmpeg not found. Encoding will fail."
    echo "Install with:  brew install ffmpeg"
    echo
fi

# ---- dependencies -----------------------------------------------------------

if [ ! -d node_modules ]; then
    echo
    echo "First run: installing dependencies..."
    npm install || exit 1
fi

# ---- config -----------------------------------------------------------------

if [ ! -f .env ]; then
    cp .env.example .env
    echo
    echo "NOTE: created .env from .env.example."
    echo "The app works without R2 credentials, but uploads will fail"
    echo "until you edit .env and set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID /"
    echo "R2_SECRET_ACCESS_KEY / R2_BUCKET."
    echo
fi

# ---- start -------------------------------------------------------------------

PORT="$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')"
PORT="${PORT:-3100}"
URL="http://127.0.0.1:$PORT"

( 
    # open the browser once the server answers
    for _ in $(seq 1 40); do
        if curl -fsS --max-time 1 "$URL/api/health" >/dev/null 2>&1; then
            open "$URL"
            exit 0
        fi
        sleep 0.5
    done
) &

echo
echo "Drop media files into:  $(pwd)/input"
echo "Opening:               $URL"
echo "Stop with:             Ctrl+C (or close this window)"
echo

npm run start
