# /// script
# requires-python = ">=3.11"
# ///
"""Build the game's vocabulary from content/*.tsv joined onto the A1-A2 spine.

content/words.tsv holds only what the spine lacks: a topic, an emoji, a short
English gloss, and a countability flag. Gender, plural, and the definite forms
come from the spine (the dexonline paradigm in the companion repo's
limba-romana-a1a2.jsonl). A word that is not in the spine carries its forms in
the `manual` column as gender|plural|definite sg|definite pl.

Outputs
  src/data/content.json        the cards the game loads
  content/audio-manifest.json  every clip the game needs: {hash, text}

Run:  uv run scripts/build_content.py            (then scripts/build_audio.py)
"""
from __future__ import annotations

import csv
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPINE = Path(os.environ.get(
    "SPINE", Path.home() / "limba-românǎ" / "deck-data" / "limba-romana-a1a2.jsonl"))

# Voice recipe for this game's clips. eleven_v4 was chosen on 2026-11-16 after a
# side-by-side test: on short Romanian phrases eleven_v3 stopped dead on the
# last sound in 7 of 12 clips, while eleven_v4 left a clean tail in 12 of 12.
VOICE = "gbLy9ep70G3JW53cTzFC"  # Corina Ioana, the voice of the Anki deck
MODEL = "eleven_v4"
LANG = "ro"
FMT = "mp3_44100_128"
SETTINGS = "default"

GENDER = {"M": "m", "F": "f", "N": "n"}
ONE = {"m": "un", "f": "o", "n": "un"}
TWO = {"m": "doi", "f": "două", "n": "două"}


def clip_hash(text: str) -> str:
    """Same content-address scheme as the companion repo's build_audio.py."""
    key = f"{text}\x1f{VOICE}\x1f{MODEL}\x1f{LANG}\x1f{SETTINGS}\x1f{FMT}"
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]


def read_tsv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def spine_forms(rec: dict) -> dict | None:
    """Gender + the four nominative-accusative forms from a spine noun record."""
    d = rec.get("dex") or {}
    g = GENDER.get((d.get("gender") or "").strip())
    cells = {}
    for c in d.get("paradigm", []):
        desc = c.get("description", "")
        if "Nominativ-Acuzativ" not in desc:
            continue
        number = "sg" if "singular" in desc else "pl"
        article = "indef" if "nearticulat" in desc else "def"
        cells.setdefault((number, article), (c.get("form") or "").strip())
    need = [("sg", "indef"), ("pl", "indef"), ("sg", "def"), ("pl", "def")]
    if not g or any(k not in cells for k in need):
        return None
    return {"g": g, "pl": cells["pl", "indef"], "def": cells["sg", "def"],
            "defPl": cells["pl", "def"], "sgCheck": cells["sg", "indef"]}


def main() -> None:
    spine = {}
    if SPINE.exists():
        for line in SPINE.read_text(encoding="utf-8").splitlines():
            if line.strip():
                r = json.loads(line)
                if r.get("pos") == "n.":
                    spine.setdefault(r["headword"], r)
    else:
        print(f"warning: spine not found at {SPINE}; only manual rows will build")

    topics = read_tsv(ROOT / "content" / "topics.tsv")
    rows = read_tsv(ROOT / "content" / "words.tsv")
    words: dict[str, dict] = {}
    manifest: dict[str, str] = {}
    problems: list[str] = []

    def clip(text: str) -> str:
        h = clip_hash(text)
        manifest[h] = text
        return h

    for row in rows:
        ro = row["ro"].strip()
        if ro in words:
            problems.append(f"duplicate word: {ro}")
            continue
        manual = (row.get("manual") or "").strip()
        if manual:
            g, pl, de, dpl = manual.split("|")
            forms = {"g": g, "pl": pl, "def": de, "defPl": dpl}
            src = "manual"
        else:
            rec = spine.get(ro)
            forms = spine_forms(rec) if rec else None
            if not forms:
                problems.append(f"not in spine (add a manual column): {ro}")
                continue
            if forms.pop("sgCheck") != ro:
                problems.append(f"spine singular differs from headword: {ro}")
            src = "spine"
        kind = row["count"].strip()  # 1 = countable, 0 = mass, p = plural only
        w = {"ro": ro, "en": row["en"].strip(), "emoji": row["emoji"].strip(),
             "topic": row["topic"].strip(), **forms, "count": kind == "1"}
        g = w["g"]
        audio = {"w": clip(ro)}
        if kind == "1":
            w["entry"] = f"{ONE[g]} {ro}, {TWO[g]} {w['pl']}"
            audio["e"] = clip(w["entry"])
        if kind == "p":
            w["ask"] = f"Unde sunt {w['def']}?"
        else:
            w["ask"] = f"Unde este {w['def']}?"
        audio["q"] = clip(w["ask"])
        w["a"] = audio
        w["_src"] = src
        words[ro] = w

    out_topics = []
    for t in topics:
        ids = [w["ro"] for w in words.values() if w["topic"] == t["id"]]
        if not ids:
            problems.append(f"topic has no words: {t['id']}")
        out_topics.append({"id": t["id"], "ro": t["ro"], "en": t["en"],
                           "icon": t["icon"], "words": ids})
    known = {t["id"] for t in topics}
    for w in words.values():
        if w["topic"] not in known:
            problems.append(f"unknown topic {w['topic']} for {w['ro']}")

    if "--table" in sys.argv:
        for w in words.values():
            print(f"{w['topic']:10s} {w['emoji']} {w['ro']:11s} {w['g']} "
                  f"{w['pl']:12s} {w['def']:13s} {w['defPl']:14s} "
                  f"{'' if w['count'] else '(no count)':10s} {w['_src']}")

    for w in words.values():
        del w["_src"], w["topic"]
    # Fixed phrases the bird says, and the Eminescu poem (one clip per stanza).
    extras = json.loads((ROOT / "content" / "extras.json").read_text(encoding="utf-8"))
    phrases = {k: {**v, "a": clip(v["ro"])} for k, v in extras["phrases"].items()}
    poem = extras["poem"]
    for st in poem["stanzas"]:
        st["a"] = clip("\n".join(st["ro"]))
    content = {"topics": out_topics, "words": words, "phrases": phrases, "poem": poem}
    (ROOT / "src" / "data").mkdir(parents=True, exist_ok=True)
    (ROOT / "src" / "data" / "content.json").write_text(
        json.dumps(content, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (ROOT / "content" / "audio-manifest.json").write_text(
        json.dumps([{"hash": h, "text": t} for h, t in manifest.items()],
                   ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    chars = sum(len(t) for t in manifest.values())
    print(f"{len(words)} words in {len(out_topics)} topics; "
          f"{len(manifest)} clips, {chars} characters")
    for p in problems:
        print("PROBLEM:", p)
    if problems:
        sys.exit(1)


if __name__ == "__main__":
    main()
