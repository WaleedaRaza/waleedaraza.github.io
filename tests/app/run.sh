#!/bin/bash
# Run the blawg board checks: bash tests/app/run.sh [shotdir]
set -e
cd "$(dirname "$0")/../.."
PORT=${PORT:-8770}
python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV' EXIT
sleep 1
node tests/app/board.js "http://127.0.0.1:$PORT/blawg/" "${1:-}"
node tests/app/layout.js "http://127.0.0.1:$PORT/blawg/" "${1:-}"
