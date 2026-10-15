import pathlib, sys, subprocess, zipfile
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.interpolate import PchipInterpolator
import imageio.v2 as imageio

ROOT=pathlib.Path('/mnt/data')
SRC=ROOT/'hbm_v11_src'/'hbm_v8'
sys.path.insert(0,str(SRC))
import make_v11 as prev

# aliases to underlying modules
v8=prev.v8; v7=prev.v7; v4=prev.v4; v3=prev.v3; v5=prev.v5
W,H=v3.W,v3.H
FPS=v8.FPS; N=v8.N; DURATION=N/FPS
OUT=ROOT/'mustard02'; OUT.mkdir(exist_ok=True)

# ---------- look ----------
def make_bg():
    top=(243,238,229); bottom=(231,223,212)
    arr=np.zeros((H,W,4),dtype=np.uint8)
    for y in range(H):
        t=y/(H-1)
        c=[round(top[i]*(1-t)+bottom[i]*t) for i in range(3)]
        arr[y,:,0]=c[0]; arr[y,:,1]=c[1]; arr[y,:,2]=c[2]; arr[y,:,3]=255
    # subtle paper noise
    rng=np.random.default_rng(4242)
    fleck=rng.normal(0,2.0,(H,W,1))
    arr[:,:,:3]=np.clip(arr[:,:,:3].astype(np.float32)+fleck,0,255).astype(np.uint8)
    return Image.fromarray(arr,'RGBA')
v3.BGIMG=make_bg()

ACCENT=(173,59,48)
INK=(26,36,42)
SUB=(96,99,98)
CN_REG='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
CN_BOLD='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
LAT_BOLD='/usr/share/fonts/opentype/inter/Inter-Bold.otf'
F_TAG=ImageFont.truetype(LAT_BOLD,22)
F_TITLE=ImageFont.truetype(CN_BOLD,38,index=2)
F_SUB=ImageFont.truetype(CN_REG,21,index=2)
F_FOOT=ImageFont.truetype(CN_REG,17,index=2)

# ---------- timing ----------
KEYS=[
    (0.00,0.00),
    (0.30,0.38),
    (0.72,0.92),
    (1.08,1.48),
    (1.45,1.88),
    (1.82,2.22),
    (2.14,2.52),
    (2.42,2.84),
    (2.70,3.18),
    (3.05,3.70),
    (3.42,4.25),
    (3.82,4.88),
    (4.16,5.46),
    (4.58,6.05),
    (5.02,6.78),
    (5.48,7.58),
    (5.92,8.25),
    (6.25,8.58),
    (6.72,9.00),
    (7.28,9.45),
    (7.88,9.95),
    (8.52,10.42),
    (9.18,10.84),
    (10.10,11.12),
    (11.50,11.12),
]
F=PchipInterpolator([a for a,b in KEYS],[b for a,b in KEYS])
def new_time(t): return float(F(max(0,min(DURATION,t))))
v7.physical_time=new_time

# faster successive stacking once the first die lands
v4.STARTS=[0.10,1.68,2.05,2.35]
v4.LENGTHS=[0.48,0.34,0.30,0.28]

# ---------- cameras ----------
def clamp(x): return max(0.0,min(1.0,x))
def smooth(x): x=clamp(x); return x*x*(3-2*x)
def tween(t, seq): return v4.tween(t, seq, fn=v4.smooth)

# scene 1-3 hero HBM camera: more decisive push-in, cleaner travel to TSV, brisk pullback

def cam_motion_m2(t):
    zoom=tween(t,[
        (0,84),(.42,108),(1.0,118),(1.55,116),
        (2.15,110),(3.05,106),(4.0,110),
        (4.55,155),(5.15,192),(5.85,196),
        (6.42,168),(7.05,118),(8.25,86)
    ])
    tx=tween(t,[
        (0,v3.HBM_X),(4.30,v3.HBM_X),
        (4.80,v3.HBM_X+.58),(5.85,v3.HBM_X+.58),
        (6.55,v3.HBM_X+.16),(7.05,0),(8.25,0)
    ])
    ty=tween(t,[
        (0,v3.HBM_Y),(4.30,v3.HBM_Y),
        (4.80,v3.HBM_Y+.45),(5.85,v3.HBM_Y+.45),
        (6.55,v3.HBM_Y+.12),(7.05,0),(8.25,0)
    ])
    ax=tween(t,[
        (0,744),(.45,792),(1.0,808),(4.35,816),
        (4.78,936),(5.86,952),
        (6.60,860),(7.05,784),(8.25,748)
    ])
    ay=tween(t,[
        (0,512),(.45,529),(1.0,534),(4.35,534),
        (4.78,552),(5.86,560),
        (6.60,528),(7.05,498),(8.25,470)
    ])
    return v3.Cam(zoom,(tx,ty),(ax,ay))
v4.cam_motion=cam_motion_m2

# final package camera: quicker pullback, clearer centered hold

