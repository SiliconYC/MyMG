import pathlib, subprocess, zipfile, cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W,H=1280,720
OUT=pathlib.Path('/mnt/data/mustard01')
OUT.mkdir(exist_ok=True)
SRC_VIDEO='/mnt/data/HBM_11_5s_v11_Sans_Refined.mp4'
SRC_AUDIO=OUT/'audio.aac'

BG=(241,236,226)
BG2=(233,225,214)
INK=(28,36,41)
ACCENT=(176,58,47)
FOOT=(95,98,96)
TAGTXT=(247,242,236)

CN_REG='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
CN_BOLD='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
LAT_BOLD='/usr/share/fonts/opentype/inter/Inter-Bold.otf'
F_LABEL=ImageFont.truetype(LAT_BOLD,28)
F_TITLE=ImageFont.truetype(CN_BOLD,52,index=2)
F_BODY=ImageFont.truetype(CN_REG,24,index=2)
F_FOOT=ImageFont.truetype(CN_REG,18,index=2)

SCENES=[
    dict(start=0.0,end=1.65,label='HBM',title='高带宽存储器',sub='将多层 DRAM 紧密堆叠在一起',boxw=90,
         zoom=((0.0,1.04,30,8),(1.65,1.13,-8,20))),
    dict(start=1.65,end=4.10,label='DRAM',title='芯片，逐层堆叠',sub='先看到单片，再理解完整堆叠',boxw=108,
         zoom=((1.65,1.07,18,8),(4.10,1.15,-22,24))),
    dict(start=4.10,end=6.55,label='TSV',title='垂直通孔，连接各层',sub='局部切开展示内部导通结构',boxw=86,
         zoom=((4.10,1.05,45,70),(5.25,1.10,80,98),(6.55,1.09,75,90))),
    dict(start=6.55,end=11.50,label='GPU',title='八组 HBM，紧邻 GPU 核心',sub='现代高端 GPU 通常搭配多组 HBM',boxw=92,
         zoom=((6.55,0.98,0,8),(8.6,1.06,0,14),(11.50,1.06,0,14))),
]

def clamp(x): return max(0.0,min(1.0,x))
def ease(x): x=clamp(x); return x*x*(3-2*x)

def scene_for_t(t):
    for i,s in enumerate(SCENES):
        if s['start']<=t<s['end'] or (i==len(SCENES)-1 and t<=s['end']):
            return s, i+1
    return SCENES[-1], 4

def interp(t, keys):
    if t<=keys[0][0]: return keys[0][1:]
    if t>=keys[-1][0]: return keys[-1][1:]
    for (t0,*a),(t1,*b) in zip(keys, keys[1:]):
        if t0<=t<=t1:
            u=ease((t-t0)/(t1-t0))
            return tuple(a[i]+(b[i]-a[i])*u for i in range(len(a)))
    return keys[-1][1:]

# precompute background + finish layers
BGARR=np.zeros((H,W,3),dtype=np.uint8)
for y in range(H):
    tt=y/(H-1)
    c=[round(BG[i]*(1-tt)+BG2[i]*tt) for i in range(3)]
    BGARR[y,:,:]=c
YY,XX=np.mgrid[0:H,0:W]
R=np.sqrt(((XX-W/2)/(W*0.62))**2 + ((YY-H/2)/(H*0.80))**2)
VIG=np.clip((R-0.55)/0.65,0,1).astype(np.float32)
RNG=np.random.default_rng(2026)
GRAIN=RNG.normal(0,3.0,(H,W,1)).astype(np.float32)

STILL_TIMES=[0.6,2.3,4.2,5.8,7.0,8.4,9.8,11.1]

