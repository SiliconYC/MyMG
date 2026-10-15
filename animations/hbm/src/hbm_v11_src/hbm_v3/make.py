"""HBM 15-second Chinese isometric explainer v3 — kinetic motion pass.
All physical objects use one fixed 2:1 orthographic projection. Only camera offset/scale varies.
4 x DRAM plus a base logic die is a schematic teaching example.
Run: python make.py --stills; python make.py --video
"""
import math, sys, os, argparse, subprocess, time
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio.v2 as imageio
from pathlib import Path

HERE=Path(__file__).resolve().parent
W,H = 1280,720
FPS=30
N=450
AA=1 # output full frames at 1280x720, all objects vector drawn by PIL
FONT='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
BOLD='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
F={size:ImageFont.truetype(BOLD,size) for size in (18,19,23,25,36,42,50,52)}
FR={size:ImageFont.truetype(FONT,size) for size in (18,19,20,22,25,26)}
BG='#F5F6F4'; BG_BOTTOM='#EBEFED'; INK='#15232B'; INK2='#64747B'
TEAL='#12857D'; COPPER='#C59251'; GOLD='#B88B52'

def rgba(c,a=255):
    if isinstance(c,tuple): return c+(int(a),)
    c=c.lstrip('#')
    return (int(c[0:2],16),int(c[2:4],16),int(c[4:6],16),int(a))

def mix(c1,c2,alpha):
    a=rgba(c1)[:3]; b=rgba(c2)[:3]
    return tuple(round(x+(y-x)*alpha) for x,y in zip(a,b))+(255,)

def cl(v): return min(1,max(0,v))
def smooth(v): v=cl(v); return v*v*(3-2*v)
def out(v): v=cl(v); return 1-(1-v)**3

def out_back(v):
    # Precise micro-overtravel during installation, no cartoon wobble.
    v=cl(v); u=v-1.0
    return 1 + 2.28*u*u*u + 1.28*u*u

def interp(t, keys):
    # keyframes are (time,value); smooth quintic ease between keyframes
    if t<=keys[0][0]:return keys[0][1]
    if t>=keys[-1][0]:return keys[-1][1]
    for i in range(len(keys)-1):
        t0,a=keys[i]; t1,b=keys[i+1]
        if t0<=t<t1:
            x=(t-t0)/(t1-t0)
            x=x*x*x*(x*(x*6-15)+10)
            return lerp(a,b,x)
    return keys[-1][1]

def cam_motion(t):
    # Fixed 2:1 orthographic axes, only scale/translation animated.
    scale=interp(t,[(0,65),(.95,111),(1.6,112),(2.1,108),(2.85,97),
                    (5.1,97),(6.38,104),(7.72,181),(8.45,201),(9.55,204),
                    (10.1,204),(11.75,61),(12.15,62),(14.6,66),(15,66)])
    tx=interp(t,[(0,HBM_X),(6.5,HBM_X),(7.7,HBM_X+.68),(9.9,HBM_X+.68),
                 (11.85,0),(15,0)])
    ty=interp(t,[(0,HBM_Y),(6.5,HBM_Y),(7.7,HBM_Y+.52),(9.9,HBM_Y+.52),
                 (11.85,0),(15,0)])
    ax=interp(t,[(0,770),(.9,816),(6.4,828),(7.8,1018),(10.0,1018),
                 (11.8,740),(15,738)])
    ay=interp(t,[(0,538),(1.4,530),(6.4,540),(7.7,633),(10.0,633),
                 (11.85,454),(15,450)])
    return Cam(scale,(tx,ty),(ax,ay))

def lerp(a,b,t): return a+(b-a)*t

def width_of(txt, font): return ImageDraw.Draw(Image.new('RGB',(1,1))).textbbox((0,0),txt,font=font)[2]

# Simple orthographic axonometric camera. X and Y ground axes slope +1/2 and -1/2 respectively.
class Cam:
    def __init__(self,scale=92, target=(0,0), anchor=(780,520)):
        self.s=scale; self.target=target; self.anchor=anchor
    def p(self,v):
        x,y,z=v
        rx=x-self.target[0]; ry=y-self.target[1]
        return (self.anchor[0] + self.s*(rx-ry),self.anchor[1]+.5*self.s*(rx+ry)-self.s*z)

def poly(d,cam,verts,fill,outline=None,width=1):
    p=[cam.p(v) for v in verts]
    d.polygon(p,fill=fill)
    if outline: d.line(p+[p[0]],fill=outline,width=width,joint='curve')

def path(d,cam,verts,color,width=2):
    d.line([cam.p(v) for v in verts],fill=color,width=width,joint='curve')