def cam_package_m2(t):
    s=tween(t,[(8.25,84),(8.85,78),(9.35,72),(10.15,66),(11.12,66)])
    tx=tween(t,[(8.25,v3.HBM_X+.06),(8.80,1.45),(9.35,.85),(10.10,.02),(11.12,.02)])
    ty=tween(t,[(8.25,v3.HBM_Y+.04),(8.80,.06),(9.35,-.02),(10.10,-.08),(11.12,-.08)])
    ax=tween(t,[(8.25,770),(8.85,754),(9.35,742),(10.10,734),(11.12,734)])
    ay=tween(t,[(8.25,515),(8.85,500),(9.35,484),(10.10,470),(11.12,470)])
    return v3.Cam(s,(tx,ty),(ax,ay))
v5.cam=cam_package_m2

# ---------- package reveal choreography ----------
# Keep same physical look for all towers; upgrade only timing / continuity.
old=v7.old

def package_objects_m2(img,cam,ot):
    entities=[]
    # reveal GPU compute dies first, almost together
    for idx,y in enumerate(old.GPU_YS):
        entities.append(dict(kind='gpu',x=old.GPU_CX,y=y,start=8.90+idx*0.06,tag=f'GPU{idx+1}'))

    # wave of HBM stacks: hero becomes standard stack first, then symmetric pairs
    pair_starts={
        # nearest pair on same mid rows
        (old.STACK_LEFT, old.HBM_ROWS[1]):9.22,
        (old.STACK_RIGHT,old.HBM_ROWS[1]):9.28,
        # lower pair
        (old.STACK_LEFT, old.HBM_ROWS[2]):9.42,
        (old.STACK_RIGHT,old.HBM_ROWS[2]):9.48,
        # upper pair
        (old.STACK_LEFT, old.HBM_ROWS[0]):9.62,
        (old.STACK_RIGHT,old.HBM_ROWS[0]):9.68,
        # final far-lower right or remaining one
        (old.STACK_RIGHT,old.HBM_ROWS[3]):9.84,
    }
    for x in [old.STACK_LEFT,old.STACK_RIGHT]:
        for y in old.HBM_ROWS:
            if (x,y)==old.ORIGINAL:
                entities.append(dict(kind='original',x=x,y=y,start=0,tag='HBM-h'))
            else:
                st=pair_starts.get((x,y),9.90)
                entities.append(dict(kind='new',x=x,y=y,start=st,tag=f'HBM-{x:.1f}-{y:.1f}'))

    # depth sort only affects drawing order, not reveal timing
    entities.sort(key=lambda e:(e['x']+e['y'],e['x'],e['tag']))
    for e in entities:
        k,x,y,st=e['kind'],e['x'],e['y'],e['start']
        if k=='gpu':
            v7.v6.gpu_new(img,cam,x,y,ot,st)
        elif k=='new':
            p=old.clamp((ot-st)/0.42)
            vis=old.smooth(p/.34) if p>0 else 0
            land=old.out(p)
            v7.unified_stack(img,cam,x,y,alpha=vis,rise=(1-land)*0.22,shadow_strength=land)
        else:
            blend=old.smooth((ot-8.52)/0.34)
            if blend<0.999:
                layer=Image.new('RGBA',(v3.W,v3.H),(0,0,0,0))
                v4.hbm(layer,cam,ot)
                if blend>0:
                    layer.putalpha(layer.getchannel('A').point(lambda a: round(a*(1-blend))))
                img.alpha_composite(layer)
            if blend>0:
                v7.unified_stack(img,cam,x,y,alpha=blend,rise=0,shadow_strength=1)
    return entities
v7.package_objects_v7=package_objects_m2

# delay support interposer slightly so wide pullback reads cleaner
ORIG_PACKAGE_LAYER=v7.v6.package_layer
def package_layer_m2(img,ca,ot):
    return ORIG_PACKAGE_LAYER(img,ca,ot-0.10)
v7.v6.package_layer=package_layer_m2

# ---------- typography ----------
# override prior text hooks with smaller, non-obstructive layout
HEAD={
    1:('HBM','高带宽存储器','多层 DRAM 紧密堆叠在一起'),
    2:('DRAM','芯片，逐层堆叠','第一层先落位，后续层逐步加快'),
    3:('TSV','垂直通孔，连接各层','切开展示内部导通结构'),
    4:('GPU','八组 HBM，紧邻 GPU 核心','以更短连线换取更高带宽')
}

# minimal editorial text; appears only after camera settles for each phase

