#!/usr/bin/env bash
# bash tooling/offline/restore.sh /directory/with/release-assets
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ASSETS="$(cd "${1:?Provide downloaded Release assets directory}" && pwd)"
test "$(uname -s)" = Linux && test "$(uname -m)" = x86_64 || { echo "Linux x64 required"; exit 1; }
node -e 'if (process.versions.node.split(".")[0] !== "22") process.exit(1)' || { echo "Node 22 required"; exit 1; }
(cd "$ASSETS" && sha256sum -c SHA256SUMS)
CACHE="$ROOT/.mymg-offline"
mkdir -p "$CACHE"
tar -xzf "$ASSETS/mymg-offline-linux-x64-node22.tar.gz" -C "$CACHE"
EXPECTED="$(cat "$CACHE/lock.sha256")"
ACTUAL="$(sha256sum "$ROOT/pnpm-lock.yaml" | cut -d' ' -f1)"
test "$EXPECTED" = "$ACTUAL" || { echo "Lockfile mismatch; rebuild offline bundle"; exit 1; }
export npm_config_registry=http://127.0.0.1:9 npm_config_offline=true
npm install --offline --ignore-scripts --no-audit --no-fund --prefix "$CACHE/tools" "$CACHE/pnpm-10.20.0.tgz"
export PATH="$CACHE/tools/node_modules/.bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$CACHE/browsers"
cd "$ROOT"
pnpm install --offline --frozen-lockfile --store-dir "$CACHE/store"
echo "Restored pnpm and Chromium. Next: bash tooling/offline/verify.sh"
