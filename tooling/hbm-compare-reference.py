"""Offline visual truth check for Issue #17 (NEVER an asset pipeline).
Regenerates canonical Python raster frames only inside CI QA artifacts and
compares independent browser WebGL PNG screenshots. Website loads zero frames.
"""
from __future__ import annotations
import importlib.util
import json
import math
import pathlib
import sys

import cv2
import numpy as np
from PIL import Image

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=pathlib.Path(sys.argv[1])
OUT.mkdir(parents=True,exist_ok=True)
SRC=ROOT/"animations/hbm/src/make_mustard03.py"
spec=importlib.util.spec_from_file_location("mymg_reference", SRC)
assert spec and spec.loader
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

FRAMES=[0,30,67,129,165,224,273,316,344]
def rgb(img:Image.Image)->np.ndarray:
    return np.asarray(img.convert("RGB")).astype(np.float32)

def normalized_screen(filename:pathlib.Path)->Image.Image:
    im=Image.open(filename).convert("RGB")
    if im.size!=(1280,720):
        raise AssertionError(f"Canvas screenshot must be 1280x720 without CSS scale or borders, got {im.size} from {filename}")
    return im

def ssim(ref:np.ndarray,test:np.ndarray)->float:
    """Spatial SSIM on luminance, not a global-color similarity metric."""
    a=cv2.cvtColor(ref.astype(np.uint8),cv2.COLOR_RGB2GRAY).astype(np.float32)
    b=cv2.cvtColor(test.astype(np.uint8),cv2.COLOR_RGB2GRAY).astype(np.float32)
    mean_a=cv2.GaussianBlur(a,(11,11),1.5)
    mean_b=cv2.GaussianBlur(b,(11,11),1.5)
    v_a=cv2.GaussianBlur(a*a,(11,11),1.5)-mean_a*mean_a
    v_b=cv2.GaussianBlur(b*b,(11,11),1.5)-mean_b*mean_b
    cov=cv2.GaussianBlur(a*b,(11,11),1.5)-mean_a*mean_b
    c1=(.01*255)**2
    c2=(.03*255)**2
    return float(np.mean(((2*mean_a*mean_b+c1)*(2*cov+c2))/
        ((mean_a*mean_a+mean_b*mean_b+c1)*(v_a+v_b+c2)+1e-8)))

summary={}
for f in FRAMES:
    ref_img=module.render(f/30)
    ref_img.save(OUT/f"python-{f:03}.png")
    web_file=OUT/f"hbm-frame-{f}.png"
    if not web_file.exists():raise SystemExit(f"Missing WebGL screenshot {web_file}")
    web_img=normalized_screen(web_file)
    web_img.save(OUT/f"web-normalized-{f:03}.png")
    a,b=rgb(ref_img),rgb(web_img)
    diff=np.abs(a-b)
    mse=float(np.mean(np.square(a-b)))
    score=99 if mse==0 else 10*math.log10(255**2/mse)
    mean_abs=float(np.mean(diff))
    differing=float(np.mean(np.max(diff,axis=2)>20))
    similarity=ssim(a,b)
    heat=(np.max(diff,axis=2).clip(0,255)).astype(np.uint8)
    cv2.imwrite(str(OUT/f"heat-{f:03}.png"),cv2.applyColorMap(heat,cv2.COLORMAP_TURBO))
    summary[str(f)]={"psnr_dB":round(score,2),"ssim":round(similarity,4),
        "mae":round(mean_abs,2),"fraction_gt20":round(differing,4)}
    print(f"HBM frame {f:3} Python vs Three.js: PSNR={score:.2f}dB SSIM={similarity:.4f} MAE={mean_abs:.2f} changed={differing:.1%}",flush=True)
(OUT/"python-vs-webgl.json").write_text(json.dumps(summary,indent=2)+"\n")
print("Visual difference maps and metrics saved. Quantitative parity assessment required; non-exact rendering is NOT labeled 1:1.")