def box_faces(d,cam,cx,cy,sx,sy,z,h,top,face_x,face_y,line=(255,255,255,75), lw=1, notch=0):
    # x+ and y+ faces are visible, then top. Notched front-right edge can expose internal connection region.
    x0=cx-sx/2; x1=cx+sx/2; y0=cy-sy/2; y1=cy+sy/2; z1=z+h
    if notch>0:
        nx=x1-notch; ny=y1-notch
        # cut corner on x+/y+ sides (visualized schematic cutaway)
        ground=[(x0,y0),(x1,y0),(x1,ny),(nx,ny),(nx,y1),(x0,y1)]
    else:
        ground=[(x0,y0),(x1,y0),(x1,y1),(x0,y1)]
    # front faces
    if notch:
        # x=+sx (visible right-facing wall), y<=ny
        poly(d,cam,[(x1,y0,z),(x1,ny,z),(x1,ny,z1),(x1,y0,z1)],face_x)
        # y=+sy (visible left-facing wall), x<=nx
        poly(d,cam,[(x0,y1,z),(nx,y1,z),(nx,y1,z1),(x0,y1,z1)],face_y)
        # internal notch walls: x=nx, y >=ny; y=ny, x>=nx
        poly(d,cam,[(nx,ny,z),(nx,y1,z),(nx,y1,z1),(nx,ny,z1)],mix(face_x,'#FFFFFF',.18))
        poly(d,cam,[(nx,ny,z),(x1,ny,z),(x1,ny,z1),(nx,ny,z1)],mix(face_y,'#FFFFFF',.08))
    else:
        poly(d,cam,[(x1,y0,z),(x1,y1,z),(x1,y1,z1),(x1,y0,z1)],face_x)
        poly(d,cam,[(x0,y1,z),(x1,y1,z),(x1,y1,z1),(x0,y1,z1)],face_y)
    poly(d,cam,[(x,y,z1) for x,y in ground],top,outline=line,width=lw)
    # separation seams, subtle
    path(d,cam,[(x0,y1,z),(x1 if not notch else nx,y1,z)],(34,56,64,75),1)
    return (x0,x1,y0,y1,z1)


def shadow(img,cam,cx,cy,sx,sy,z,radius=20,strength=80):
    l=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(l)
    verts=[cam.p((x,y,z)) for x,y in [(cx-sx/2,cy-sy/2),(cx+sx/2,cy-sy/2),(cx+sx/2,cy+sy/2),(cx-sx/2,cy+sy/2)]]
    d.polygon(verts,fill=(15,27,32,strength))
    img.alpha_composite(l.filter(ImageFilter.GaussianBlur(radius)))


def make_background():
    # Off-white studio backdrop. No decorative grids or particles.
    a=np.zeros((H,W,4),dtype=np.uint8)
    for y in range(H):
        t=y/H
        c=mix(BG,BG_BOTTOM, t**1.8)
        a[y,:,0]=c[0]; a[y,:,1]=c[1]; a[y,:,2]=c[2]; a[y,:,3]=255
    im=Image.fromarray(a,'RGBA')
    d=ImageDraw.Draw(im)
    return im
BGIMG=make_background()

HBM_X,HBM_Y=2.10,-0.72
DIE_SX,DIE_SY=2.65,2.12
BASE_Z=.17; BASE_H=.22
DIE_Z0=BASE_Z+BASE_H+.07
DIE_H=.155; DIE_STEP=.225
DIE_TOTAL=4


