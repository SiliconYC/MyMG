#!/usr/bin/env bash
# Build assets from the *canonical* Python renderer. Never commit generated media.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$ROOT/apps/portal/dist/media}"
mkdir -p "$OUT"
ORIGINAL="$OUT/hbm-python-original.mp4"
WEB="$OUT/hbm-mustard03.mp4"
POSTER="$OUT/hbm-poster.jpg"

python "$ROOT/animations/hbm/src/make_mustard03.py" --range 0 345 --out "$ORIGINAL"
test -s "$ORIGINAL"
# OpenCV's mp4v is not reliably playable in Safari/Chromium. Preserve the
# original untouched and ship an intra-second-seekable H.264 derivative.
ffmpeg -hide_banner -loglevel error -y -i "$ORIGINAL" \
  -map 0:v:0 -an -c:v libx264 -crf 14 -preset medium -pix_fmt yuv420p \
  -profile:v high -g 30 -keyint_min 30 -sc_threshold 0 \
  -movflags +faststart "$WEB"
ffmpeg -hide_banner -loglevel error -y -ss 10.55 -i "$WEB" \
  -frames:v 1 -q:v 2 -update 1 "$POSTER"
python "$ROOT/tooling/verify-hbm-master.py" "$ORIGINAL" "$WEB" "$POSTER"
sha256sum "$ORIGINAL" "$WEB" > "$OUT/hbm-master-sha256.txt"
du -h "$ORIGINAL" "$WEB" "$POSTER"
