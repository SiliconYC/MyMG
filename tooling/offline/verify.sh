#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CACHE="$ROOT/.mymg-offline"
export PATH="$CACHE/tools/node_modules/.bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$CACHE/browsers"
export npm_config_registry=http://127.0.0.1:9 npm_config_offline=true
cd "$ROOT"
pnpm install --offline --frozen-lockfile --store-dir "$CACHE/store"
pnpm check
pnpm --filter @mymg/portal build
LOGDIR="$ROOT/output/qa-offline"
mkdir -p "$LOGDIR"
pnpm --filter @mymg/portal exec vite preview --host 127.0.0.1 --port 4173 >"$LOGDIR/vite.log" 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT
READY=0
for i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:4173/MyMG/ >/dev/null; then READY=1; break; fi
  sleep 1
done
test "$READY" = 1 || { cat "$LOGDIR/vite.log"; exit 1; }
MYMG_QA_URL=http://127.0.0.1:4173/MyMG/ MYMG_QA_OUTPUT="$LOGDIR" pnpm --filter @mymg/portal qa
