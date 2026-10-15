"""HBM motion explainer v4 — faster camera choreography, monotonic die landings,
fully terminated interposer traces. Fixed 2:1 orthographic projection.
Run: python make_v4.py --preview; python make_v4.py --video
"""
import sys, math, argparse, os
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
import imageio.v2 as imageio

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/'hbm_v3'))
import make as v3

FPS=30
SECONDS=13.0
FRAMES=int(FPS*SECONDS)

# Four sequential scenes: compact but not frantic
T1,T2,T3,T4=0.,1.50,4.90,8.25
ENDS=[0,1.5,4.9,8.25,13.0]


def clamp(x):return max(0.0,min(1.0,x))
def smooth(x): x=clamp(x); return x*x*(3-2*x)
def easeout(x): x=clamp(x);return 1-(1-x)**4
def easeinout(x):
    x=clamp(x)
    return 4*x*x*x if x<.5 else 1-pow(-2*x+2,3)/2

def tween(t,seq,fn=easeinout):
    if t<=seq[0][0]:return seq[0][1]
    if t>=seq[-1][0]:return seq[-1][1]
    for (t0,v0),(t1,v1) in zip(seq,seq[1:]):
        if t0<=t<t1:
            return v0+(v1-v0)*fn((t-t0)/(t1-t0))
    return seq[-1][1]


def cam_motion(t):
    # Zoom and lateral tracking only. Angle, projection, x/y/z axes never change.
    zoom=tween(t,[(0,78),(.52,115),(1.32,115),
                  (1.75,103),(4.65,101),
                  (5.76,180),(7.75,182),
                  (9.62,64),(13,64)])
    tx=tween(t,[(0,v3.HBM_X),(4.9,v3.HBM_X),(5.72,v3.HBM_X+.66),
                (7.78,v3.HBM_X+.66),(9.58,0),(13,0)])
    ty=tween(t,[(0,v3.HBM_Y),(4.9,v3.HBM_Y),(5.72,v3.HBM_Y+.52),
                (7.78,v3.HBM_Y+.52),(9.58,0),(13,0)])
    ax=tween(t,[(0,748),(.65,804),(4.8,813),(5.75,955),
                (7.8,955),(9.62,740),(13,740)])
    ay=tween(t,[(0,515),(.65,535),(4.85,535),(5.75,555),
                (7.8,555),(9.62,453),(13,453)])
    return v3.Cam(zoom,(tx,ty),(ax,ay))

# Timed installation: a quick drop followed by a firm, non-reversing stop.
# No spring overshoot in physical position: the previous version 'bounced' through the lower chip.
STARTS=[.10,1.94,2.64,3.34]
LENGTHS=[.47,.45,.45,.45]


