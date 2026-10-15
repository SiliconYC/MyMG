"""HBM motion demo v6. Progressive stacking cadence; world-depth painter ordering;
no abrupt shadows at GPU/stack reveal; fully terminated package traces.
Reuses original camera and asset geometry; no camera rotation.
"""
import sys, math, argparse, pathlib, time
from PIL import Image, ImageDraw
import numpy as np
import imageio.v2 as imageio
HERE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/'hbm_v4'))
import make_v5 as old
v4=old.v4
v3=old.v3
FPS=30
DURATION=11.5
TOTAL=round(FPS*DURATION)
RATIO=13.0/DURATION
# Positions in the 13-s reference timeline; spacing gets progressively shorter.
v4.STARTS=[.10,1.95,2.92,3.48]
v4.LENGTHS=[.54,.67,.43,.30]
assert all(v4.STARTS[k+1]-v4.STARTS[k]>v4.STARTS[k+2]-v4.STARTS[k+1] for k in range(2))

def rgba(rgb,a):
    if isinstance(rgb,str):
        s=rgb.lstrip('#');rgb=tuple(int(s[i:i+2],16) for i in (0,2,4))
    return tuple(rgb[:3])+(int(max(0,min(255,round(a)))),)

def fpoly(d,cam,pts,c,a):
    v3.poly(d,cam,pts,rgba(c,a))

def stack_new(img,cam,x,y,t,start):
    """Additional whole HBM stack. Alpha and descent are continuous: no threshold shadow pop."""
    p=old.clamp((t-start)/.64)
    if p<=0:return
    land=old.out(p)
    vis=old.smooth(p/.46) # opacity ramps before fully visible
    a=255*vis
    extra=(1-land)*.37
    layer=Image.new('RGBA',(v3.W,v3.H),(0,0,0,0))
    d=ImageDraw.Draw(layer,'RGBA')
    # A contact shadow with opacity driven by the very same arrival progress.
    # Draw shadow as near-contact quads, no sudden gaussian fade at arbitrary thresholds.
    x0=x-v3.DIE_SX/2+.12; x1=x+v3.DIE_SX/2-.12
    y0=y-v3.DIE_SY/2+.1; y1=y+v3.DIE_SY/2-.1
    fpoly(d,cam,[(x0,y0,v3.BASE_Z-.05),(x1,y0,v3.BASE_Z-.05),(x1,y1,v3.BASE_Z-.05),(x0,y1,v3.BASE_Z-.05)],(28,52,55),44*land*vis)
    # Draw matching five solid layers at physically co-axial positions.
    for sx,sy,z,h,top,face_x,face_y in [(v3.DIE_SX+.08,v3.DIE_SY+.07,v3.BASE_Z+extra,v3.BASE_H,'#C7A575','#8E6943','#AE8557')]+[
        (v3.DIE_SX,v3.DIE_SY,v3.DIE_Z0+k*v3.DIE_STEP+extra,v3.DIE_H,'#BBC9CC','#5B7379','#86999B') for k in range(4)]:
        x0=x-sx/2;x1=x+sx/2;y0=y-sy/2;y1=y+sy/2;z1=z+h
        fpoly(d,cam,[(x1,y0,z),(x1,y1,z),(x1,y1,z1),(x1,y0,z1)],face_x,a)
        fpoly(d,cam,[(x0,y1,z),(x1,y1,z),(x1,y1,z1),(x0,y1,z1)],face_y,a)
        fpoly(d,cam,[(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)],top,a)
        if vis>.02:
            path=[(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1),(x0,y0,z1)]
            v3.path(d,cam,path,rgba((250,254,251),125*vis),1)
    img.alpha_composite(layer)


def gpu_new(img,cam,cx,cy,t,start):
    p=old.clamp((t-start)/.76)
    if p<=0:return
    land=old.out(p)
    # Continuous opacity and elevation start from precisely zero.
    vis=old.smooth(p/.46); a=255*vis
    z=.15-.28*(1-land)
    layer=Image.new('RGBA',(v3.W,v3.H),(0,0,0,0))
    d=ImageDraw.Draw(layer,'RGBA')
    x0=cx-old.GPU_SX/2;x1=cx+old.GPU_SX/2
    y0=cy-old.GPU_SY/2;y1=cy+old.GPU_SY/2;z1=z+.48
    # Back shadow, already smooth from frame one.
    fpoly(d,cam,[(x0+.1,y0+.1,z-.05),(x1-.1,y0+.1,z-.05),(x1-.1,y1-.1,z-.05),(x0+.1,y1-.1,z-.05)],(24,49,62),45*land*vis)
    fpoly(d,cam,[(x1,y0,z),(x1,y1,z),(x1,y1,z1),(x1,y0,z1)],'#25374A',a)
    fpoly(d,cam,[(x0,y1,z),(x1,y1,z),(x1,y1,z1),(x0,y1,z1)],'#33485E',a)
    fpoly(d,cam,[(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)],'#43586D',a)
    sx=old.GPU_SX*.7;sy=old.GPU_SY*.72
    v3.path(d,cam,[(cx-sx/2,cy-sy/2,z1+.001),(cx+sx/2,cy-sy/2,z1+.001),
         (cx+sx/2,cy+sy/2,z1+.001),(cx-sx/2,cy+sy/2,z1+.001),
         (cx-sx/2,cy-sy/2,z1+.001)],rgba((193,220,229),118*vis),1)
    img.alpha_composite(layer)


