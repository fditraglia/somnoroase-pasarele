# /// script
# requires-python = ">=3.11"
# ///
"""Generate the game's Romanian audio with ElevenLabs into public/audio/.

Reads content/audio-manifest.json (written by build_content.py). Each clip is
stored under its content hash, so a clip is generated once and never billed
again; rerunning only fills in what is missing.

Every new clip is checked for a cut-off ending: a complete take decays into at
least a few hundredths of a second of silence, while a truncated take stops
dead on the last sound. A clip that fails the check is regenerated (up to
--tries times) and reported if it still fails.

The API key is read from $ELEVENLABS_API_KEY, else ./.env, else the companion
repo's ~/limba-românǎ/.env. Requires ffmpeg on PATH for the ending check.

  uv run scripts/build_audio.py --dry-run     # count clips and characters only
  uv run scripts/build_audio.py               # generate what is missing
  uv run scripts/build_audio.py --check       # re-run the ending check on all
  uv run scripts/build_audio.py --redo cheie,pepene   # new takes of every clip
                                                      # containing these words
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import struct
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from build_content import FMT, LANG, MODEL, VOICE  # noqa: E402

OUT = ROOT / "public" / "audio"
MIN_TAIL_S = 0.04


def load_key() -> str:
    if os.environ.get("ELEVENLABS_API_KEY"):
        return os.environ["ELEVENLABS_API_KEY"].strip()
    for env in (ROOT / ".env", Path.home() / "limba-românǎ" / ".env"):
        if env.exists():
            m = re.search(r'ELEVENLABS_API_KEY\s*=\s*"?([^"\n]+)"?', env.read_text())
            if m:
                return m.group(1).strip()
    sys.exit("no ELEVENLABS_API_KEY found")


def tail_silence(path: Path) -> float:
    """Seconds of trailing near-silence (below 2% of the clip's peak RMS)."""
    pcm = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1",
         "-ar", "44100", "-"], capture_output=True, check=True).stdout
    n = len(pcm) // 2
    s = struct.unpack(f"<{n}h", pcm)
    win = 441  # 10 ms
    rms = [math.sqrt(sum(v * v for v in s[i:i + win]) / win)
           for i in range(0, n - win, win)]
    if not rms:
        return 0.0
    thr = max(rms) * 0.02
    k = len(rms)
    while k > 0 and rms[k - 1] < thr:
        k -= 1
    return (len(rms) - k) * 0.01


def synth(key: str, text: str) -> tuple[bytes, int]:
    body = json.dumps({"text": text, "model_id": MODEL, "language_code": LANG}).encode()
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format={FMT}"
    for attempt in range(6):
        req = urllib.request.Request(url, data=body, headers={
            "xi-api-key": key, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                cost = r.headers.get("character-cost") or "0"
                return r.read(), int(cost) if cost.isdigit() else 0
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 5:
                time.sleep(2 + 3 * attempt)
                continue
            raise RuntimeError(f"{e.code} {e.read().decode()[:200]}") from e
        except (urllib.error.URLError, TimeoutError):
            if attempt == 5:
                raise
            time.sleep(2 + 3 * attempt)
    raise RuntimeError("unreachable")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--tries", type=int, default=3)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--redo", default="",
                    help="comma-separated words; regenerate every clip whose text contains one")
    args = ap.parse_args()

    manifest = json.loads((ROOT / "content" / "audio-manifest.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    # The voice model gives a slightly different take each time, so a clip that
    # sounds wrong can simply be generated again.
    redo = [w.strip().lower() for w in args.redo.split(",") if w.strip()]
    for c in manifest:
        words = re.findall(r"\w+", c["text"].lower())
        if any(w in words for w in redo) and not args.dry_run:
            (OUT / f"{c['hash']}.mp3").unlink(missing_ok=True)
    todo = [c for c in manifest if not (OUT / f"{c['hash']}.mp3").exists()]
    chars = sum(len(c["text"]) for c in todo)
    print(f"clips in manifest: {len(manifest)}; to generate: {len(todo)} "
          f"({chars} characters, model {MODEL})")

    if args.check:
        short = [(c["text"], t) for c in manifest
                 if (OUT / f"{c['hash']}.mp3").exists()
                 and (t := tail_silence(OUT / f"{c['hash']}.mp3")) < MIN_TAIL_S]
        print(f"clips with a suspect ending: {len(short)}")
        for text, t in short:
            print(f"  {t:.2f}s  {text}")
        return
    if args.dry_run or not todo:
        return

    key = load_key()

    def one(c: dict) -> tuple[str, int, float, int]:
        path = OUT / f"{c['hash']}.mp3"
        spent, tail, tries = 0, 0.0, 0
        for tries in range(1, args.tries + 1):
            data, cost = synth(key, c["text"])
            spent += cost
            path.write_bytes(data)
            tail = tail_silence(path)
            if tail >= MIN_TAIL_S:
                break
        return c["text"], spent, tail, tries

    total, rerolled, bad, done = 0, 0, [], 0
    with ThreadPoolExecutor(args.workers) as pool:
        for text, spent, tail, tries in pool.map(one, todo):
            total += spent
            done += 1
            rerolled += tries > 1
            if tail < MIN_TAIL_S:
                bad.append(text)
            if done % 50 == 0:
                print(f"  {done}/{len(todo)}  ({total} credits so far)", flush=True)
    print(f"generated {len(todo)} clips for {total} credits; "
          f"{rerolled} needed a second take")
    for text in bad:
        print(f"  ending still suspect after {args.tries} takes: {text}")


if __name__ == "__main__":
    main()