def hbm(img,cam,t):
    d=ImageDraw.Draw(img,'RGBA')
    hx,hy=v3.HBM_X,v3.HBM_Y
    v3.shadow(img,cam,hx,hy,v3.DIE_SX+.15,v3.DIE_SY+.12,v3.BASE_Z-.04,16,76)
    d=ImageDraw.Draw(img,'RGBA')
    base_on=easeout((t-1.55)/.32)
    if base_on>0:
        basez=v3.BASE_Z-.25*(1-base_on)
        v3.box_faces(d,cam,hx,hy,v3.DIE_SX+.08,v3.DIE_SY+.07,basez,v3.BASE_H,
                     '#C7A575','#8E6943','#AE8557')
        if base_on>.95:
            for k in range(8):
                xx=hx-.85+k*.25
                pp=cam.p((xx,hy+v3.DIE_SY/2+.055,basez+.07))
                d.ellipse([pp[0]-1.6,pp[1]-1.6,pp[0]+1.6,pp[1]+1.6],fill=(249,217,156,150))
    cut=smooth((t-5.46)/.42)*(1-smooth((t-8.33)/.52))
    lifted=smooth((t-5.42)/.49)*(1-smooth((t-8.33)/.52))
    for k in range(4):
        if t<STARTS[k]:continue
        fall=easeout((t-STARTS[k])/LENGTHS[k])
        dz=(1-fall)*(.65 if k==0 else .82)
        z=v3.DIE_Z0+k*v3.DIE_STEP+dz+lifted*.067*k
        notch=.64*cut
        v3.box_faces(d,cam,hx,hy,v3.DIE_SX,v3.DIE_SY,z,v3.DIE_H,
                     '#BBC9CC','#5B7379','#86999B',
                     line=(255,255,255,185),lw=2,notch=notch)
        if cut<.3:
            inlay=[(hx-1.02,hy-.75,z+v3.DIE_H+.003),(hx+1.02,hy-.75,z+v3.DIE_H+.003),
                   (hx+1.02,hy+.75,z+v3.DIE_H+.003),(hx-1.02,hy+.75,z+v3.DIE_H+.003),
                   (hx-1.02,hy-.75,z+v3.DIE_H+.003)]
            v3.path(d,cam,inlay,(247,253,249,90),1)
        for j in range(9):
            bx=hx-.96+j*.24
            a=cam.p((bx,hy+v3.DIE_SY/2,z+.045));b=cam.p((bx,hy+v3.DIE_SY/2,z+.11))
            d.line((a,b),fill=(224,229,226,155),width=2)
        if cut>.1:
            ar=round(240*cut)
            for j in range(3):
                xx=hx+.65+j*.14;yy=hy+.57
                a=cam.p((xx,yy,z+.015));b=cam.p((xx,yy,z+v3.DIE_H-.015))
                d.line((a,b),fill=(207,135,54,ar),width=max(3,round(cam.s/26)))
                for q in [a,b]:d.ellipse((q[0]-3,q[1]-3,q[0]+3,q[1]+3),fill=(246,206,133,ar))
    # copper-filled TSV barrels + discrete micro-bump links (not one impossible continuous post)
    q=smooth((t-6.02)/.32)*(1-smooth((t-8.33)/.52))
    if q>.01:
        d=ImageDraw.Draw(img,'RGBA')
        for j in range(3):
            xx=hx+.65+j*.14; yy=hy+.57
            for k in range(4):
                z0=v3.DIE_Z0+k*v3.DIE_STEP+lifted*.067*k
                a=cam.p((xx,yy,z0+.015));b=cam.p((xx,yy,z0+v3.DIE_H-.015))
                d.line((a,b),fill=(195,128,60,round(220*q)),width=3)
                if k<3:
                    next_z=v3.DIE_Z0+(k+1)*v3.DIE_STEP+lifted*.067*(k+1)
                    c=cam.p((xx,yy,z0+v3.DIE_H+.012))
                    e=cam.p((xx,yy,next_z-.012))
                    d.line((c,e),fill=(217,157,79,round(195*q)),width=3)
            pulse_progress=clamp((t-6.69)/.56)
            if 0<pulse_progress<1:
                z_p=v3.DIE_Z0+.1 + (v3.DIE_STEP*3+v3.DIE_H-.12)*pulse_progress
                pp=cam.p((xx,yy,z_p))
                d.ellipse((pp[0]-5,pp[1]-5,pp[0]+5,pp[1]+5),fill=(255,228,164,round(q*240)))

# Interposer wiring fix: every conductor terminates WITHIN GPU+HBM footprints.
# The exposed span is a complete physical bridge on the interposer, not disconnected decorative stubs.
# GPU footprint x:[-3.475,-.425],y:[-1.125,1.625]
# HBM footprint x:[.775,3.425],y:[-1.78,.34]
# Select only overlapping Y in [-1.125,.34], end under each die.
TRACE_YS=[-.96,-.76,-.56,-.36,-.16,.04,.24]
GPU_EDGE=-1.95+3.05/2
HBM_EDGE=v3.HBM_X-v3.DIE_SX/2
X_START=GPU_EDGE-.19
X_END=HBM_EDGE+.19
assert all(-1.125<y<.34 and -1.78<y<.34 for y in TRACE_YS)
assert X_START<GPU_EDGE<HBM_EDGE<X_END


def interposer(img,cam,t,appear):
    v3.shadow(img,cam,-.05,-.1,8.5,4.15,-.48,23,92)
    d=ImageDraw.Draw(img,'RGBA')
    v3.box_faces(d,cam,-.05,-.1,8.5,4.15,-.42,.49,
                 '#54696C','#253A41','#324952',line=(255,255,255,120),lw=2)
    onset=9.76
    # Each trace is one uninterrupted route under GPU and under HBM.
    for j,y in enumerate(TRACE_YS):
        amount=easeout((t-(onset+j*.075))/.43)
        if amount<=0:continue
        x_end=X_START+(X_END-X_START)*amount
        col=(202,154,93,230) if j%2==0 else (98,166,159,230)
        v3.path(d,cam,[(X_START,y,.085),(x_end,y,.085)],col,2)
        # One traveling marker, only after conductor reaches the HBM footprint.
        progress=(t-(10.47+j*.045))/.70
        if 0<=progress<=1:
            x=X_START+(X_END-X_START)*easeinout(progress)
            pp=cam.p((x,y,.09))
            d.ellipse((pp[0]-3,pp[1]-3,pp[0]+3,pp[1]+3),fill=(241,207,141,220))


