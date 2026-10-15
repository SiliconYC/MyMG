"""Mustard-03: clean 3D-native compositing, fixed axonometric camera holds,
proper reading windows, no screen-space scale transforms.
Run from this repository; dependencies are in src/hbm_v11_src.
"""
import sys, pathlib, numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.interpolate import PchipInterpolator
SRCROOT=pathlib.Path(__file__).resolve().parent/'hbm_v11_src'
sys.path.insert(0, str(SRCROOT/'hbm_v8'))
import make_v11 as ref
v8=ref.v8;v7=ref.v7;v4=ref.v4;v5=ref.v5;v3=ref.v3
W,H=1280,720
FPS=30;FRAMES=345
DIR=pathlib.Path(__file__).resolve().parent.parent/'output';DIR.mkdir(parents=True,exist_ok=True)

# Preserve the proven single orthographic projection. Background only.
def background():
    a=np.empty((H,W,4),dtype=np.uint8)
    c0=(244,240,231);c1=(232,226,217)
    for y in range(H):
        p=y/(H-1)
        for i in range(3):a[y,:,i]=round(c0[i]*(1-p)+c1[i]*p)
        a[y,:,3]=255
    return Image.fromarray(a,'RGBA')
v3.BGIMG=background()

# Physical model time follows only four scene changes; no dozens of sub-eases.
OUTT=[0.,2.25,4.85,7.45,9.70,11.50]
ORIG=[0.,1.50,4.90,8.25,10.82,11.12]
def model_time(t):
    if t>=11.50:return 11.12
    for i in range(len(OUTT)-1):
        if OUTT[i]<=t<=OUTT[i+1]:
            p=(t-OUTT[i])/(OUTT[i+1]-OUTT[i])
            return ORIG[i] + (ORIG[i+1]-ORIG[i])*p
    return 0.0
v7.physical_time=model_time
# stagger: faster later layers, without bounce
v4.STARTS=[.10,1.72,2.18,2.48]
v4.LENGTHS=[.38,.34,.28,.25]

def clamp(x):return max(0.0,min(1.0,x))
def sm(x):x=clamp(x);return x*x*(3-2*x)
def p3(a,b,t):return a+(b-a)*t

# Distinct camera states separated by two purposeful moves. No camera wander.
STUDIO=dict(s=118.,tx=v3.HBM_X,ty=v3.HBM_Y,ax=770.,ay=490.)
MACRO=dict(s=172.,tx=v3.HBM_X+.32,ty=v3.HBM_Y+.22,ax=875.,ay=535.)
WIDE=dict(s=43.,tx=-2.35,ty=.63,ax=650.,ay=443.)
def cblend(a,b,k):
    return {q:p3(a[q],b[q],k) for q in a}
def camera_hero(ot):
    if ot<4.92:d=STUDIO
    elif ot<5.58:d=cblend(STUDIO,MACRO,sm((ot-4.92)/.66))
    elif ot<7.48:d=MACRO
    elif ot<8.25:d=cblend(MACRO,STUDIO,sm((ot-7.48)/.77))
    else:d=STUDIO
    return v3.Cam(d['s'],(d['tx'],d['ty']),(d['ax'],d['ay']))
def camera_package(ot):
    if ot<8.26:d=STUDIO
    elif ot<9.55:d=cblend(STUDIO,WIDE,sm((ot-8.26)/(9.55-8.26)))
    else:d=WIDE
    return v3.Cam(d['s'],(d['tx'],d['ty']),(d['ax'],d['ay']))
v4.cam_motion=camera_hero
v5.cam=camera_package

# Remove ALL inherited text before drawing geometry, never cover 3D with a card.
v4.labels=lambda im,scene,ot: None
v5.draw_text=lambda im,ot: None


# Finish the TSV cutaway BEFORE the wide shot begins. This keeps the model
# solid throughout the reveal (no transparent ghost crossfade).
ORIGINAL_HBM=v4.hbm
def hbm_close_cutaway(img,cam,ot):
    accelerated=ot+0.72*sm((ot-7.57)/.68) if ot>7.57 else ot
    return ORIGINAL_HBM(img,cam,accelerated)
v4.hbm=hbm_close_cutaway

# Choreography: reveal GPU together followed by HBM pairs; one shared render function.
old=v7.old
PAIR_ST=[9.63,9.68,9.73,9.78,9.83,9.88,9.93]
OTHER=[(x,y) for x in [old.STACK_LEFT,old.STACK_RIGHT] for y in old.HBM_ROWS if (x,y)!=old.ORIGINAL]
OTHER.sort(key=lambda xy:(abs(xy[1]-.63),0 if xy[0]==old.STACK_RIGHT else 1,xy[1]))
STARTMAP=dict(zip(OTHER,PAIR_ST))
def package_objects(img,ca,ot):
    entities=[('gpu',old.GPU_CX,y,9.43+i*.055) for i,y in enumerate(old.GPU_YS)]
    for x in [old.STACK_LEFT,old.STACK_RIGHT]:
        for y in old.HBM_ROWS:
            entities.append(('hero' if (x,y)==old.ORIGINAL else 'stack',x,y,STARTMAP.get((x,y),0)))
    entities.sort(key=lambda e:(e[1]+e[2],e[1],e[0]))
    for kind,x,y,st in entities:
        if kind=='gpu':
            v7.v6.gpu_new(img,ca,x,y,ot,st)
        elif kind=='stack':
            p=clamp((ot-st)/.47)
            # stable simultaneous opacity/descent
            enter=sm(p)
            v7.unified_stack(img,ca,x,y,alpha=enter,rise=(1-enter)*.20,shadow_strength=enter)
        else:
            # The same world-space tower switches to the shared final mesh
            # without translucent double-rendering.
            v7.unified_stack(img,ca,x,y,alpha=1.0,rise=0,shadow_strength=1)
    return entities