def draw_headline(im, scene, opacity=1.0, note=0.0):
    if opacity<=0.001 and note<=0: return
    layer=Image.new('RGBA', im.size, (0,0,0,0))
    d=ImageDraw.Draw(layer)
    a=round(255*clamp(opacity))
    x=84; y=74
    term,title,sub=HEAD[scene]
    d.text((x,y), term, font=F_TAG, fill=ACCENT+(a,), anchor='ls')
    d.text((x,y+42), title, font=F_TITLE, fill=INK+(a,), anchor='ls')
    d.text((x,y+82), sub, font=F_SUB, fill=SUB+(round(220*opacity),), anchor='ls')
    if note>0:
        d.text((84,H-36), '封装布局参考 B200 · 层数为结构示意', font=F_FOOT,
               fill=SUB+(round(255*clamp(note)),), anchor='ls')
    im.alpha_composite(layer)

# V4 scene timing boundaries in original time

def label_scene(im, scene, ot):
    st=v4.ENDS[scene-1]; en=v4.ENDS[scene]
    # wait until main movement mostly completes, then reveal text
    intro_offsets={1:0.52,2:0.55,3:0.60,4:0.85}
    outro=.18 if scene!=4 else 0.0
    vis=smooth((ot-(st+intro_offsets[scene]))/0.25)
    if scene!=4:
        vis*=1-smooth((ot-(en-outro))/0.18)
    note=smooth((ot-10.55)/0.24) if scene==4 else 0.0
    draw_headline(im, scene, vis, note)

v4.labels=label_scene
v5.draw_text=lambda im,ot: draw_headline(im,4,smooth((ot-10.10)/0.24), smooth((ot-10.56)/0.24))

# ---------- light finish ----------
def finish(im, idx):
    arr=np.array(im).astype(np.int16)
    yy,xx=np.mgrid[0:H,0:W]
    cx,cy=W/2,H/2
    r=np.sqrt(((xx-cx)/(W*0.68))**2+((yy-cy)/(H*0.84))**2)
    vig=np.clip((r-0.60)/0.60,0,1)
    arr[:,:,:3]=np.clip(arr[:,:,:3]*(1-0.04*vig[...,None]),0,255)
    rng=np.random.default_rng(idx+77)
    noise=rng.normal(0,1.8,(H,W,1))
    arr[:,:,:3]=np.clip(arr[:,:,:3]+noise,0,255)
    return Image.fromarray(arr.astype(np.uint8),'RGBA').convert('RGB')

# ---------- render ----------
def frame(t, idx=None):
    im=v8.frame(t).convert('RGBA')
    return finish(im, int(t*FPS if idx is None else idx))

STILLS=[0.55,2.20,3.55,4.85,5.65,7.25,9.15,11.05]


def render_stills():
    board=Image.new('RGB',(1280,1440),'#EFE9E0')
    for i,t in enumerate(STILLS):
        im=frame(t,i)
        im.save(OUT/f'frame_{i+1:02d}.jpg', quality=95)
        board.paste(im.resize((640,360),Image.Resampling.LANCZOS), ((i%2)*640,(i//2)*360))
    board.save(OUT/'HBM_Mustard-02_storyboard.jpg', quality=95)


def render_video():
    silent=OUT/'HBM_Mustard-02_silent.mp4'
    writer=imageio.get_writer(str(silent), fps=FPS, codec='libx264', output_params=['-pix_fmt','yuv420p','-crf','17','-preset','veryfast'])
    try:
        for i in range(N):
            writer.append_data(np.asarray(frame(i/FPS, i)))
            if (i+1)%60==0:
                print(f'frames {i+1}/{N}', flush=True)
    finally:
        writer.close()
    final=OUT/'HBM_Mustard-02.mp4'
    audio=ROOT/'mustard01'/'audio.aac'
    if not audio.exists():
        subprocess.run(['ffmpeg','-y','-i',str(ROOT/'HBM_11_5s_v11_Sans_Refined.mp4'),'-vn','-acodec','copy',str(audio)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(['ffmpeg','-y','-i',str(silent),'-i',str(audio),'-c:v','copy','-c:a','aac','-shortest',str(final)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return final


def package_src():
    with zipfile.ZipFile(OUT/'HBM_Mustard-02_source.zip','w',zipfile.ZIP_DEFLATED) as z:
        z.write(__file__, arcname='make_mustard02.py')

if __name__=='__main__':
    render_stills()
    render_video()
    package_src()


def render_video_cv():
    import cv2
    silent=OUT/'HBM_Mustard-02_silent_cv.mp4'
    writer=cv2.VideoWriter(str(silent), cv2.VideoWriter_fourcc(*'mp4v'), FPS, (W,H))
    try:
        for i in range(N):
            im=np.asarray(frame(i/FPS, i))
            writer.write(cv2.cvtColor(im, cv2.COLOR_RGB2BGR))
            if (i+1)%60==0:
                print(f"cv frames {i+1}/{N}", flush=True)
    finally:
        writer.release()
    final=OUT/'HBM_Mustard-02.mp4'
    audio=ROOT/'mustard01'/'audio.aac'
    import subprocess
    subprocess.run(['ffmpeg','-y','-i',str(silent),'-i',str(audio),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','medium','-c:a','aac','-shortest',str(final)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    return final
