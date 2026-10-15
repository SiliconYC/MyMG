"""HBM V9: restrained Chinese typography, no top-left rule/counter.
V8 geometry, movement, sound and frame timing are preserved. This script
replaces BOTH early-stage and final-stage label renderers (without touching
any physical model).

    python make_v9.py --stills
    python make_v9.py --video
"""
import argparse
import pathlib
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio.v2 as imageio

HERE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import make_v8 as v8
v7=v8.v7
v4=v7.v4
v3=v7.v3

REG='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
BOLD='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
F_TERM=ImageFont.truetype(BOLD,45)
F_REST=ImageFont.truetype(REG,44)
F_FOOT=ImageFont.truetype(REG,18)
INK=(28,46,54)
ACCENT=(27,111,110)
FOOT=(102,116,120)

HEADS={
  1:('HBM','高带宽存储器'),
  2:('DRAM','垂直堆叠'),
  3:('TSV','垂直连接各层芯片'),
  4:('GPU','与八组 HBM'),
}

def clamp(x):return max(0.,min(1.,x))
def quick(x):
    x=clamp(x)
    return 1-(1-x)**3

def typography(im, phase, a=1.0, foot=0):
    if a<=0 and foot<=0:return
    overlay=Image.new('RGBA',im.size,(0,0,0,0))
    d=ImageDraw.Draw(overlay)
    x=82
    baseline=122
    term,rest=HEADS[phase]
    opacity=round(255*clamp(a))
    if opacity:
        d.text((x,baseline),term,font=F_TERM,fill=ACCENT+(opacity,),anchor='ls')
        nx=x+d.textlength(term,font=F_TERM)+18
        d.text((nx,baseline),rest,font=F_REST,fill=INK+(opacity,),anchor='ls')
    if foot:
        fa=round(255*clamp(foot))
        d.text((82,675),'参考 B200 封装布局；堆叠层数为教学简化示意',font=F_FOOT,fill=FOOT+(fa,),anchor='ls')
    im.alpha_composite(overlay)


def early_label(im,phase,t):
    # Titles remain stationary; no bar, running scene numbers, or extra subheadings.
    start=v4.ENDS[phase-1]; end=v4.ENDS[phase]
    entering=quick((t-start)/.22)
    leaving=1 if phase==4 else 1-quick((t-(end-.20))/.20)
    typography(im,phase,entering*leaving)


def final_label(im,t):
    # Camera/package must settle before final title is shown.
    a=quick((t-10.43)/.30)
    foot=quick((t-10.72)/.30)
    typography(im,4,a,foot)

# Patched on the ORIGINAL referenced modules. `make_v8` temporally retimes
# `v7` calls; these hooks receive ORIGINAL scene seconds, not output seconds.
v4.labels=early_label
v7.old.draw_text=final_label

FPS=v8.FPS
N=v8.N

def frame(t): return v8.frame(t)

def stills():
    # Representative moments from scene progression (early title, settled stack,
    # TSV zoom, package reveal, settled final package)
    times=[.66,2.45,3.55,4.95,5.55,7.6,9.15,11.1]
    board=Image.new('RGB',(1280,1440),'#F6F6F4')
    for i,t in enumerate(times):
        img=frame(t)
        img.save(HERE/f'v9_frame_{i+1:02d}.jpg',quality=94)
        board.paste(img.resize((640,360),Image.Resampling.LANCZOS),(i%2*640,i//2*360))
    board.save(HERE/'HBM_v9_storyboard.jpg',quality=94)
    print('still output ready',flush=True)

def video():
    target=HERE/'HBM_v9_silent.mp4'
    writer=imageio.get_writer(str(target),fps=FPS,codec='libx264',output_params=['-pix_fmt','yuv420p','-crf','17','-preset','veryfast'])
    try:
        for i in range(N):
            writer.append_data(np.asarray(frame(i/FPS)))
            if (i+1)%60==0:print(f'frames {i+1}/{N}',flush=True)
    finally:
        writer.close()
    print('video output ready',target,flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--stills',action='store_true');p.add_argument('--video',action='store_true');a=p.parse_args()
    if a.stills:stills()
    if a.video:video()