def draw_original(img,cam,t):
    # The highlighted HBM is not a HUD overlay; it gets the SAME depth pass as the other seven stacks.
    # Shadow is included in the physical draw. Suppress the floating shadow if not on a background.
    v4.hbm(img,cam,t)


def package_layer(img,cam,t):
    """Interposer always behind physical chip bodies; traces above interposer, below dies."""
    # Delayed reveal: at high zoom, this 12x11 package would fill the WHOLE screen.
    # Earlier version caused a screen-sized grey flash at the reveal boundary.
    # Wait until its edges have entered the orthographic frame, then cross-fade smoothly.
    visibility=old.smooth((t-9.56)/.56)
    if visibility<=0:return
    tmp=Image.new('RGBA',(v3.W,v3.H),(0,0,0,0))
    # Preserve original precise routing. Interposer is one independent backmost drawing layer.
    old.draw_interposer(tmp,cam,t)
    tmp.putalpha(tmp.getchannel('A').point(lambda a:round(a*visibility)))
    img.alpha_composite(tmp)


def package_objects(img,cam,t):
    """Depth sort by projected camera depth (x+y), not by entity type or highlight status."""
    entities=[]
    if t>=8.8:
        for idx,y in enumerate(old.GPU_YS):
            entities.append(dict(kind='gpu',x=old.GPU_CX,y=y,start=8.80+idx*.14,tag=f'GPU{idx+1}'))
    num=0
    for side,x in enumerate([old.STACK_LEFT,old.STACK_RIGHT]):
        for j,y in enumerate(old.HBM_ROWS):
            if (x,y)==old.ORIGINAL:
                entities.append(dict(kind='original',x=x,y=y,start=0,tag='HBM original'))
            else:
                entities.append(dict(kind='new',x=x,y=y,start=9.05+.095*num,tag=f'HBM{num+1}'))
                num+=1
    # In fixed 2:1 axonometric projection the camera looks from +X,+Y.
    # Render far to near: increasing x+y = nearer. Tie-break deterministic.
    entities.sort(key=lambda item:(item['x']+item['y'], item['x'], item['tag']))
    for item in entities:
        if item['kind']=='gpu': gpu_new(img,cam,item['x'],item['y'],t,item['start'])
        elif item['kind']=='new': stack_new(img,cam,item['x'],item['y'],t,item['start'])
        else: draw_original(img,cam,t)
    return entities


def render_oldtime(t):
    if t<8.25: return v4.render(t)
    im=v3.BGIMG.copy()
    cam=old.cam(t)
    package_layer(im,cam,t)
    package_objects(im,cam,t)
    old.draw_text(im,t)
    return im.convert('RGB')

def render(t):
    return render_oldtime(t*RATIO)

def stills():
    marks=[.85,2.75,6.1,8.4,10.5]
    can=Image.new('RGB',(1280,1080),'#FFFFFF')
    for k,t in enumerate(marks):
        im=render(t)
        im.save(HERE/f'key_{k+1:02}.jpg',quality=94)
        im2=im.resize((640,360),Image.Resampling.LANCZOS)
        can.paste(im2,((k%2)*640,(k//2)*360))
    can.save(HERE/'HBM_v6_keyframes.jpg',quality=93)
    (HERE/'depth_audit.txt').write_text('Render ordering: ascending depth=x+y in every frame; original demo stack is a normal depth-sorted object, never a top overlay.\n'+'\n'.join(f'{i["x"]+i["y"]:7.3f}  {i["tag"]}' for i in package_objects(v3.BGIMG.copy(),old.cam(11.5),11.5)))
    print('keyframes ready',flush=True)

def video():
    dest=HERE/'HBM_v6_silent.mp4'
    w=imageio.get_writer(str(dest),fps=FPS,codec='libx264',output_params=['-pix_fmt','yuv420p','-crf','17','-preset','veryfast'])
    try:
        for i in range(TOTAL):
            w.append_data(np.asarray(render(i/FPS)))
            if (i+1)%45==0:print(f'rendered {i+1}/{TOTAL}',flush=True)
    finally:w.close()
    print('render complete',dest,flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--stills',action='store_true');p.add_argument('--video',action='store_true');a=p.parse_args()
    if a.stills:stills()
    if a.video:video()