def process_frame(frame_rgb, t):
    # digital transform using cv2
    s,dx,dy=interp(t, scene_for_t(t)[0]['zoom'])
    nw,nh=int(round(W*s)), int(round(H*s))
    resized=cv2.resize(frame_rgb, (nw,nh), interpolation=cv2.INTER_LANCZOS4)
    canvas=BGARR.copy()
    x=(W-nw)//2 + int(round(dx)); y=(H-nh)//2 + int(round(dy))
    # paste with clipping
    x0=max(0,x); y0=max(0,y); x1=min(W,x+nw); y1=min(H,y+nh)
    sx0=max(0,-x); sy0=max(0,-y); sx1=sx0+(x1-x0); sy1=sy0+(y1-y0)
    if x1>x0 and y1>y0:
        canvas[y0:y1,x0:x1]=resized[sy0:sy1,sx0:sx1]

    # PIL overlay for cover + text
    im=Image.fromarray(canvas)
    draw=ImageDraw.Draw(im,'RGBA')
    sdef,idx=scene_for_t(t)
    draw.rectangle((0,0,890 if idx!=3 else 1000,245), fill=BG+(255,))
    if idx==4:
        draw.rectangle((0,670,W,H), fill=BG+(255,))

    a=ease((t-sdef['start'])/0.24)
    if t>sdef['end']-0.18:
        a*=1-ease((t-(sdef['end']-0.18))/0.18)
    a=clamp(a)
    if a>0:
        x,y=82,64
        draw.rounded_rectangle((52,40,710,227), radius=8, fill=(253,249,242,255))
        draw.rounded_rectangle((x,y,x+sdef['boxw'],y+34), radius=5, fill=ACCENT+(int(235*a),))
        draw.text((x+sdef['boxw']/2,y+17), sdef['label'], font=F_LABEL, fill=TAGTXT+(int(255*a),), anchor='mm')
        draw.text((x,y+65), sdef['title'], font=F_TITLE, fill=INK+(int(255*a),), anchor='lt')
        draw.text((x,y+131), sdef['sub'], font=F_BODY, fill=(80,86,86,int(215*a)), anchor='lt')
    if idx==4:
        fa=clamp((t-10.45)/0.35)
        if fa>0:
            draw.text((W-88,H-36), '封装布局参考 B200 · 层数为结构示意', font=F_FOOT,
                      fill=FOOT+(int(255*fa),), anchor='rs')
    arr=np.array(im).astype(np.float32)
    arr *= (1-0.06*VIG[...,None])
    arr += GRAIN
    return np.clip(arr,0,255).astype(np.uint8)


def render():
    if not SRC_AUDIO.exists():
        subprocess.run(['ffmpeg','-y','-i',SRC_VIDEO,'-vn','-acodec','copy',str(SRC_AUDIO)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    cap=cv2.VideoCapture(SRC_VIDEO)
    fps=cap.get(cv2.CAP_PROP_FPS) or 30.0
    total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    silent=OUT/'HBM_Mustard-01_silent_fast.mp4'
    writer=cv2.VideoWriter(str(silent), cv2.VideoWriter_fourcc(*'mp4v'), fps, (W,H))
    board=Image.new('RGB',(1280,1440),'#F0EBE3')
    next_still=0
    i=0
    while True:
        ok, frame=cap.read()
        if not ok:
            break
        frame_rgb=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        t=i/fps
        out=process_frame(frame_rgb,t)
        writer.write(cv2.cvtColor(out, cv2.COLOR_RGB2BGR))
        if next_still<len(STILL_TIMES) and t>=STILL_TIMES[next_still]-1e-6:
            img=Image.fromarray(out)
            img.save(OUT/f'frame_{next_still+1:02d}.jpg', quality=94)
            board.paste(img.resize((640,360), Image.Resampling.LANCZOS), ((next_still%2)*640,(next_still//2)*360))
            next_still+=1
        i+=1
        if i%90==0:
            print('frame', i, '/', total, flush=True)
    writer.release(); cap.release()
    board.save(OUT/'HBM_Mustard-01_storyboard.jpg', quality=95)
    final=OUT/'HBM_Mustard-01.mp4'
    subprocess.run(['ffmpeg','-y','-i',str(silent),'-i',str(SRC_AUDIO),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','medium','-c:a','aac','-shortest',str(final)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    return final

def package_source():
    with zipfile.ZipFile(OUT/'HBM_Mustard-01_source.zip','w',zipfile.ZIP_DEFLATED) as z:
        z.write(__file__, arcname='make_mustard01_cv.py')

if __name__=='__main__':
    print(render())
    package_source()
