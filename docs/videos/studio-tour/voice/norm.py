#!/usr/bin/env python3
"""norm.py: every take in lines.tsv trimmed to its words (Whisper's first word less 0.06 s, last word plus 0.22 s), at
-16 LUFS (two-pass loudnorm), mono 48 kHz, into ../video/public/vo. Lina's take (../assets/lina-wobble.audio) the same."""
import json, re, subprocess
from pathlib import Path
HERE = Path(__file__).parent
OUT = HERE.parent / "video/public/vo"
OUT.mkdir(parents=True, exist_ok=True)


def level(src: Path, dst: Path, start: float, end: float, target: float = -16):
    cut = ["-ss", f"{start:.3f}", "-to", f"{end:.3f}"]
    first = subprocess.run(["ffmpeg", "-hide_banner", *cut, "-i", str(src), "-af", f"loudnorm=I={target}:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
    m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", first, re.S).group(0))
    af = (f"loudnorm=I={target}:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
          f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,afade=t=in:d=0.02,areverse,afade=t=in:d=0.06,areverse")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *cut, "-i", str(src), "-af", af, "-ar", "48000", "-ac", "1", str(dst)], check=True)


def span(id: str):
    data = json.loads((HERE / "whisper" / f"{id}.json").read_text())
    words = [w for s in data["segments"] for w in s.get("words", [])]
    return max(0.0, words[0]["start"] - 0.06), words[-1]["end"] + 0.22


for row in (HERE / "lines.tsv").read_text().splitlines():
    id = row.split("\t")[0]
    a, b = span(id)
    level(HERE / "takes" / f"{id}.wav", OUT / f"{id}.wav", a, b)
    print(id, round(b - a, 2))
lina = HERE.parent / "assets/lina-wobble.audio"
level(lina, OUT / "lina-wobble.wav", 0, 99, -17)
