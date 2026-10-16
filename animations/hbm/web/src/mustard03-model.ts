/** Mustard-03: native frame-by-frame 3D solid model, transcribed from the
 * Python reference (v3 Cam, v4 hero and v7 unified package). No image or video.
 * Camera projects REAL XYZ vertices with the original 2:1 axonometric matrix;
 * triangles are rasterised by Three.js/WebGL, not by the Python renderer. */
export type Point3 = readonly [number,number,number];
export type Point2 = readonly [number,number];
export type Primitive = {points: Point2[]; world?: Point3[]; color: string; opacity: number};
type Cam = {s:number;tx:number;ty:number;ax:number;ay:number};
type Draft = {cam:Cam; commands:Primitive[]};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export const smooth=(v:number)=>{const u=clamp(v);return u*u*(3-2*u);};
const easeout=(v:number)=>1-Math.pow(1-clamp(v),4);
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const HBM_X=2.10, HBM_Y=-0.72, DIE_SX=2.65, DIE_SY=2.12;
const BASE_Z=.17, BASE_H=.22, DIE_Z0=.46, DIE_H=.155, DIE_STEP=.225;
const ROWS=[-3.42,-.72,1.98,4.68] as const;
const LEFT=-6.8, RIGHT=2.10, GPU_X=-2.35;
const GPU_ROWS=[-1.77,3.03] as const;
const OUTT=[0,2.25,4.85,7.45,9.70,11.50];
const ORIG=[0,1.50,4.90,8.25,10.82,11.12];
export function modelTime(t:number):number {
  if(t>=11.5)return 11.12;
  for(let i=0;i<OUTT.length-1;i++){
    if(t>=OUTT[i] && t<=OUTT[i+1]){
      return lerp(ORIG[i],ORIG[i+1],(t-OUTT[i])/(OUTT[i+1]-OUTT[i]));
    }
  }
  return 0;
}
const STUDIO:Cam={s:118,tx:HBM_X,ty:HBM_Y,ax:770,ay:490};
const MACRO:Cam={s:172,tx:HBM_X+.32,ty:HBM_Y+.22,ax:875,ay:535};
const WIDE:Cam={s:43,tx:-2.35,ty:.63,ax:650,ay:443};
function mixCam(a:Cam,b:Cam,u:number):Cam {
  return {s:lerp(a.s,b.s,u),tx:lerp(a.tx,b.tx,u),
    ty:lerp(a.ty,b.ty,u),ax:lerp(a.ax,b.ax,u),ay:lerp(a.ay,b.ay,u)};
}
export function cameraAt(ot:number,packageMode:boolean):Cam {
  if(packageMode){
    if(ot<8.26)return STUDIO;
    if(ot<9.55)return mixCam(STUDIO,WIDE,smooth((ot-8.26)/1.29));
    return WIDE;
  }
  if(ot<4.92)return STUDIO;
  if(ot<5.58)return mixCam(STUDIO,MACRO,smooth((ot-4.92)/.66));
  if(ot<7.48)return MACRO;
  if(ot<8.25)return mixCam(MACRO,STUDIO,smooth((ot-7.48)/.77));
  return STUDIO;
}
function project(c:Cam,[x,y,z]:Point3):Point2 {
  const rx=x-c.tx,ry=y-c.ty;
  return [c.ax+c.s*(rx-ry),c.ay+.5*c.s*(rx+ry)-c.s*z];
}
function polygon(d:Draft,v:Point3[],col:string,opacity=1) {
  if(opacity<=0.002)return;
  d.commands.push({points:v.map(p=>project(d.cam,p)),world:v,color:col,opacity:clamp(opacity)});
}
function plane(d:Draft,p:Point2[],color:string,alpha=1){
  if(alpha>0.002)d.commands.push({points:p,color,opacity:clamp(alpha)});
}
function stroke2(d:Draft,a:Point2,b:Point2,c:string,opacity=1,width=1){
  if(opacity<=0.002)return;
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  if(len<1e-7)return;
  const nx=-dy/len*width/2,ny=dx/len*width/2;
  plane(d,[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],
    [b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]],c,opacity);
}
function path(d:Draft,pts:Point3[],color:string,opacity=1,width=1){
  for(let j=0;j<pts.length-1;j++)stroke2(d,project(d.cam,pts[j]),project(d.cam,pts[j+1]),color,opacity,width);
}
function dot(d:Draft,v:Point3,r:number,color:string,alpha=1){
  const [x,y]=project(d.cam,v);
  const pts:Point2[]=[];
  for(let k=0;k<12;k++){const a=2*Math.PI*k/12;pts.push([x+r*Math.cos(a),y+r*Math.sin(a)]);}
  plane(d,pts,color,alpha);
}
function shadow(d:Draft,x:number,y:number,sx:number,sy:number,z:number,alpha:number){
  // Approximate Pillow GaussianBlur with 25 weighted shells; no stepped slabs.
  const rings=25;
  let norm=0;
  const weights=Array.from({length:rings},(_,i)=>Math.exp(-.5*Math.pow(i/7.5,2)));
  for(const w of weights)norm+=w;
  for(let j=rings-1;j>=0;j--){
    const e=j*(1.3/d.cam.s);
    const strength=.32*alpha*weights[j]/norm;
    polygon(d,[[x-sx/2-e,y-sy/2-e,z],[x+sx/2+e,y-sy/2-e,z],
      [x+sx/2+e,y+sy/2+e,z],[x-sx/2-e,y+sy/2+e,z]],'#0f1b20',strength);
  }
}
function box(d:Draft,cx:number,cy:number,sx:number,sy:number,z:number,h:number,
  top:string,fx:string,fy:string,alpha=1,notch=0,edge=1){
  const x0=cx-sx/2,x1=cx+sx/2,y0=cy-sy/2,y1=cy+sy/2,z1=z+h;
  if(notch>0){
    const nx=x1-notch,ny=y1-notch;
    polygon(d,[[x1,y0,z],[x1,ny,z],[x1,ny,z1],[x1,y0,z1]],fx,alpha);
    polygon(d,[[x0,y1,z],[nx,y1,z],[nx,y1,z1],[x0,y1,z1]],fy,alpha);
    polygon(d,[[nx,ny,z],[nx,y1,z],[nx,y1,z1],[nx,ny,z1]],'#70878B',alpha);
    polygon(d,[[nx,ny,z],[x1,ny,z],[x1,ny,z1],[nx,ny,z1]],'#8EABA8',alpha);
    const shape:Point3[]=[[x0,y0,z1],[x1,y0,z1],[x1,ny,z1],[nx,ny,z1],[nx,y1,z1],[x0,y1,z1]];
    polygon(d,shape,top,alpha);
    path(d,[...shape,shape[0]],'#f5fdf9',.68*alpha,edge);
  }else{
    polygon(d,[[x1,y0,z],[x1,y1,z],[x1,y1,z1],[x1,y0,z1]],fx,alpha);
    polygon(d,[[x0,y1,z],[x1,y1,z],[x1,y1,z1],[x0,y1,z1]],fy,alpha);
    const shape:Point3[]=[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
    polygon(d,shape,top,alpha);
    path(d,[...shape,shape[0]],'#f5fdf9',.68*alpha,edge);
  }
  path(d,[[x0,y1,z],[notch?x1-notch:x1,y1,z]],'#223840',.28*alpha,1);
}
function inlay(d:Draft,x:number,y:number,z:number,a:number){
  path(d,[[x-1.02,y-.75,z],[x+1.02,y-.75,z],[x+1.02,y+.75,z],
    [x-1.02,y+.75,z],[x-1.02,y-.75,z]],'#f7fdf9',a*.36,1);
}
function contacts(d:Draft,x:number,y:number,z:number,alpha:number){
  for(let k=0;k<8;k++)dot(d,[x-.85+k*.25,y+DIE_SY/2+.052,z+.075],1.45,'#f8d89e',alpha*.74);
}
function seams(d:Draft,x:number,y:number,z:number,alpha:number){
  for(let j=0;j<9;j++){
    const px=x-.96+j*.24;
    path(d,[[px,y+DIE_SY/2,z+.045],[px,y+DIE_SY/2,z+.11]],'#e0e5e2',.61*alpha,
      Math.max(1,Math.round(d.cam.s/66)));
  }
}
function unifiedStack(d:Draft,x:number,y:number,alpha=1,rise=0,shadowAlpha=1) {
  if(alpha<.002)return;
  shadow(d,x,y,DIE_SX,DIE_SY,BASE_Z-.052,alpha*shadowAlpha*.7);
  box(d,x,y,DIE_SX+.08,DIE_SY+.07,BASE_Z+rise,BASE_H,
    '#C7A575','#8E6943','#AE8557',alpha);
  contacts(d,x,y,BASE_Z+rise,alpha);
  for(let k=0;k<4;k++){
    const z=DIE_Z0+k*DIE_STEP+rise;
    box(d,x,y,DIE_SX,DIE_SY,z,DIE_H,'#BBC9CC','#5B7379','#86999B',alpha,0,d.cam.s>72?2:1);
    inlay(d,x,y,z+DIE_H+.004,alpha);
    seams(d,x,y,z,alpha);
  }
}
const STARTS=[.10,1.72,2.18,2.48],LENGTHS=[.38,.34,.28,.25];
function hero(d:Draft,t:number){
  const x=HBM_X,y=HBM_Y;
  // Python Mustard-03 accelerates collapse of TSV before the wide shot.
  const ot=t>7.57?t+.72*smooth((t-7.57)/.68):t;
  shadow(d,x,y,DIE_SX+.15,DIE_SY+.12,BASE_Z-.04,.8);
  const on=easeout((ot-1.55)/.32);
  if(on>0){
    const bz=BASE_Z-.25*(1-on);
    box(d,x,y,DIE_SX+.08,DIE_SY+.07,bz,BASE_H,'#C7A575','#8E6943','#AE8557',1);
    if(on>.95)contacts(d,x,y,bz,1);
  }
  const cut=smooth((ot-5.46)/.42)*(1-smooth((ot-8.33)/.52));
  const lifted=smooth((ot-5.42)/.49)*(1-smooth((ot-8.33)/.52));
  for(let k=0;k<4;k++){
    if(ot<STARTS[k])continue;
    const falling=easeout((ot-STARTS[k])/LENGTHS[k]);
    const z=DIE_Z0+k*DIE_STEP+(1-falling)*(k===0?.65:.82)+lifted*.067*k;
    box(d,x,y,DIE_SX,DIE_SY,z,DIE_H,'#BBC9CC','#5B7379','#86999B',1,.64*cut,2);
    if(cut<.3)inlay(d,x,y,z+DIE_H+.003,1);
    seams(d,x,y,z,1);
    if(cut>.1){
      for(let j=0;j<3;j++){
        const xx=x+.65+j*.14, yy=y+.57;
        path(d,[[xx,yy,z+.015],[xx,yy,z+DIE_H-.015]],'#cf8736',cut*.94,
          Math.max(3,Math.round(d.cam.s/26)));
        dot(d,[xx,yy,z+.015],3,'#f6ce85',cut*.94);
        dot(d,[xx,yy,z+DIE_H-.015],3,'#f6ce85',cut*.94);
      }
    }
  }
  const copper=smooth((ot-6.02)/.32)*(1-smooth((ot-8.33)/.52));
  if(copper>.01){
    for(let j=0;j<3;j++){
      const xx=x+.65+j*.14, yy=y+.57;
      for(let k=0;k<4;k++){
        const z=DIE_Z0+k*DIE_STEP+lifted*.067*k;
        path(d,[[xx,yy,z+.015],[xx,yy,z+DIE_H-.015]],'#c3803c',copper*.86,3);
        if(k<3){
          const zNext=DIE_Z0+(k+1)*DIE_STEP+lifted*.067*(k+1);
          path(d,[[xx,yy,z+DIE_H+.012],[xx,yy,zNext-.012]],'#d99d4f',copper*.77,3);
        }
      }
      const pulse=clamp((ot-6.69)/.56);
      if(pulse>0&&pulse<1)dot(d,[xx,yy,DIE_Z0+.1+(DIE_STEP*3+DIE_H-.12)*pulse],
        5,'#ffe4a4',copper*.94);
    }
  }
}
function gpu(d:Draft,x:number,y:number,t:number,start:number){
  const p=clamp((t-start)/.76);
  if(p<=0)return;
  const land=easeout(p),alpha=smooth(p/.46);
  const z=.15-.28*(1-land);
  shadow(d,x,y,4.05,4.25,z-.05,.5*land*alpha);
  // Python v6.gpu_new: three solid faces and an inset. No old v5 ticks.
  const sx=4.05,sy=4.25,x0=x-sx/2,x1=x+sx/2,y0=y-sy/2,y1=y+sy/2,z1=z+.48;
  polygon(d,[[x1,y0,z],[x1,y1,z],[x1,y1,z1],[x1,y0,z1]],'#25374A',alpha);
  polygon(d,[[x0,y1,z],[x1,y1,z],[x1,y1,z1],[x0,y1,z1]],'#33485E',alpha);
  polygon(d,[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],'#43586D',alpha);
  const ix=4.05*.7,iy=4.25*.72,zt=z1+.001;
  path(d,[[x-ix/2,y-iy/2,zt],[x+ix/2,y-iy/2,zt],
    [x+ix/2,y+iy/2,zt],[x-ix/2,y+iy/2,zt],
    [x-ix/2,y-iy/2,zt]],'#c1dce5',.46*alpha,1);
}
function support(d:Draft,t:number){
  const alpha=smooth((t-9.23)/.70);
  if(alpha<=0)return;
  shadow(d,-2.35,.63,12,11.3,-.48,.9*alpha);
  box(d,-2.35,.63,12,11.3,-.42,.49,'#54696C','#253A41','#324952',alpha,0,2);
  // 24 fully routed GPU-to-HBM traces, with true endpoints beneath chip footprints.
  let k=0;
  for(const x of [LEFT,RIGHT])for(let row=0;row<4;row++){
    const y=ROWS[row];
    for(const delta of [-.34,0,.34]){
      const pY=y+delta,right=x===RIGHT;
      const x1=right?GPU_X+4.05/2-.28:GPU_X-4.05/2+.28;
      const x2=right?x-DIE_SX/2+.28:x+DIE_SX/2-.28;
      const amount=easeout((t-10.42-row*.055-(right?.045:0))/.46);
      if(amount>0){
        const xx=lerp(x1,x2,amount);
        path(d,[[x1,pY,.086],[xx,pY,.086]],k%3===0?'#cda169':'#7eb0a8',alpha*.84,2);
        const u=(t-11.2-row*.04-(k%3)*.045)/.59;
        if(u>=0&&u<=1&&amount>.97)
          dot(d,[lerp(x1,x2,smooth(u)),pY,.088],Math.max(2,Math.min(4,d.cam.s*.062)),
            '#efc47c',alpha*.82);
      }
      k++;
    }
  }
}
function packageScene(d:Draft,t:number){
  support(d,t);
  const other: [number,number][]=[];
  for(const x of [LEFT,RIGHT])for(const y of ROWS){
    if(x===RIGHT && y===HBM_Y)continue;
    other.push([x,y]);
  }
  other.sort((a,b)=>Math.abs(a[1]-.63)-Math.abs(b[1]-.63)||
    (a[0]===RIGHT?-1:1)-(b[0]===RIGHT?-1:1)||a[1]-b[1]);
  const starts=[9.63,9.68,9.73,9.78,9.83,9.88,9.93];
  const entities: {kind:'gpu'|'stack'|'hero';x:number;y:number;start:number}[]=[
    ...GPU_ROWS.map((y,i)=>({kind:'gpu' as const,x:GPU_X,y,start:9.43+i*.055})),
    ...other.map(([x,y],i)=>({kind:'stack' as const,x,y,start:starts[i]})),
    {kind:'hero',x:RIGHT,y:HBM_Y,start:0}
  ];
  // Preserve Python painter sorting of all GPUs and HBM packages by x+y.
  entities.sort((a,b)=>(a.x+a.y)-(b.x+b.y)||a.x-b.x||a.kind.localeCompare(b.kind));
  for(const e of entities){
    if(e.kind==='gpu')gpu(d,e.x,e.y,t,e.start);
    else if(e.kind==='hero')unifiedStack(d,e.x,e.y);
    else {
      const p=clamp((t-e.start)/.47),alpha=smooth(p);
      unifiedStack(d,e.x,e.y,alpha,(1-alpha)*.20,alpha);
    }
  }
}
export function buildScene(frame:number):Primitive[] {
  const t=clamp(frame/345)*11.5;
  const ot=modelTime(t),packageMode=ot>=8.25;
  const d:Draft={cam:cameraAt(ot,packageMode),commands:[]};
  if(packageMode)packageScene(d,ot);
  else hero(d,ot);
  return d.commands;
}
export const HBM_REFERENCE={OUTT,ORIG,STUDIO,MACRO,WIDE,ROWS,LEFT,RIGHT,FRAMES:345,FPS:30};
