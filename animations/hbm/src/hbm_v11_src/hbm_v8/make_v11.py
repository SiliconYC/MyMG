"""HBM V11 — rebuild FROM V9, not V10.
Editorial typography follows IBM's typography/spacing/alignment guidance:
consistent left-aligned two-level hierarchy, reserved negative space, art-first.
Uses existing V9 models, timing, sound. Fixed 2:1 orthographic projection.
Only typography and camera's scale/translation are adjusted.
"""
import argparse, pathlib, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio.v2 as imageio

HERE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import make_v9 as base
v8=base.v8; v7=base.v7; v4=base.v4; v3=base.v3; v5=v7.old
W,H=v3.W,v3.H
R='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
B='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
# Index 2 is SC in Noto Sans CJK collection. Both are OFL released.
F_LABEL=ImageFont.truetype(B,21,index=2)
F_TITLE=ImageFont.truetype(R,49,index=2)
F_NOTE=ImageFont.truetype(R,17,index=2)
ACCENT=(40,112,110)
INK=(34,53,59)
SECONDARY=(110,124,126)
HEAD={
 1:('HBM','高带宽存储器'),
 2:('DRAM','芯片，逐层堆叠'),
 3:('TSV','垂直通孔，连接各层'),
 4:('GPU','八组 HBM，紧邻核心'),
}

def clamp(x):return min(1.,max(0.,x))
def ease(x):x=clamp(x);return x*x*(3-2*x)
def over(x,keys):return v4.tween(x,keys,fn=v4.smooth)

# The same azimuth/elevation, isometric scale and world coordinates as V9.
# Composer places the HBM at screen center, below a reserved two-line title band.
# All changes interpolated in ORIGINAL stage time (v8 remaps output clock).
ORIG_CAM=v4.cam_motion

def cam_balanced(t):
    original=ORIG_CAM(t)
    # Keep lens changes restrained, especially prevent TSV from spilling off screen.
    multiplier=over(t,[(0,1.06),(.62,1.14),(1.5,1.14),(2.0,1.18),
                       (4.90,1.20),(5.80,.84),(8.25,.84)])
    x=over(t,[(0,710),(.62,706),(4.9,706),(5.8,790),(8.25,790)])
    y=over(t,[(0,515),(.7,508),(4.90,510),(5.8,540),(8.25,540)])
    return v3.Cam(original.s*multiplier,original.target,(x,y))

v4.cam_motion=cam_balanced

# The v9 final package is already readable and coherent. Avoid v10's camera.
# Only trim a little empty space beneath the package, without changing lens scale.
ORIG_PACKAGE_CAM=v5.cam

def cam_package_balanced(t):
    original=ORIG_PACKAGE_CAM(t) # interpolate from balanced at 8.25 by v5 internals
    u=ease((t-8.25)/(10.38-8.25))
    return v3.Cam(original.s,original.target,
                  (original.anchor[0]-10*u,original.anchor[1]-16*u))
v5.cam=cam_package_balanced

# The V9 package reveal was visually busy while the camera was still tight.
# Let the hero tower remain the single subject during pullback. Once the
# package mostly fits, bring in the other chips quickly in true depth order.
ORIGINAL_PACKAGE_LAYER=v7.v6.package_layer
def restrained_interposer(img,ca,ot):
    return ORIGINAL_PACKAGE_LAYER(img,ca,ot-.27)
v7.v6.package_layer=restrained_interposer

