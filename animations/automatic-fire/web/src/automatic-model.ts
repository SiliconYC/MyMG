/**
 * Conceptual automatic cycling illustration, NOT a functional firearm blueprint.
 * Dimensions and timing are arbitrary visual units. Every image is frame-derived.
 */
export const FPS = 30;
export const DURATION = 720;
export const START = 165;
export const CYCLE = 110;
export const COUNT = 4;
export const END = START + CYCLE * COUNT;
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const ease = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
export type Point = [number, number, number];
export type CameraPose = {position: Point; target: Point};
export type CycleFrame = {
  phase: number; cycleIndex: number; trigger: number; shell: number;
  recoil: number; ejection: number; feed: number; flash: number;
  active: boolean;
};
const KEYFRAMES: ReadonlyArray<{f: number; position: Point; target: Point}> = [
  {f:0,   position:[8.0,3.6,12.7], target:[0,0,0]},
  {f:96,  position:[4.1,3.0,8.5],  target:[-.1,-.1,0]},
  {f:190, position:[-.7,2.5,6.5], target:[-.5,-.1,0]},
  {f:285, position:[2.8,2.6,6.1], target:[1.0,.1,0]},
  {f:385, position:[-3.0,2.8,6.0],target:[-1.9,.1,0]},
  {f:490, position:[-1.3,-.8,7.6],target:[-.2,-.8,0]},
  {f:586, position:[2.6,1.9,7.5], target:[1,.0,0]},
  {f:719, position:[8.0,3.6,12.7],target:[0,0,0]},
];
export function cameraAt(frame: number): CameraPose {
  const f = Math.max(0, Math.min(DURATION - 1, frame));
  for (let i=0; i<KEYFRAMES.length-1; i++) {
    const a=KEYFRAMES[i], b=KEYFRAMES[i+1];
    if (f<=b.f) {
      const t=ease((f-a.f)/(b.f-a.f));
      const mix=(p: Point,q:Point):Point=>[
        p[0]+(q[0]-p[0])*t,
        p[1]+(q[1]-p[1])*t,
        p[2]+(q[2]-p[2])*t,
      ];
      return {position:mix(a.position,b.position), target:mix(a.target,b.target)};
    }
  }
  return {position:[...KEYFRAMES[0].position],target:[0,0,0]};
}
export function cycleAt(frame: number): CycleFrame {
  const f = Math.max(0, Math.min(DURATION-1, frame));
  const active=f>=START && f<END;
  const elapsed=Math.max(0,Math.min(END-START-.000001,f-START));
  const index=active ? Math.floor(elapsed/CYCLE) : (f>=END?COUNT-1:0);
  const phase=active ? (elapsed%CYCLE)/CYCLE : 0;
  // A visible pulse followed by retreat, extraction and spring-driven return.
  const backward=ease((phase-.10)/.32);
  const forward=ease((phase-.57)/.32);
  const recoil=active ? 1.62*backward*(1-forward) : 0;
  const ejection=active && phase>.31 && phase<.67 ? (phase-.31)/.36 : -1;
  const feed=active ? ease((phase-.57)/.35) : (f>=END?1:0);
  const flash=active ? Math.sin(Math.PI*clamp01(phase/.11))**2 : 0;
  const trigger=ease((f-100)/32)*(1-ease((f-638)/40));
  const shell=1-.93*ease((f-84)/82)*(1-ease((f-640)/71));
  return {phase,cycleIndex:index,trigger,shell,recoil,ejection,feed,flash,active};
}
/** Sparse captions: one short thought at a time, never a permanent HUD. */
export function captionAt(frame: number): {text: string; opacity:number} {
  const cues=[
    {from:18,to:91,text:'連發的秘密'},
    {from:112,to:162,text:'扳機持續按住'},
    {from:190,to:252,text:'擊發後，槍機自行後退'},
    {from:329,to:385,text:'彈簧推回，完成裝填'},
    {from:494,to:554,text:'循環再次開始'},
    {from:620,to:687,text:'無需再次扣動扳機'},
  ];
  const cue=cues.find(c=>frame>=c.from&&frame<c.to);
  if (!cue)return {text:'',opacity:0};
  return {text:cue.text,opacity:ease((frame-cue.from)/13)*(1-ease((frame-cue.to+14)/14))};
}
