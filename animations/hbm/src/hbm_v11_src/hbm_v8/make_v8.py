"""HBM v8 — decisive timing and explicit inspection holds.
Uses unchanged v7 physical model and one fixed 2:1 axonometric projector.
Unlike v7, time is NOT independently smooth-stepped at 20 micro-intervals.
Whole choreography is mapped with monotone C1 interpolation with fewer anchors.
"""
import sys, pathlib, argparse, numpy as np
from PIL import Image
from scipy.interpolate import PchipInterpolator
import imageio.v2 as imageio
HERE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/'hbm_v7'))
import make_v7 as v7
FPS=30;DURATION=11.5;N=int(FPS*DURATION)
# New seconds versus original scene seconds. Three purposeful settles: stack, TSV, final.
KEYS=[
 (0.00,0.00),(.34,.55),(.81,1.38),
 (1.25,1.72),(1.78,2.35),(2.36,3.02),(2.76,3.58),
 (3.24,4.58),(3.58,4.75), # show finished stack, no extra eases
 (3.93,5.35),(4.42,5.98),(4.99,6.76),(5.54,7.70),
 (5.90,8.25),
 (6.27,8.78),(6.83,9.49),(7.58,10.27),
 (8.32,10.95),(8.80,11.12),
 (11.50,11.12), # deliberate uninterrupted final hold
]
assert all(a[0]<b[0] for a,b in zip(KEYS,KEYS[1:]))
assert all(a[1]<=b[1] for a,b in zip(KEYS,KEYS[1:]))
F=PchipInterpolator([a for a,b in KEYS],[b for a,b in KEYS])

def new_time(t):return float(F(max(0,min(DURATION,t))))
v7.physical_time=new_time
# V7 showed the section heading underneath giant GPU geometry while the
# camera was travelling. Only reveal the caption once the wide shot settles.
_original_package_caption=v7.old.draw_text

def delayed_package_caption(im, ot):
    if ot<10.40:return
    fade=max(0,min(1,(ot-10.40)/.64))
    overlay=Image.new('RGBA',im.size,(0,0,0,0))
    _original_package_caption(overlay,ot)
    if fade<1:
        overlay.putalpha(overlay.getchannel('A').point(lambda a:round(a*fade)))
    im.alpha_composite(overlay)

v7.old.draw_text=delayed_package_caption

def frame(t):return v7.render(t)

def stills():
    moments=[.77,2.52,3.54,4.72,5.52,7.38,9.14,11.1]
    out=Image.new('RGB',(1280,1440),'white')
    for i,t in enumerate(moments):
        im=frame(t)
        im.save(HERE/f'frame_{i+1:02d}.jpg',quality=93)
        out.paste(im.resize((640,360),Image.Resampling.LANCZOS),((i%2)*640,(i//2)*360))
    out.save(HERE/'HBM_v8_storyboard.jpg',quality=94)
    print('Keyframe storyboard written.',flush=True)

def video():
    path=HERE/'HBM_v8_silent.mp4'
    writer=imageio.get_writer(str(path),fps=FPS,codec='libx264',output_params=['-pix_fmt','yuv420p','-crf','17','-preset','veryfast'])
    try:
        previous_time=None;previous_frame=None
        for i in range(N):
            t=i/FPS
            ot=new_time(t)
            if previous_time is not None and abs(ot-previous_time)<1e-9:
                image=previous_frame
            else:
                image=np.asarray(frame(t)); previous_frame=image; previous_time=ot
            writer.append_data(image)
            if (i+1)%60==0:print(f'video frames {i+1}/{N}',flush=True)
    finally:writer.close()
    print('Video written.',path,flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--stills',action='store_true');p.add_argument('--video',action='store_true');a=p.parse_args()
    if a.stills:stills()
    if a.video:video()
