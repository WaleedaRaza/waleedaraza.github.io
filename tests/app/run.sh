#!/bin/bash
# Run the checks for the old board (blawg/board/) and the map page (blawg/#map): bash tests/app/run.sh [shotdir]
set -e
cd "$(dirname "$0")/../.."
PORT=${PORT:-8770}
python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV' EXIT
sleep 1
node tests/app/board.js "http://127.0.0.1:$PORT/blawg/board/" "${1:-}"
node tests/app/layout.js "http://127.0.0.1:$PORT/blawg/board/" "${1:-}"
OUT="${1:-}" node tests/app/mappage.js "http://127.0.0.1:$PORT/blawg/"
