"""剪掉 public/music/*.mp3 的前导静音，并同步前移 music-player.json 里的 LRC 时间轴。

用法（仓库根或任意目录）：python _legacy/trim-music-silence.py <blog目录>
流程：ffmpeg silencedetect 实测每文件静音 -> -ss <静音-0.03s> -c copy 帧边界剪切
     -> 校验（时长差、剩余前导静音）-> 按 (vs/se 均值) 平移该曲 LRC 时间戳。
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

BLOG = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
FF = shutil.which("ffmpeg") or sys.exit("ffmpeg not found")
FP = shutil.which("ffprobe") or sys.exit("ffprobe not found")
KEEP = 0.03  # 在静音结束前留一帧余量，避免削掉起音


def duration(f: Path) -> float:
    out = subprocess.run(
        [FP, "-v", "error", "-show_entries", "format=duration", "-of", "json", str(f)],
        capture_output=True, text=True, check=True,
    ).stdout
    return float(json.loads(out)["format"]["duration"])


def leading_silence(f: Path) -> float:
    r = subprocess.run(
        [FF, "-i", str(f), "-af", "silencedetect=noise=-40dB:d=1", "-t", "20", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    m = re.search(r"silence_end: ([0-9.]+)", r.stderr)
    return float(m.group(1)) if m else 0.0


def shift_lrc(lrc: str, sec: float) -> str:
    def rep(m):
        t = max(0.0, int(m.group(1)) * 60 + float(m.group(2)) - sec)
        return f"[{int(t)//60:02d}:{t%60:05.2f}]"
    return re.sub(r"\[(\d+):(\d+(?:\.\d+)?)\]", rep, lrc)


mp3s = sorted((BLOG / "public/music").glob("*.mp3"))
assert len(mp3s) == 12, f"expected 12 mp3s, got {len(mp3s)}"

trims = {}
for f in mp3s:
    d0, s0 = duration(f), leading_silence(f)
    if s0 < 0.5:
        print(f"skip {f.name}: leading silence {s0:.2f}s")
        trims[f.name] = 0.0
        continue
    trim = round(max(0.0, s0 - KEEP), 2)
    tmp = f.with_suffix(".tmp.mp3")
    subprocess.run([FF, "-y", "-v", "error", "-ss", str(trim), "-i", str(f), "-c", "copy", str(tmp)], check=True)
    d1, s1 = duration(tmp), leading_silence(tmp)
    assert abs((d0 - trim) - d1) < 0.2, f"{f.name}: dur {d0}-{trim} -> {d1}"
    assert s1 < 0.15, f"{f.name}: still {s1:.2f}s leading silence after trim"
    tmp.replace(f)
    trims[f.name] = trim
    print(f"{f.name}: -{trim}s  (dur {d0:.1f}->{d1:.1f}, 残余静音 {s1:.3f}s)")

data_path = BLOG / "src/data/music-player.json"
songs = json.loads(data_path.read_text(encoding="utf-8"))
for s in songs:
    pair = [trims.get(Path(s[k]).name, 0.0) for k in ("vs", "se") if s.get(k)]
    shift = sum(pair) / len(pair)
    if s.get("lrc") and shift > 0.01:
        first = re.search(r"\[(\d+):(\d+(?:\.\d+)?)\]", s["lrc"])
        old = int(first.group(1)) * 60 + float(first.group(2))
        s["lrc"] = shift_lrc(s["lrc"], shift)
        new = re.search(r"\[(\d+):(\d+(?:\.\d+)?)\]", s["lrc"])
        print(f"{s['title']}: lrc 首行 {old:.2f} -> {int(new.group(1))*60+float(new.group(2)):.2f} (shift {shift:.3f})")
data_path.write_text(json.dumps(songs, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")
print("done")
