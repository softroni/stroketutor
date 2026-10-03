#!/usr/bin/env python3
"""norm.py: every take used in the video at -16 LUFS (two-pass loudnorm), mono 48 kHz, into ../video/public/vo."""
import json, re, subprocess
from pathlib import Path
HERE = Path(__file__).parent
OUT = HERE.parent / "video/public/vo"
OUT.mkdir(parents=True, exist_ok=True)
ids = [r.split("\t")[0] for r in (HERE / "lines.tsv").read_text().splitlines()]
ids += [r.split("\t")[0] for f in ("app.tsv", "splits.tsv") for r in (HERE / f).read_text().splitlines() if r.strip()]
for id in ids:
    src = HERE / f"{id}.wav"
    first = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(src), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
    m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", first, re.S).group(0))
    af = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
          f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", af, "-ar", "48000", "-ac", "1", str(OUT / f"{id}.wav")], check=True)
    print(id, m["input_i"])
