"""HBM V7: paced move/settle, homogeneous 8 HBM stacks, fixed orthographic camera.
All stacks are drawn by the exact same function. The hero stack changes from
its explanatory cutaway to the common physical model during the zoom-out.
No animated camera rotation. Original v6 3D modelling used as base.
"""
import sys, math, argparse, pathlib, time
from PIL import Image, ImageDraw
import numpy as np
import imageio.v2 as imageio
HERE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/'hbm_v6'))
import make_v6 as v6
old=v6.old; v4=v6.v4; v3=v6.v3
FPS=30
DURATION=13.0
TOTAL=int(DURATION*FPS)

# IMPORTANT: slow first element, increasingly quick following stack installations.
# in v4 reference seconds; all are converted to the new timeline below.
v4.STARTS[:]=[.10,1.95,2.92,3.48]
v4.LENGTHS[:]=[.51,.56,.39,.27]

# Sculpted motion: deliberate holds (frozen camera and objects) after each reveal.
# (new seconds, original model seconds)
KEYS=[(0,0),(.75,1.22),(1.33,1.48),(1.65,1.65),
      (2.23,2.57),(2.74,3.18),(3.22,3.75),
      (3.75,4.67),(4.40,4.72),
      (4.85,4.96),(5.56,5.96),(6.35,6.68),
      (6.85,7.19),(7.70,7.73),
      (8.06,8.17),(8.94,9.31),(10.06,10.55),
      (10.72,11.12),(12.96,11.13),(13.0,11.13)]
# last packet: static 2.24s except a single short data pulse triggered below

def smoother(x):
    x=max(0.,min(1.,x));return x*x*(3-2*x)

def physical_time(t):
    if t<=KEYS[0][0]:return KEYS[0][1]
    for (ta,va),(tb,vb) in zip(KEYS,KEYS[1:]):
        if t<=tb:
            u=(t-ta)/(tb-ta)
            # global smoothstep is used only on each major choreography segment;
            # each interval goes to rest before next cue begins.
            return va+(vb-va)*smoother(u)
    return KEYS[-1][1]


def colorize(hexcol,a=255):
    return v6.rgba(hexcol,a)


def unified_stack(img,cam,x,y,alpha=1.,rise=0.,shadow_strength=.72):
    """All eight stacks, including hero, share exactly this one mesh/decoration function."""
    if alpha<=0:return
    layer=Image.new('RGBA',(v3.W,v3.H),(0,0,0,0))
    d=ImageDraw.Draw(layer,'RGBA')
    a=int(255*alpha)
    zshift=rise
    bx=v3.DIE_SX;by=v3.DIE_SY
    # continuous shadow fade: base contact, not a sudden new object
    poly=[(x-bx/2,y-by/2,v3.BASE_Z-.052),(x+bx/2,y-by/2,v3.BASE_Z-.052),
          (x+bx/2,y+by/2,v3.BASE_Z-.052),(x-bx/2,y+by/2,v3.BASE_Z-.052)]
    v3.poly(d,cam,poly,(29,56,58,round(57*alpha*shadow_strength)))
    def faces(sx,sy,z,h,top,fx,fy,lw=1):
        x0=x-sx/2;x1=x+sx/2;y0=y-sy/2;y1=y+sy/2;zt=z+h
        v3.poly(d,cam,[(x1,y0,z),(x1,y1,z),(x1,y1,zt),(x1,y0,zt)],colorize(fx,a))
        v3.poly(d,cam,[(x0,y1,z),(x1,y1,z),(x1,y1,zt),(x0,y1,zt)],colorize(fy,a))
        v3.poly(d,cam,[(x0,y0,zt),(x1,y0,zt),(x1,y1,zt),(x0,y1,zt)],colorize(top,a))
        v3.path(d,cam,[(x0,y0,zt),(x1,y0,zt),(x1,y1,zt),(x0,y1,zt),(x0,y0,zt)],(245,253,249,round(170*alpha)),lw)
    faces(bx+.08,by+.07,v3.BASE_Z+zshift,v3.BASE_H,'#C7A575','#8E6943','#AE8557')
    # same microcontact dots on every HBM
    for k in range(8):
        u=-.85+k*.25
        p=cam.p((x+u,y+by/2+.052,v3.BASE_Z+zshift+.075))
        r=max(.8,min(1.6,cam.s/40))
        d.ellipse((p[0]-r,p[1]-r,p[0]+r,p[1]+r),fill=(248,216,158,round(190*alpha)))
    for k in range(4):
        z=v3.DIE_Z0+k*v3.DIE_STEP+zshift
        faces(bx,by,z,v3.DIE_H,'#BBC9CC','#5B7379','#86999B',2 if cam.s>72 else 1)
        # exact same inset details as original demonstration tower
        a0=[(x-1.02,y-.75,z+v3.DIE_H+.004),(x+1.02,y-.75,z+v3.DIE_H+.004),
            (x+1.02,y+.75,z+v3.DIE_H+.004),(x-1.02,y+.75,z+v3.DIE_H+.004),
            (x-1.02,y-.75,z+v3.DIE_H+.004)]
        v3.path(d,cam,a0,(247,253,249,round(90*alpha)),1)
        for j in range(9):
            bx0=x-.96+j*.24
            qa=cam.p((bx0,y+by/2,z+.045));qb=cam.p((bx0,y+by/2,z+.11))
            d.line((qa,qb),fill=(224,229,226,round(155*alpha)),width=max(1,int(cam.s/66)))
    img.alpha_composite(layer)