def hbm(img,cam,t,phase='single',cut=0.0,connections=0.0):
    d=ImageDraw.Draw(img,'RGBA')
    hx,hy=HBM_X,HBM_Y
    start=BASE_Z
    # cast shadow below logic slab
    shadow(img,cam,hx,hy,DIE_SX+.15,DIE_SY+.12,BASE_Z-.04,16,82)
    d=ImageDraw.Draw(img,'RGBA')
    # Base appears behind the first DRAM before the remaining dies are installed.
    base_on=smooth((t-2.22)/.60)
    if base_on>0:
        basez=BASE_Z-.42*(1-out_back(base_on))
        box_faces(d,cam,hx,hy,DIE_SX+.08,DIE_SY+.07,basez,BASE_H,
                  mix('#C7A575','#D3B587',0.10), '#8E6943','#AE8557')
        if base_on>.9:
            for k in range(8):
                u=-.85+k*.25
                p=cam.p((hx+u,hy+DIE_SY/2+.055,basez+.07))
                d.ellipse((p[0]-1.6,p[1]-1.6,p[0]+1.6,p[1]+1.6),fill=(249,217,156,150))

    # Each thin die follows a distinct, slightly overlapping spring-timed landing.
    starts=[.12,2.90,3.72,4.54]
    for k in range(DIE_TOTAL):
        if t < starts[k]: continue
        u=cl((t-starts[k])/(.88 if k==0 else .84))
        dz=(1-out_back(u))*(.62 if k==0 else 1.08)
        z=DIE_Z0+k*DIE_STEP+dz
        # First die starts elevated and lowers into position. The remaining layers arrive individually.
        separated=smooth((t-7.18)/.67)*(1-smooth((t-10.14)/.55))
        z+=separated*.09*k
        is_cut=smooth((t-7.26)/.75)*(1-smooth((t-10.04)/.61))
        chip_notch=.64*is_cut
        box_faces(d,cam,hx,hy,DIE_SX,DIE_SY,z,DIE_H,
                  '#BBC9CC','#5B7379','#86999B',line=(255,255,255,185),lw=2,
                  notch=chip_notch)
        if is_cut<.3:
            inlay=[(hx-1.02,hy-.75,z+DIE_H+.003),(hx+1.02,hy-.75,z+DIE_H+.003),
                   (hx+1.02,hy+.75,z+DIE_H+.003),(hx-1.02,hy+.75,z+DIE_H+.003),
                   (hx-1.02,hy-.75,z+DIE_H+.003)]
            path(d,cam,inlay,(247,253,249,90),1)
        for j in range(9):
            bx=hx-.96+j*.24
            v1=cam.p((bx,hy+DIE_SY/2,z+.045))
            v2=cam.p((bx,hy+DIE_SY/2,z+.11))
            d.line((v1,v2),fill=(224,229,226,155),width=2)
        if is_cut>.1:
            ar=round(240*is_cut)
            for j in range(3):
                xx=hx+.65+j*.14; yy=hy+.57
                a=cam.p((xx,yy,z+.015)); b=cam.p((xx,yy,z+DIE_H-.015))
                d.line((a,b),fill=(207,135,54,ar),width=max(3,round(cam.s/26)))
                for q in [a,b]: d.ellipse((q[0]-3,q[1]-3,q[0]+3,q[1]+3),fill=(246,206,133,ar))
    # connecting vertical microlinks appear in small cutaway corner in scene 3
    q=smooth((t-7.70)/.65)*(1-smooth((t-10.06)/.55))
    if q>.01:
        d=ImageDraw.Draw(img,'RGBA')
        for j in range(3):
            xx=hx+.65+j*.14; yy=hy+.57
            z1=BASE_Z+.08; z2=DIE_Z0+3*DIE_STEP+DIE_H+.04
            # Don't draw one imaginary copper post spanning the entire stack: draw each segment individually.
            for k in range(4):
                z0=DIE_Z0+k*DIE_STEP
                a=cam.p((xx,yy,z0+.015)); b=cam.p((xx,yy,z0+DIE_H-.015))
                d.line((a,b),fill=(195,128,60,round(220*q)),width=3)
                # microbump bridging small inter-die gap
                if k<3:
                    c=cam.p((xx,yy,z0+DIE_H+.012)); e=cam.p((xx,yy,z0+DIE_STEP-.012))
                    d.line((c,e),fill=(217,157,79,round(195*q)),width=3)
            # pulse one time, sequential along height
            pulse=smooth((t-8.55)/.16)
            pulse_progress=cl((t-8.65)/.76)
            if 0<pulse_progress<1:
                zp=lerp(DIE_Z0+.1,DIE_Z0+3*DIE_STEP+DIE_H-.02,pulse_progress)
                pp=cam.p((xx,yy,zp))
                d.ellipse((pp[0]-6,pp[1]-6,pp[0]+6,pp[1]+6),fill=(255,228,164,round(q*230)))


def gpu(img,cam,appear=1):
    if appear<=0:return
    d=ImageDraw.Draw(img,'RGBA')
    gx,gy=-1.95,.25
    if appear<1: # rise smoothly, no perspective distortion
        gz=.15-.32*(1-appear)
    else: gz=.15
    shadow(img,cam,gx,gy,3.05,2.75,gz-.03,10,67)
    d=ImageDraw.Draw(img,'RGBA')
    box_faces(d,cam,gx,gy,3.05,2.75,gz,.48,
              '#43586D','#25374A','#33485E',line=(235,245,246,150),lw=2)
    # minimalist recessed center top panel
    z=gz+.481
    path(d,cam,[(gx-1.09,gy-.93,z),(gx+1.09,gy-.93,z),(gx+1.09,gy+.93,z),(gx-1.09,gy+.93,z),(gx-1.09,gy-.93,z)],(193,220,229,155),2)
    # render small orthographic chip-array traces on top
    for i in range(4):
        yy=gy-.6 + i*.39
        path(d,cam,[(gx-1.02,yy,z),(gx-.72,yy,z)],(155,193,200,120),2)
        path(d,cam,[(gx+.72,yy,z),(gx+1.02,yy,z)],(155,193,200,120),2)