v7.package_objects_v7=package_objects

# Bring the common substrate in before the other dies, so no objects float
# ungrounded for several frames. Same old, physically routed interposer mesh.
def package_support(img,ca,ot):
    visibility=sm((ot-9.23)/.70)
    if visibility<=0:return
    layer=Image.new('RGBA',(W,H),(0,0,0,0))
    v5.draw_interposer(layer,ca,ot)
    if visibility<1:
        layer.putalpha(layer.getchannel('A').point(lambda a:round(a*visibility)))
    img.alpha_composite(layer)
v7.v6.package_layer=package_support


# ---- type system: anchored title always on clear background. ----
FONT_CN='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
FONT_CNB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
FONT_EN='/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
if not pathlib.Path(FONT_EN).exists(): FONT_EN='/usr/share/fonts/opentype/inter/Inter-Bold.otf'
F_TERM=ImageFont.truetype(FONT_EN,25)
F_TITLE=ImageFont.truetype(FONT_CNB,39,index=2)
F_SUB=ImageFont.truetype(FONT_CN,21,index=2)
F_NOTE=ImageFont.truetype(FONT_CN,17,index=2)
INK=(38,44,48);RED=(171,65,53);SOFT=(101,104,103)
HEADS=[
 ('HBM','高带宽存储器','把内存芯片垂直堆叠'),
 ('DRAM','芯片，逐层堆叠','由单片变成多层结构'),
 ('TSV','垂直通孔，连接各层','细看晶片内部的铜连接'),
 ('GPU','八组 HBM，环绕核心','共同构成高速存储封装')
]
SCENE_BOUNDS=[0,2.25,4.85,7.45,11.50]

def title_scene(t):
    if t<2.25:return 0
    if t<4.85:return 1
    if t<7.45:return 2
    return 3

def typography(im,t):
    i=title_scene(t)
    start=SCENE_BOUNDS[i]
    end=SCENE_BOUNDS[i+1]
    # First title is visible almost from frame 1, readable for ~2 seconds;
    # all next titles get at least ~2.1 seconds of legibility.
    a=sm((t-start+.015)/.18)
    if i<3:
        a*=1-sm((t-(end-.17))/.17)
    else:
        a*=sm((t-8.70)/.24)
    if a<=0.001:return
    layer=Image.new('RGBA',(W,H),(0,0,0,0))
    d=ImageDraw.Draw(layer,'RGBA')
    x=68;y=61
    term,title,sub=HEADS[i]
    # Letterforms remain above the physical illustration; a compact translucent
    # panel is used ONLY where projection approaches the type safe-zone.
    if i in [2,3]:
        alpha=int(178*a)
        d.rounded_rectangle((48,36,580 if i==2 else 485,187),radius=13,
                             fill=(246,242,234,alpha))
    ta=int(255*a)
    d.text((x,y),term,font=F_TERM,fill=RED+(ta,),anchor='lt')
    d.text((x,y+34),title,font=F_TITLE,fill=INK+(ta,),anchor='lt')
    d.text((x,y+90),sub,font=F_SUB,fill=SOFT+(ta,),anchor='lt')
    if i==3 and t>10.35:
        na=int(180*sm((t-10.35)/.25))
        d.text((70,685),'布局参考 B200 · 存储堆叠层数为示意',font=F_NOTE,fill=SOFT+(na,),anchor='ls')
    im.alpha_composite(layer)

def render(t):
    # v8.frame delegates into the physically rendered geometry. Text is created
    # after it, without re-sampling/upscaling the raster frames.
    im=v8.frame(t).convert('RGBA')
    typography(im,t)
    return im.convert('RGB')

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--stills',action='store_true');p.add_argument('--range',nargs=2,type=int);p.add_argument('--out');a=p.parse_args()
    if a.stills:
        times=[.55,1.45,2.85,4.30,5.50,6.65,7.75,8.45,9.10,9.85,10.55,11.20]
        board=Image.new('RGB',(1280,2160),'#EEEAE1')
        for i,t in enumerate(times):
            f=render(t)
            f.save(DIR/f'key_{i+1:02d}.jpg',quality=94)
            board.paste(f.resize((640,360),Image.Resampling.LANCZOS),((i%2)*640,(i//2)*360))
        board.save(DIR/'HBM_Mustard-03_storyboard.jpg',quality=94)
    if a.range:
        import cv2
        st,en=a.range
        fn=pathlib.Path(a.out or str(DIR/f'segment_{st:03d}.mp4'))
        vw=cv2.VideoWriter(str(fn),cv2.VideoWriter_fourcc(*'mp4v'),FPS,(W,H))
        for j in range(st,en):
            f=np.asarray(render(j/FPS))
            vw.write(cv2.cvtColor(f,cv2.COLOR_RGB2BGR))
        vw.release()
        print(str(fn),st,en)
