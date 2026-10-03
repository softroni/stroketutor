#!/bin/zsh
# loudnorm.sh video.mp4 sound.wav out.mp4: the picture of video.mp4 copied, with sound.wav brought to -16 LUFS
# (two-pass loudnorm). The sound is rendered on its own (`remotion render … --codec=wav`) so a change to the
# mix needs no new picture.
video=$1 sound=$2 out=$3
m=$(ffmpeg -hide_banner -i $sound -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | python3 -c "import sys,re,json;t=sys.stdin.read();d=json.loads(re.search(r'\{[^{}]*input_i[^{}]*\}',t,re.S).group(0));print(f\"measured_I={d['input_i']}:measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}:measured_thresh={d['input_thresh']}:offset={d['target_offset']}\")")
ffmpeg -v error -y -i $video -i $sound -map 0:v -map 1:a -c:v copy -af "loudnorm=I=-16:TP=-1.5:LRA=11:${m}:linear=true" -ar 48000 -c:a aac -b:a 192k -shortest -movflags +faststart $out
