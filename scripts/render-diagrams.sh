#!/usr/bin/env bash
#
# Renders every Mermaid source in docs/assets/diagrams/src/ to a PNG beside it
# in docs/assets/diagrams/.
#
# The site itself does not need these — MkDocs Material renders the ```mermaid
# fences in BLUEPRINT.md natively. The PNGs exist so the diagrams can be pasted
# into a Word or PDF report, where a fenced code block is useless.
#
# Requires Node (for npx) and a headless Chromium, which mermaid-cli downloads
# via Puppeteer on first run.
#
# Usage:  bash scripts/render-diagrams.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$ROOT/docs/assets/diagrams/src"
OUT_DIR="$ROOT/docs/assets/diagrams"

# White background, not transparent: a transparent PNG dropped onto a white Word
# page looks fine, but onto a dark slide the black text vanishes.
BACKGROUND="white"
# 2x gives text that stays sharp when the image is scaled to page width.
SCALE=2

if [ ! -d "$SRC_DIR" ]; then
  echo "error: $SRC_DIR does not exist" >&2
  exit 1
fi

shopt -s nullglob
sources=("$SRC_DIR"/*.mmd)
if [ ${#sources[@]} -eq 0 ]; then
  echo "error: no .mmd files in $SRC_DIR" >&2
  exit 1
fi

echo "Rendering ${#sources[@]} diagram(s) to $OUT_DIR"

for src in "${sources[@]}"; do
  name="$(basename "$src" .mmd)"
  out="$OUT_DIR/$name.png"
  echo "  $name.mmd -> $name.png"
  npx -y @mermaid-js/mermaid-cli \
    --input "$src" \
    --output "$out" \
    --backgroundColor "$BACKGROUND" \
    --scale "$SCALE"
done

echo "Done."
