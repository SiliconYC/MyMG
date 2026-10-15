"""HBM demo v5. Reference physical package layout: NVIDIA Blackwell B200.
Four-die HBM internal structure is teaching-only; real B200 stack counts/layers may vary.
Original fixed 2:1 axonometric projector, zoom/translation only.
One B200 device -> twin GPU dies + 8 HBM physical stacks arranged symmetrically.
"""
import math,sys, argparse
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
import imageio.v2 as imageio
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
import make_v4 as v4
v3=v4.v3

FPS=v4.FPS
SECONDS=v4.SECONDS
N=round(FPS*SECONDS)

# Physical plan in world coordinates. Four HBM stacks per x-flank, two centered GPU dies.
# The original animated HBM stack is exactly row 2 on the positive-X flank.
HBM_ROWS=[-3.42,-.72,1.98,4.68]
STACK_LEFT=-6.8
STACK_RIGHT=v3.HBM_X  # 2.10
GPU_CX=-2.35
GPU_YS=(-1.77,3.03)
GPU_SX=4.05
GPU_SY=4.25
PACK_CX=-2.35;PACK_CY=.63;PACK_SX=12.0;PACK_SY=11.3
ORIGINAL=(STACK_RIGHT,HBM_ROWS[1])

# Validate symmetry and overlap-free bounding boxes.
assert abs((STACK_LEFT+STACK_RIGHT)/2-GPU_CX)<1e-9
assert all(abs((HBM_ROWS[i+1]-HBM_ROWS[i])-2.7)<1e-9 for i in range(3))


def ease(u):return v4.easeinout(u)
def out(u):return v4.easeout(u)
def smooth(u):return v4.smooth(u)
def clamp(u):return v4.clamp(u)
def lerp(a,b,u):return a+(b-a)*u


def cam(t):
    # This matches v4 exactly at the scene handoff (8.25s), then zooms out to show the full package.
    t0=8.25; t1=10.38
    u=ease((t-t0)/(t1-t0))
    ca=v4.cam_motion(t0)
    return v3.Cam(lerp(ca.s,36.5,u),
       (lerp(ca.target[0],PACK_CX,u),lerp(ca.target[1],PACK_CY,u)),
       (lerp(ca.anchor[0],736,u),lerp(ca.anchor[1],453,u)))


def draw_base_chip(im, ca, cx, cy, arriving=1):
    d=ImageDraw.Draw(im,'RGBA')
    basez=v3.BASE_Z-.22*(1-out(arriving))
    v3.box_faces(d,ca,cx,cy,v3.DIE_SX+.08,v3.DIE_SY+.07,basez,v3.BASE_H,
           '#C7A575','#8E6943','#AE8557',line=(255,255,255,150),lw=1)


def draw_mini_stack(im,ca,cx,cy,arriving=1):
    if arriving<=0: return
    d=ImageDraw.Draw(im,'RGBA')
    # entire stack enters in a deliberate brief downward slide, not free float.
    extra=(1-out(arriving))*.35
    shadow=Image.new('RGBA',(v3.W,v3.H),(0,0,0,0))
    if arriving>.7: v3.shadow(im,ca,cx,cy,v3.DIE_SX,v3.DIE_SY,v3.BASE_Z-.04,9,42)
    d=ImageDraw.Draw(im,'RGBA')
    v3.box_faces(d,ca,cx,cy,v3.DIE_SX+.08,v3.DIE_SY+.07,v3.BASE_Z+extra,v3.BASE_H,
                 '#C7A575','#8E6943','#AE8557',line=(255,255,255,125),lw=1)
    for k in range(4):
        z=v3.DIE_Z0+k*v3.DIE_STEP+extra
        v3.box_faces(d,ca,cx,cy,v3.DIE_SX,v3.DIE_SY,z,v3.DIE_H,
                 '#BBC9CC','#5B7379','#86999B',line=(255,255,255,140),lw=1)
        if ca.s>=30:
            p=ca.p((cx+.35,cy+v3.DIE_SY/2,z+.075))
            d.ellipse((p[0]-1.1,p[1]-1.1,p[0]+1.1,p[1]+1.1),fill=(222,228,223,175))


