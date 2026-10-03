#!/bin/zsh
# grid.sh <clip> <t> [<t>…]: frames of raw/<clip>.mp4 at those seconds, 960 wide with a 10% grid, tiled 2 across, into grid/<clip>.png
clip=$1; shift
files=()
for t in "$@"; do
  f=grid/$clip-$t.png
  ffmpeg -y -loglevel error -ss $t -i raw/$clip.mp4 -frames:v 1 -vf "scale=960:540,drawgrid=w=96:h=54:t=1:c=red@0.45" $f
  files+=(-label "$clip @ $t" $f)
done
magick montage $files -tile 2x -geometry +4+4 -pointsize 18 grid/$clip.png
rm -f grid/$clip-*.png
