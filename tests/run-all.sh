#!/usr/bin/env bash
# Runs every suite, each against a freshly started server and an empty data directory.
set -euo pipefail
cd "$(dirname "$0")/.."
export WA_GRAPH_URL=http://localhost:9099/graph RESEND_API_URL=http://localhost:9099/resend R2_ENDPOINT=http://localhost:9099/r2 PORT=8080
CHROME_PATH="${CHROME_PATH:-$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)}"; export CHROME_PATH
fail=0
free_port() { (command -v fuser >/dev/null && fuser -k 8080/tcp >/dev/null 2>&1) || true; sleep 1; if curl -sf localhost:8080/api/health >/dev/null; then echo "port 8080 is busy; stop the other server first" >&2; exit 2; fi; }
for suite in handover smoke phase2; do
  free_port
  dir="$(mktemp -d)"; export DATA_DIR="$dir"
  node dist/server/index.mjs > "$dir/server.log" 2>&1 & pid=$!
  for i in $(seq 1 60); do curl -sf localhost:8080/api/health >/dev/null && break; sleep 1; done
  echo "=== $suite ==="
  if ! npx tsx "tests/$suite.ts"; then fail=1; tail -40 "$dir/server.log"; fi
  kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true
done
exit $fail
