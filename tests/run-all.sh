#!/usr/bin/env bash
# Runs every suite, each against a freshly started server and an empty data directory.
# PostgreSQL: set TEST_PG_ADMIN_URL (e.g. postgresql://postgres@127.0.0.1:5432/postgres) and each suite also gets its own fresh database.
set -euo pipefail
cd "$(dirname "$0")/.."
export WA_GRAPH_URL=http://localhost:9099/graph RESEND_API_URL=http://localhost:9099/resend R2_ENDPOINT=http://localhost:9099/r2 PORT=8080 HOST=127.0.0.1 BASE_URL=http://127.0.0.1:8080
CHROME_PATH="${CHROME_PATH:-$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)}"; export CHROME_PATH
fail=0
free_port() { (command -v fuser >/dev/null && fuser -k 8080/tcp >/dev/null 2>&1) || true; sleep 1; if curl -sf localhost:8080/api/health >/dev/null; then echo "port 8080 is busy; stop the other server first" >&2; exit 2; fi; }
for suite in ${TEST_SUITES:-auth-security handover smoke phase2 compliance sweep enterprise-controls workflow-api work-api enterprise-module-api ai-controls workflow-controls work-controls enterprise-modules cargo-docs deposits ocr}; do
  free_port
  dir="$(mktemp -d)"; export DATA_DIR="$dir"
  if [ -n "${TEST_PG_ADMIN_URL:-}" ]; then
    db="elvora_test_${suite//-/_}"; psql "$TEST_PG_ADMIN_URL" -qc "drop database if exists $db" -c "create database $db"
    export DATABASE_URL="${TEST_PG_ADMIN_URL%/*}/$db"
  fi
  case "$suite" in
    auth-security|ai-controls|workflow-controls|work-controls|enterprise-modules|cargo-docs|deposits|ocr)
      echo "=== $suite (domain) ==="
      if ! node --import tsx "tests/$suite.ts"; then fail=1;
      elif [ "$suite" = workflow-controls ]; then
        # Reopen the same fixture in a separate process to prove persistence.
        if ! node --import tsx tests/workflow-controls.ts resume; then fail=1; fi
      fi
      continue
      ;;
  esac
  node dist/server/index.mjs > "$dir/server.log" 2>&1 & pid=$!
  for i in $(seq 1 60); do curl -sf localhost:8080/api/health >/dev/null && break; sleep 1; done
  echo "=== $suite ==="
  if ! node --import tsx "tests/$suite.ts"; then fail=1; tail -40 "$dir/server.log"; fi
  kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true
done
exit $fail
