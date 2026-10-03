#!/usr/bin/env python3
"""captions.py: the narrator's words (lines.tsv) and Lina's (app.tsv) with their times, for the captions and the SRT.

Each shown word takes the time of the word Whisper heard that matches it (whisper/<id>.json, word timestamps), shifted
by what norm.py trimmed off the start; a word heard differently takes its neighbours' times and is listed.
Writes ../video/src/captions.json: {id: {text, duration, words: [{text, start, end}]}}."""
import difflib, json, re, subprocess, unicodedata
from pathlib import Path

HERE = Path(__file__).parent
VO = HERE.parent / "video/public/vo"
OUT = HERE.parent / "video/src/captions.json"
NUMBERS = {"13": "thirteen", "15": "fifteen", "26": "twenty-six", "120": "a hundred and twenty", "209": "two hundred and nine"}


def norm(word):
    w = unicodedata.normalize("NFKD", word).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]", "", w)


def duration(path):
    return round(float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                                      capture_output=True, text=True).stdout), 3)


def heard(id):
    data = json.loads((HERE / "whisper" / f"{id}.json").read_text())
    words = []
    for w in (w for s in data["segments"] for w in s.get("words", [])):
        for part in NUMBERS.get(norm(w["word"]), w["word"]).replace("-", " ").split():
            words.append({"n": norm(part), "start": w["start"], "end": w["end"]})
    return [w for w in words if w["n"]], data["text"].strip()


def align(shown, id, shift):
    words, said = heard(id)
    tokens = shown.split()
    a = [norm(t.replace("-", "")) for t in tokens]
    # A hyphenated word is two heard words ("twenty-six", "I-D"): match on its first part.
    a = [norm(t.split("-")[0]) if "-" in t else n for t, n in zip(tokens, a)]
    b = [w["n"] for w in words]
    times = [None] * len(tokens)
    for block in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks():
        for k in range(block.size):
            w = words[block.b + k]
            times[block.a + k] = (w["start"], w["end"])
    missed = [tokens[i] for i, t in enumerate(times) if t is None and a[i]]
    for i, t in enumerate(times):
        if t is None:
            prev = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
            nxt = next((times[j][0] for j in range(i + 1, len(times)) if times[j]), prev + 0.3)
            times[i] = (prev, max(prev, nxt))
    return [{"text": tok, "start": round(max(0, s - shift), 2), "end": round(max(0, e - shift), 2)} for tok, (s, e) in zip(tokens, times)], missed, said


rows = [r.split("\t") for f in ("lines.tsv", "app.tsv") for r in (HERE / f).read_text().splitlines() if r.strip()]
result = {}
for id, shown in ((r[0], r[1]) for r in rows):
    first = json.loads((HERE / "whisper" / f"{id}.json").read_text())["segments"][0]["words"][0]["start"]
    words, missed, said = align(shown, id, max(0.0, first - 0.06) if id != "lina-wobble" else 0.0)
    result[id] = {"text": shown, "duration": duration(VO / f"{id}.wav"), "words": words}
    if missed:
        print(f"{id}: heard \"{said}\"\n  not matched: {' '.join(missed)}")
OUT.write_text(json.dumps(result, indent=1, ensure_ascii=False))
print(f"{len(result)} lines -> {OUT}")
