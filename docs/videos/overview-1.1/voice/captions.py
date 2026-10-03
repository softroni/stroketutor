#!/usr/bin/env python3
"""captions.py: Lina's words with their times, for the bubble and the SRT.

Reads lines.tsv (id, spoken text, optional third column: the text as shown on screen) and app.tsv (her in-app
step recordings: id, text), and Whisper's word times in whisper/<id>.json (`whisper <id>.wav --model small
--language en --word_timestamps True --output_format json --output_dir whisper`). Each shown word takes the time
of the heard word it matches; a word Whisper heard differently takes its neighbours' times and is listed, so the
take can be checked or made again. A line cut in two (splits.tsv) keeps its words' times. Writes ../video/src/captions.json.
"""
import difflib, json, re, subprocess, sys, unicodedata
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent / "video/src/captions.json"
NUMBERS = {"110": "a hundred and ten", "33": "thirty-three", "11": "eleven"}


def norm(word: str) -> str:
    w = unicodedata.normalize("NFKD", word).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9']", "", w).replace("'", "")


def duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True).stdout
    return round(float(out), 3)


def heard_words(id: str):
    data = json.loads((HERE / "whisper" / f"{id}.json").read_text())
    words = []
    for seg in data["segments"]:
        for w in seg.get("words", []):
            text = w["word"].strip()
            for part in NUMBERS.get(norm(text), text).split():
                words.append({"n": norm(part), "start": w["start"], "end": w["end"]})
    return [w for w in words if w["n"]], data["text"].strip()


def align(shown: str, id: str):
    heard, said = heard_words(id)
    tokens = shown.split()
    a = [norm(t) for t in tokens]
    b = [w["n"] for w in heard]
    times = [None] * len(tokens)
    for block in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks():
        for k in range(block.size):
            times[block.a + k] = (heard[block.b + k]["start"], heard[block.b + k]["end"])
    missed = [tokens[i] for i, t in enumerate(times) if t is None and a[i]]
    # Fill a word Whisper did not match between its neighbours.
    for i, t in enumerate(times):
        if t is None:
            prev = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
            nxt = next((times[j][0] for j in range(i + 1, len(times)) if times[j]), prev + 0.3)
            times[i] = (prev, max(prev, nxt))
    return [{"text": tok, "start": round(s, 2), "end": round(e, 2)} for tok, (s, e) in zip(tokens, times)], missed, said


def main():
    lines = []
    for row in (HERE / "lines.tsv").read_text().splitlines():
        cols = row.split("\t")
        lines.append((cols[0], cols[2] if len(cols) > 2 and cols[2] else cols[1]))
    if (HERE / "app.tsv").exists():
        lines += [tuple(r.split("\t")[:2]) for r in (HERE / "app.tsv").read_text().splitlines() if r.strip()]
    result, problems = {}, 0
    for id, shown in lines:
        words, missed, said = align(shown, id)
        result[id] = {"text": shown, "duration": duration(HERE / f"{id}.wav"), "words": words}
        if missed:
            problems += 1
            print(f"{id}: heard \"{said}\"\n  not matched: {' '.join(missed)}")
    # A line cut in two at a pause (splits.tsv: id, source id, start, end): the source's words in that span.
    if (HERE / "splits.tsv").exists():
        for row in (HERE / "splits.tsv").read_text().splitlines():
            id, src, a, b = row.split("\t")
            a, b = float(a), float(b)
            words = [{"text": w["text"], "start": round(w["start"] - a, 2), "end": round(w["end"] - a, 2)}
                     for w in result[src]["words"] if a <= w["start"] < b]
            result[id] = {"text": " ".join(w["text"] for w in words), "duration": duration(HERE / f"{id}.wav"), "words": words}
    OUT.write_text(json.dumps(result, indent=1, ensure_ascii=False))
    print(f"{len(result)} lines, {problems} with words Whisper heard differently -> {OUT}")


if __name__ == "__main__":
    sys.exit(main())
