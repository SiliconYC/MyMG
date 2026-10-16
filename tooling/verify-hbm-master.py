"""Reject truncated, out-of-sync or visibly degraded Web derivatives."""
from __future__ import annotations
import json
import math
import pathlib
import subprocess
import sys

import cv2
import numpy as np

original, web, poster = map(pathlib.Path, sys.argv[1:])
for path in (original, web, poster):
    if not path.is_file() or path.stat().st_size == 0:
        raise SystemExit(f"Missing or empty HBM asset: {path}")

def probe(path: pathlib.Path) -> dict:
    raw = subprocess.check_output([
        "ffprobe", "-v", "error", "-count_frames",
        "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,width,height,r_frame_rate,nb_read_frames",
        "-of", "json", str(path),
    ])
    return json.loads(raw)["streams"][0]

for path, codec in ((original, "mpeg4"), (web, "h264")):
    data = probe(path)
    assert data["codec_name"] == codec, (path, data)
    assert (data["width"], data["height"]) == (1280, 720), (path, data)
    assert data["r_frame_rate"] == "30/1", (path, data)
    assert int(data["nb_read_frames"]) == 345, (path, data)

def read_at(path: pathlib.Path, frame: int) -> np.ndarray:
    cap = cv2.VideoCapture(str(path))
    try:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame)
        valid, rgb = cap.read()
        if not valid:
            raise AssertionError(f"Cannot decode frame {frame}: {path}")
        return rgb.astype(np.float32)
    finally:
        cap.release()

# Compare physical scene changes and all editorial stages, including last frame.
samples = (0, 30, 67, 86, 129, 146, 165, 199, 224, 253, 273, 295, 316, 336, 344)
worst_psnr = math.inf
for index in samples:
    master = read_at(original, index)
    derived = read_at(web, index)
    mse = float(np.mean(np.square(master - derived)))
    psnr = 99.0 if mse == 0 else 10 * math.log10(255**2 / mse)
    worst_psnr = min(worst_psnr, psnr)
    if psnr < 38.0:
        raise AssertionError(f"Web HBM differs too much at frame {index}: {psnr:.2f} dB")

print(f"HBM film verified: 345 frames, 30 FPS, 1280x720, 11.5 s; sampled worst PSNR {worst_psnr:.2f} dB")