def draw_gpu_die(im,ca,cx,cy,arriving):
    if arriving<=0: return
    d=ImageDraw.Draw(im,'RGBA')
    z=.15-.28*(1-out(arriving))
    v3.shadow(im,ca,cx,cy,GPU_SX,GPU_SY,z-.03,11,51)
    d=ImageDraw.Draw(im,'RGBA')
    v3.box_faces(d,ca,cx,cy,GPU_SX,GPU_SY,z,.48,
       '#43586D','#25374A','#33485E',line=(235,245,246,145),lw=2)
    # Recessed surface — resembles silicon without abstract circuitry or random wires.
    zt=z+.481
    sx=GPU_SX*.7; sy=GPU_SY*.72
    v3.path(d,ca,[(cx-sx/2,cy-sy/2,zt),(cx+sx/2,cy-sy/2,zt),
       (cx+sx/2,cy+sy/2,zt),(cx-sx/2,cy+sy/2,zt),(cx-sx/2,cy-sy/2,zt)],
       (193,220,229,118),1)
    for q in [-.85,-.42,0,.42,.85]:
        v3.path(d,ca,[(cx-1.15,cy+q,zt),(cx-.94,cy+q,zt)],(155,193,200,107),1)


# Exactly 8 stacks each has 3 illustrative interposer tracks underneath.
# Both track endpoints strictly within physical GPU/HBM bounds.
TRACE_ROUTES=[]
for flank,xh in [('left',STACK_LEFT),('right',STACK_RIGHT)]:
    for row,hy in enumerate(HBM_ROWS):
        gc_y=GPU_YS[0] if row<2 else GPU_YS[1]
        for delta in [-.34,0,.34]:
            y=hy+delta
            if flank=='right':
                x1=GPU_CX+GPU_SX/2-.28  # within right GPU edge
                x2=xh-v3.DIE_SX/2+.28  # within HBM left edge
                assert GPU_CX-GPU_SX/2<x1<GPU_CX+GPU_SX/2
                assert xh-v3.DIE_SX/2<x2<xh+v3.DIE_SX/2
            else:
                x1=GPU_CX-GPU_SX/2+.28
                x2=xh+v3.DIE_SX/2-.28
                assert GPU_CX-GPU_SX/2<x1<GPU_CX+GPU_SX/2
                assert xh-v3.DIE_SX/2<x2<xh+v3.DIE_SX/2
            assert gc_y-GPU_SY/2 < y < gc_y+GPU_SY/2
            assert hy-v3.DIE_SY/2 < y < hy+v3.DIE_SY/2
            TRACE_ROUTES.append((x1,x2,y,flank,row))
assert len(TRACE_ROUTES)==24


def draw_interposer(im,ca,t):
    v3.shadow(im,ca,PACK_CX,PACK_CY,PACK_SX,PACK_SY,-.48,23,91)
    d=ImageDraw.Draw(im,'RGBA')
    v3.box_faces(d,ca,PACK_CX,PACK_CY,PACK_SX,PACK_SY,-.42,.49,
         '#54696C','#253A41','#324952',line=(255,255,255,124),lw=2)
    # Interconnects are on the package/redistribution layer in this simplified explanatory model.
    # Render them first: ends are physically occluded by the GPU and HBM die bodies drawn afterward.
    for k,(x0,x1,y,flank,row) in enumerate(TRACE_ROUTES):
        amount=out((t-10.42-(row*.055)-(.045 if flank=='right' else 0))/.46)
        if amount<=0:continue
        xx=lerp(x0,x1,amount)
        rgb=(205,161,105,213) if k%3==0 else (126,176,168,213)
        v3.path(d,ca,[(x0,y,.086),(xx,y,.086)],rgb,2)
        u=(t-11.2-row*.04-(k%3)*.045)/.59
        if 0<=u<=1 and amount>.97:
            px=lerp(x0,x1,ease(u))
            p=ca.p((px,y,.088))
            r=max(2.0,min(4.0,ca.s*.062))
            d.ellipse((p[0]-r,p[1]-r,p[0]+r,p[1]+r),fill=(239,196,124,210))