def package_objects_reveal(img,ca,ot):
    old=v7.old
    entities=[]
    if ot>=9.65:
        for idx,y in enumerate(old.GPU_YS):
            entities.append(dict(kind='gpu',x=old.GPU_CX,y=y,start=9.75+idx*.10,tag=f'GPU{idx+1}'))
    count=0
    for x in [old.STACK_LEFT,old.STACK_RIGHT]:
        for y in old.HBM_ROWS:
            if (x,y)==old.ORIGINAL:
                entities.append(dict(kind='original',x=x,y=y,start=0,tag='HBM-h'))
            else:
                entities.append(dict(kind='new',x=x,y=y,start=9.78+.058*count,tag=f'HBM{count+1}'))
                count+=1
    entities.sort(key=lambda e:(e['x']+e['y'],e['x'],e['tag']))
    for e in entities:
        k,x,y,st=e['kind'],e['x'],e['y'],e['start']
        if k=='gpu':
            v7.v6.gpu_new(img,ca,x,y,ot,st)
        elif k=='new':
            p=old.clamp((ot-st)/.54)
            vis=old.smooth(p/.52) if p>0 else 0
            land=old.out(p)
            v7.unified_stack(img,ca,x,y,alpha=vis,rise=(1-land)*.29,shadow_strength=land)
        else:
            blend=old.smooth((ot-8.65)/.57)
            if blend<.9999:
                layer=Image.new('RGBA',(v3.W,v3.H),(0,0,0,0))
                v4.hbm(layer,ca,ot)
                if blend>0:
                    layer.putalpha(layer.getchannel('A').point(lambda a:round(a*(1-blend))))
                img.alpha_composite(layer)
            if blend>0:
                v7.unified_stack(img,ca,x,y,alpha=blend,rise=0,shadow_strength=1)
    return entities
v7.package_objects_v7=package_objects_reveal

# Turn off v9 inline typography using hook overrides, no resampling or masking.
def headline(im,scene,opacity=1, note=0):
    if opacity <= .001 and note<=0:return
    layer=Image.new('RGBA',im.size,(0,0,0,0)); d=ImageDraw.Draw(layer)
    a=round(255*clamp(opacity));x=86
    term,title=HEAD[scene]
    d.text((x,79),term,font=F_LABEL,fill=ACCENT+(a,),anchor='ls')
    d.text((x,154),title,font=F_TITLE,fill=INK+(a,),anchor='ls')
    if note>0:
        d.text((x,695),'封装参考 B200 · 存储层数为结构示意',font=F_NOTE,
               fill=SECONDARY+(round(255*clamp(note)),),anchor='ls')
    im.alpha_composite(layer)

def title_early(im,scene,ot):
    st=v4.ENDS[scene-1];end=v4.ENDS[scene]
    vis=ease((ot-st)/.24)
    if scene!=4:vis*=1-ease((ot-(end-.17))/.17)
    headline(im,scene,vis)

def title_final(im,ot):
    # Prevent text moving together with very large packaging transition.
    vis=ease((ot-10.38)/.26)
    note=ease((ot-10.74)/.28)
    headline(im,4,vis,note)

v4.labels=title_early
v5.draw_text=title_final
FPS=v8.FPS;N=v8.N

def frame(t):return v8.frame(t)

STILL_TIMES=[.66,2.45,3.55,4.95,5.55,7.6,9.15,11.1]

def stills():
    folder=pathlib.Path('/mnt/data/hbm_v11');folder.mkdir(exist_ok=True)
    board=Image.new('RGB',(1280,1440),'#F4F5F3')
    for i,t in enumerate(STILL_TIMES):
        im=frame(t);im.save(folder/f'frame_{i+1:02d}.jpg',quality=95)
        board.paste(im.resize((640,360),Image.Resampling.LANCZOS),((i%2)*640,(i//2)*360))
    board.save(folder/'HBM_v11_storyboard.jpg',quality=95)
    print('stills complete',flush=True)

def video():
    target='/mnt/data/hbm_v11/HBM_v11_silent.mp4'
    wr=imageio.get_writer(target,fps=FPS,codec='libx264',output_params=['-pix_fmt','yuv420p','-crf','17','-preset','veryfast'])
    try:
        for i in range(N):
            wr.append_data(np.array(frame(i/FPS)))
            if (i+1)%60==0:print('rendered',i+1,'/',N,flush=True)
    finally:wr.close()
    print('video complete',target)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--stills',action='store_true');p.add_argument('--video',action='store_true');a=p.parse_args()
    if a.stills:stills()
    if a.video:video()
