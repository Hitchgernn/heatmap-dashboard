#!/usr/bin/env bash
# Regenerate the raster favicons from the SVG sources.
#
# public/favicon.svg is what modern browsers actually load; the ICO and the Apple
# touch icon are fallbacks that have to be rendered ahead of time. The 16px slice
# comes from scripts/favicon-16.svg instead, because the terrace gaps in the main
# mark close up below ~24px.
#
# Needs rsvg-convert (librsvg) and magick (ImageMagick 7).
set -euo pipefail

cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

rsvg-convert -w 16 -h 16 scripts/favicon-16.svg -o "$tmp/16.png"
for s in 32 48; do
  rsvg-convert -w "$s" -h "$s" public/favicon.svg -o "$tmp/$s.png"
done
rsvg-convert -w 180 -h 180 public/favicon.svg -o public/apple-touch-icon.png

magick "$tmp/16.png" "$tmp/32.png" "$tmp/48.png" public/favicon.ico

echo "wrote public/favicon.ico (16/32/48) and public/apple-touch-icon.png"
