#!/bin/zsh
# Speaks every line of lines.tsv in the narrator's voice (cloned from ref/narrator.wav) into takes/<id>.wav.
# Usage: ./make.sh [id ...]   (no ids: every line without a take yet)
cd "${0:A:h}"
while IFS=$'\t' read -r id words; do
  [[ -z "$id" ]] && continue
  if (( $# )); then (( ${@[(Ie)$id]} )) || continue; elif [[ -f takes/$id.wav ]]; then continue; fi
  /Users/kevin/bin/tts "$words" --model qwen-base --ref "$PWD/ref/narrator.wav" --out "$PWD/takes/$id.wav" >/dev/null && echo "made $id"
done < lines.tsv
