#!/bin/sh
# Makes the Studio's favicon and header mark from the app icon, so the Studio looks like Paper Coach.
# Run it again after the app icon changes:  sh web/scripts/icons.sh   (needs ImageMagick)
set -eu
cd "$(dirname "$0")/.."
src=../PaperCoach/Assets.xcassets/AppIcon.appiconset/AppIcon.png
out=public
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$out"

# Round the corners at full size (iOS's own radius is about 22% of the side), then scale down, so small sizes stay smooth.
magick "$src" \( +clone -alpha extract -fill black -colorize 100 -fill white \
  -draw 'roundrectangle 0,0,1023,1023,228,228' \) -alpha off -compose CopyOpacity -composite "$tmp/rounded.png"

magick "$tmp/rounded.png" -define icon:auto-resize=48,32,16 "$out/favicon.ico"
magick "$tmp/rounded.png" -resize 192x192 -strip "$out/icon.png"
# A home-screen icon for the iPad and phone on the tailnet; iOS rounds the corners itself.
magick "$src" -resize 180x180 -strip "$out/apple-touch-icon.png"