def labels(img,phase,t):
    d=ImageDraw.Draw(img,'RGBA')
    headlines={1:'HBM：高带宽存储器',2:'多层 DRAM 垂直堆叠',
               3:'TSV 连接每一层芯片',4:'靠近 GPU，提供更高带宽'}
    st=ENDS[phase-1];en=ENDS[phase]
    a=round(255*smooth((t-st)/.18)*(1 if phase==4 else 1-smooth((t-(en-.17))/.17)))
    yshift=(1-easeout((t-st)/.30))*12
    x=72
    d.rounded_rectangle((x,90+yshift,x+32,94+yshift),radius=2,fill=(20,133,125,a))
    d.text((x,118+yshift),headlines[phase],font=v3.F[42],fill=(21,35,43,a),anchor='la')
    d.text((x+2,183+yshift),f'{phase:02d} / 04',font=v3.FR[19],fill=(104,120,121,a),anchor='la')


def render(t):
    phase=1 if t<T2 else 2 if t<T3 else 3 if t<T4 else 4
    im=v3.BGIMG.copy()
    cam=cam_motion(t)
    if t>=8.65:
        coming=easeout((t-8.65)/.90)
        support=Image.new('RGBA',(v3.W,v3.H),(0,0,0,0))
        interposer(support,cam,t,coming)
        v3.gpu(support,cam,coming)
        support.putalpha(support.getchannel('A').point(lambda a:round(a*coming)))
        im.alpha_composite(support)
    hbm(im,cam,t)
    if t>9.65:
        d=ImageDraw.Draw(im,'RGBA')
        a=int(245*smooth((t-9.65)/.38))
        p0=cam.p((-1.95,.25,.65));p1=cam.p((v3.HBM_X,v3.HBM_Y,1.34))
        d.text((p0[0]-70,p0[1]-123),'GPU',font=v3.F[25],fill=(40,66,78,a),anchor='mm')
        d.text((p1[0]+65,p1[1]-78),'HBM',font=v3.F[25],fill=(40,66,78,a),anchor='mm')
    labels(im,phase,t)
    return im.convert('RGB')


def make_preview():
    moments=[.98,4.25,6.65,11.6]
    montage=Image.new('RGB',(1280,720),'white')
    for i,t in enumerate(moments):
        f=render(t)
        f.save(HERE/f'keyframe_{i+1:02d}.png')
        montage.paste(f.resize((640,360),Image.Resampling.LANCZOS),((i%2)*640,(i//2)*360))
    montage.save(HERE/'HBM_v4_keyframes.jpg',quality=95)
    # Check scene4 connection status: every path has both ends hidden under chip footprint.
    with open(HERE/'trace_termination_audit.txt','w') as fo:
        fo.write('Each conductor starts INSIDE GPU package footprint and ends INSIDE HBM stack footprint.\n')
        for j,y in enumerate(TRACE_YS):
            ok= (X_START<GPU_EDGE and X_END>HBM_EDGE and -1.125<=y<=.34)
            fo.write(f'Conductor {j+1:02}: GPU x={X_START:.3f} at y={y:.3f} -> HBM x={X_END:.3f}; connected={ok}\n')
            assert ok
    print('Preview saved',flush=True)


def make_video():
    dest=HERE/'HBM_v4_silent.mp4'
    writer=imageio.get_writer(str(dest),fps=FPS,codec='libx264',output_params=['-pix_fmt','yuv420p','-crf','16','-preset','veryfast'])
    try:
        for i in range(FRAMES):
            writer.append_data(np.asarray(render(i/FPS)))
            if (i+1)%90==0:print(f'frames {i+1}/{FRAMES}',flush=True)
    finally:writer.close()
    print('Video saved:',dest,flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--preview',action='store_true');p.add_argument('--video',action='store_true');a=p.parse_args()
    if a.preview:make_preview()
    if a.video:make_video()