def draw_text(im,t):
    d=ImageDraw.Draw(im,'RGBA')
    alpha=round(255*smooth((t-8.25)/.22))
    yoff=14*(1-out((t-8.25)/.33))
    x=72
    d.rounded_rectangle((x,90+yoff,x+32,94+yoff),radius=2,fill=(20,133,125,alpha))
    d.text((x,118+yoff),'一颗 GPU，八组 HBM 对称布局',font=v3.F[42],fill=(21,35,43,alpha),anchor='la')
    d.text((x+2,183+yoff),'04 / 04',font=v3.FR[19],fill=(104,120,121,alpha),anchor='la')
    # The current section uses two compute dies that act as one logical GPU.
    if t>10.45:
        a=round(255*smooth((t-10.45)/.3))
        d.text((74,668),'封装布局参考 B200 · 单个堆叠的层数为教学简化示意',font=v3.FR[19],fill=(103,119,121,a),anchor='la')


def render(t):
    if t<8.25:
        return v4.render(t)
    im=v3.BGIMG.copy()
    ca=cam(t)
    present=smooth((t-8.43)/.74)
    # Build support behind physical bodies.
    if present>0:
        layer=Image.new('RGBA',(v3.W,v3.H),(0,0,0,0))
        draw_interposer(layer,ca,t)
        layer.putalpha(layer.getchannel('A').point(lambda a:round(a*present)))
        im.alpha_composite(layer)
    # GPU chips, part of one logical device (two compute dies).
    if t>8.80:
        for k,gy in enumerate(GPU_YS):
            arr=out((t-8.80-k*.14)/.55)
            draw_gpu_die(im,ca,GPU_CX,gy,arr)
    # Seven new HBM stacks become visible as the camera retreats.
    if t>9.05:
        n=0
        for side,hx in enumerate([STACK_LEFT,STACK_RIGHT]):
            for j,hy in enumerate(HBM_ROWS):
                if (hx,hy)==ORIGINAL:continue
                arrive=out((t-9.05-.095*n)/.45)
                draw_mini_stack(im,ca,hx,hy,arrive)
                n+=1
    # Original animated HBM remains in *exactly the same world position* throughout the entire video.
    v4.hbm(im,ca,t)
    draw_text(im,t)
    return im.convert('RGB')


def stills():
    moments=[.92,3.55,6.65,11.88]
    montage=Image.new('RGB',(1280,720),'white')
    for i,t in enumerate(moments):
        f=render(t)
        f.save(ROOT/f'v5_key_{i+1:02}.png')
        montage.paste(f.resize((640,360),Image.Resampling.LANCZOS),((i%2)*640,(i//2)*360))
    montage.save(ROOT/'HBM_v5_keyframes.jpg',quality=94)
    with open(ROOT/'v5_layout_audit.txt','w') as fo:
        fo.write('B200-like package: 1 logical GPU with 2 compute dies and 8 HBM stacks.\n')
        fo.write('Stack count = 8; interposer schematic trace count = 24.\n')
        fo.write('Original animated HBM coordinates remain unchanged in scene 4.\n')
        fo.write('Every illustrated track terminates inside a GPU footprint and inside an HBM footprint.\n')
        for k,(x0,x1,y,flank,row) in enumerate(TRACE_ROUTES):
            fo.write(f'{k+1:02d} {flank} row{row+1} (x={x0:.2f},y={y:.2f}) -> (x={x1:.2f},y={y:.2f}) OK\n')
    print('previews saved',flush=True)


def video():
    dest=ROOT/'HBM_v5_silent.mp4'
    w=imageio.get_writer(str(dest),fps=FPS,codec='libx264',output_params=['-pix_fmt','yuv420p','-crf','16','-preset','veryfast'])
    try:
        for i in range(N):
            w.append_data(np.asarray(render(i/FPS)))
            if i%90==89: print('render',i+1,'/',N,flush=True)
    finally:w.close()
    print('video saved',dest,flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--stills',action='store_true');p.add_argument('--video',action='store_true')
    a=p.parse_args()
    if a.stills:stills()
    if a.video:video()
