#!/bin/zsh
# make.sh [id ...]: Lina reads each line of lines.tsv (or only the ids given) into <id>.wav.
cd /Users/kevin/dev/stroketutor/web
W=/Users/kevin/dev/stroketutor/.studio/whats-new-1.1/voice
while IFS=$'\t' read -r id text; do
  if (( $# > 0 )) && [[ ! " $* " == *" $id "* ]]; then continue; fi
  extra=(); [[ -n ${ANOTHER:-} ]] && extra=(--another)
  node cli/studio.mjs voice say lina-bright "$text" --out $W/$id.wav $extra > $W/$id.out 2> $W/$id.err
  echo "$id $? $(ffprobe -v error -show_entries format=duration -of csv=p=0 $W/$id.wav 2>/dev/null)"
done < $W/lines.tsv