def package_objects_v7(img,cam,orig_t):
    # same depth sorter for GPU and all stacks; uniform style prevents a selected tower
    # from permanently displaying as a foreground layer.
    entities=[]
    if orig_t>=8.78:
        for idx,y in enumerate(old.GPU_YS):
            entities.append(dict(kind='gpu',x=old.GPU_CX,y=y,start=8.80+idx*.14,tag=f'GPU{idx+1}'))
    n=0
    for x in [old.STACK_LEFT,old.STACK_RIGHT]:
        for y in old.HBM_ROWS:
            if (x,y)==old.ORIGINAL:
                entities.append(dict(kind='original',x=x,y=y,start=0,tag='HBM-h'))
            else:
                entities.append(dict(kind='new',x=x,y=y,start=9.05+.095*n,tag=f'HBM{n+1}'))
                n+=1
    entities.sort(key=lambda e:(e['x']+e['y'],e['x'],e['tag']))
    for item in entities:
        k,x,y,start=item['kind'],item['x'],item['y'],item['start']
        if k=='gpu':
            v6.gpu_new(img,cam,x,y,orig_t,start)
        elif k=='new':
            p=old.clamp((orig_t-start)/.64)
            vis=old.smooth(p/.46) if p>0 else 0
            land=old.out(p)
            unified_stack(img,cam,x,y,alpha=vis,rise=(1-land)*.37,shadow_strength=land)
        else:
            # The original explanatory hero (notched TSV cross-section) converts
            # to the exact same physical stack as the seven other HBM towers.
            blend=old.smooth((orig_t-8.65)/.57)
            if blend<.9999:
                layer=Image.new('RGBA',(v3.W,v3.H),(0,0,0,0))
                v4.hbm(layer,cam,orig_t)
                if blend>0: layer.putalpha(layer.getchannel('A').point(lambda a:round(a*(1-blend))))
                img.alpha_composite(layer)
            if blend>0:
                unified_stack(img,cam,x,y,alpha=blend,rise=0,shadow_strength=1)
    return entities


def render(t):
    ot=physical_time(t)
    if ot<8.25:return v4.render(ot)
    img=v3.BGIMG.copy()
    cam=old.cam(ot)
    # package interposer behind all physical bodies
    v6.package_layer(img,cam,ot)
    package_objects_v7(img,cam,ot)
    old.draw_text(img,ot)
    return img.convert('RGB')


def stills():
    times=[.85,3.38,4.25,6.45,7.35,9.5,10.5,12.1]
    board=Image.new('RGB',(1280,1440),'white')
    for i,t in enumerate(times):
        im=render(t)
        im.save(HERE/f'frame_{i+1:02}.jpg',quality=93)
        board.paste(im.resize((640,360),Image.Resampling.LANCZOS),((i%2)*640,(i//2)*360))
    board.save(HERE/'HBM_v7_storyboard.jpg',quality=90)
    print('stills saved',flush=True)


def video():
    output=HERE/'HBM_v7_silent.mp4'
    w=imageio.get_writer(str(output),fps=FPS,codec='libx264',output_params=['-pix_fmt','yuv420p','-crf','18','-preset','veryfast'])
    try:
        for i in range(TOTAL):
            w.append_data(np.asarray(render(i/FPS)))
            if (i+1)%45==0:print(f'{i+1}/{TOTAL} frames',flush=True)
    finally:w.close()
    print('saved',output,flush=True)

if __name__=='__main__':
    pa=argparse.ArgumentParser();pa.add_argument('--stills',action='store_true');pa.add_argument('--video',action='store_true');a=pa.parse_args()
    if a.stills:stills()
    if a.video:video()
