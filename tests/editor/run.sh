#!/usr/bin/env bash
# Run the blawg editor tests: serves the worktree on a free port and runs Playwright (Chromium) against it.
#   tests/editor/run.sh            all tests
#   tests/editor/run.sh publish    only tests whose name contains "publish"
#   tests/editor/run.sh --shots    screenshots into ${SHOTS_DIR:-/home/user/shots/editor}
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${PORT:-8790}"
while (echo > /dev/tcp/127.0.0.1/$PORT) 2>/dev/null; do PORT=$((PORT+1)); done
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for i in $(seq 50); do (echo > /dev/tcp/127.0.0.1/$PORT) 2>/dev/null && break; sleep 0.1; done
export BLAWG_BASE="http://127.0.0.1:$PORT"
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
if [ "${1:-}" = "--shots" ]; then node "$ROOT/tests/editor/shots.js"; else node "$ROOT/tests/editor/editor.test.js" "${1:-}"; fi