def interposer(img,cam,appear=1,pulse=0):
    d=ImageDraw.Draw(img,'RGBA')
    shadow(img,cam,-.05,-.1,8.5,4.15,-.48,23,92)
    d=ImageDraw.Draw(img,'RGBA')
    box_faces(d,cam,-.05,-.1,8.5,4.15,-.42,.49,
              '#54696C','#253A41','#324952',line=(255,255,255,120),lw=2)
    # actual wide horizontal interposer interconnect drawn on top plane and tucked under chip bodies
    # along X: conductor pathways from GPU to HBM
    for j in range(9):
        yy=-.50+j*.18
        p1=(-.16,yy,.084); p2=(.53,yy,.084)
        col=rgba(COPPER,175) if j%2==0 else (113,206,196,180)
        path(d,cam,[p1,p2],col,3)
        path(d,cam,[(-.49,yy,.084),p1],col,2)
        path(d,cam,[p2,(.98,yy,.084)],col,2)
        if pulse>0:
            t=(pulse+j*.04)%1
            pp=cam.p((lerp(-.49,.98,t), yy, .088))
            d.ellipse((pp[0]-3,pp[1]-3,pp[0]+3,pp[1]+3),fill=(249,207,121,225))


def labels(img,phase,t):
    d=ImageDraw.Draw(img,'RGBA')
    headlines={1:'HBM：高带宽存储器',2:'多层 DRAM 垂直堆叠',3:'TSV 连接每一层芯片',4:'靠近 GPU，提供更高带宽'}
    starts={1:0,2:2.2,3:6.5,4:10.15}
    ends={1:2.2,2:6.5,3:10.15,4:15.0}
    st=starts[phase]; en=ends[phase]
    incoming=smooth((t-st)/.30)
    outgoing=1 if phase==4 else 1-smooth((t-(en-.30))/.30)
    a=int(255*incoming*outgoing)
    yshift=(1-out((t-st)/.48))*15
    x=72
    d.rounded_rectangle((x,90+yshift,x+32,94+yshift),radius=2,fill=(20,133,125,a))
    d.text((x,118+yshift),headlines[phase],font=F[42],fill=(21,35,43,a),anchor='la')
    # A small ordinal only, rather than excess labels.
    d.text((x+2,183+yshift),f'{phase:02d} / 04',font=FR[19],fill=(104,120,121,a),anchor='la')


def render(t):
    phase=1 if t<2.2 else 2 if t<6.5 else 3 if t<10.15 else 4
    im=BGIMG.copy()
    cam=cam_motion(t)
    # Continuous single scene — world positions and projection never change.
    if t>=10.85:
        coming=smooth((t-10.85)/1.20)
        support=Image.new('RGBA',(W,H),(0,0,0,0))
        interposer(support,cam,coming,pulse=0 if t<12.3 else ((t-12.3)*.72)%1.0)
        gpu(support,cam,coming)
        a=support.getchannel('A').point(lambda v: round(v*coming))
        support.putalpha(a)
        im.alpha_composite(support)
    hbm(im,cam,t,'stack')
    if t>11.7:
        d=ImageDraw.Draw(im,'RGBA')
        a=int(245*smooth((t-11.7)/.60))
        p0=cam.p((-1.95,.25,.65)); p1=cam.p((HBM_X,HBM_Y,1.34))
        d.text((p0[0]-70,p0[1]-123),'GPU',font=F[25],fill=(40,66,78,a),anchor='mm')
        d.text((p1[0]+65,p1[1]-78),'HBM',font=F[25],fill=(40,66,78,a),anchor='mm')
    labels(im,phase,t)
    return im.convert('RGB')


def stills():
    marks=[1.32,5.8,8.95,13.6]
    imlist=[]
    for k,t in enumerate(marks,1):
        im=render(t)
        im.save(HERE/f'key_{k:02d}.png')
        imlist.append(im)
    montage=Image.new('RGB',(1280,720),(255,255,255))
    for im,(x,y) in zip(imlist,[(0,0),(640,0),(0,360),(640,360)]):
        montage.paste(im.resize((640,360),Image.Resampling.LANCZOS),(x,y))
    montage.save(HERE/'four_keyframes.jpg',quality=93)
    print('created stills',flush=True)


def video():
    outfile=HERE/'HBM_15s_motion_v3_silent.mp4'
    writer=imageio.get_writer(str(outfile),fps=FPS,codec='libx264',output_params=['-pix_fmt','yuv420p','-crf','17','-preset','veryfast'])
    for i in range(N):
        writer.append_data(np.asarray(render(i/FPS)))
        if (i+1)%90==0: print('frames',i+1,'/',N,flush=True)
    writer.close()
    print('created',outfile,flush=True)

if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('--stills',action='store_true'); ap.add_argument('--video',action='store_true'); args=ap.parse_args()
    if args.stills: stills()
    if args.video: video()
