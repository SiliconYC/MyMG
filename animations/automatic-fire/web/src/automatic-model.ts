/**
 * Storyboard in arbitrary modelling units: a visual explanation of a repeating
 * cycle, NOT a blueprint or functional fire-control reconstruction.
 *
 * Every result is a pure function of the Remotion frame, including the camera.
 */
export const FPS=30;
export const DURATION=720;
export const START=198;
export const CYCLE=96;
export const COUNT=4;
export const END=START+CYCLE*COUNT;

export const clamp01=(x:number):number=>Math.max(0,Math.min(1,x));
export const ease=(x:number):number=>{
  const t=clamp01(x);
  return t*t*(3-2*t);
};
export type Point=[number,number,number];
export type CameraPose={position:Point;target:Point;zoom:number};
export type CycleFrame={
  phase:number;
  cycleIndex:number;
  active:boolean;
  trigger:number;
  reveal:number;
  shell:number;
  recoil:number;
  ejection:number;
  feed:number;
  flash:number;
  roundLoaded:boolean;
};

/** Meaningful dolly + orbit + tracking, with real focal targets and zoom.
 * A hero view gives way to receiver closeups; the camera restores the hero
 * composition before looping to avoid a jarring jump.
 */
const SHOTS:ReadonlyArray<{frame:number;position:Point;target:Point;zoom:number}>=[
  {frame:0,   position:[6.6,3.7,18.4], target:[.3,.05,0], zoom:77},
  {frame:72,  position:[3.2,2.8,14.0], target:[.1,.25,0], zoom:89},
  {frame:160, position:[2.9,2.35,8.5], target:[-.05,.68,.1],zoom:133},
  {frame:248, position:[-.7,1.7,7.5],  target:[-.2,.70,.1],zoom:140},
  {frame:342, position:[-2.6,2.8,7.3], target:[-.65,.77,.1],zoom:146},
  {frame:439, position:[1.9,3.45,8.6], target:[.25,.78,.1],zoom:140},
  {frame:535, position:[-.8,1.25,7.9], target:[-.1,.65,.1],zoom:151},
  {frame:619, position:[3.7,2.75,12.0],target:[-.0,.36,0],zoom:99},
  {frame:719, position:[6.6,3.7,18.4], target:[.3,.05,0],zoom:77},
];
const lerp=(a:number,b:number,t:number):number=>a+(b-a)*t;
const lerpPoint=(a:Point,b:Point,t:number):Point=>[
  lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t),
];
export function cameraAt(frame:number):CameraPose{
  const f=Math.max(0,Math.min(DURATION-1,frame));
  for(let i=0;i<SHOTS.length-1;i++){
    const a=SHOTS[i],b=SHOTS[i+1];
    if(f<=b.frame){
      const t=ease((f-a.frame)/(b.frame-a.frame));
      return {position:lerpPoint(a.position,b.position,t),
        target:lerpPoint(a.target,b.target,t),zoom:lerp(a.zoom,b.zoom,t)};
    }
  }
  return {position:[...SHOTS[0].position],target:[...SHOTS[0].target],zoom:77};
}

/** Color and motion encode the logical steps, not real mechanism dimensions. */
export function cycleAt(frame:number):CycleFrame{
  const f=Math.max(0,Math.min(DURATION-1,frame));
  const active=f>=START&&f<END;
  const index=active?Math.floor((f-START)/CYCLE):(f>=END?COUNT-1:0);
  const phase=active?((f-START)%CYCLE)/CYCLE:0;
  const backwards=ease((phase-.09)/.28);
  const forwards=ease((phase-.53)/.32);
  const recoil=active?1.38*backwards*(1-forwards):0;
  const ejection=active&&phase>=.29&&phase<=.70?(phase-.29)/.41:-1;
  const feed=active?ease((phase-.57)/.32):0;
  const flash=active?Math.pow(Math.sin(Math.PI*clamp01(phase/.13)),2):0;
  const trigger=ease((f-149)/29)*(1-ease((f-606)/37));
  const reveal=ease((f-63)/102)*(1-ease((f-600)/91));
  return {
    phase,cycleIndex:index,active,trigger,reveal,
    shell:1-.97*reveal,recoil,ejection,feed,flash,
    roundLoaded:!active||phase<.10||phase>=.92,
  };
}

const WORDS=[
  {from:22,to:92,text:'為什麼能連發？'},
  {from:140,to:192,text:'扳機一直按住'},
  {from:214,to:284,text:'擊發後，槍機後退'},
  {from:324,to:390,text:'彈簧復位，送入下一發'},
  {from:468,to:536,text:'它又開始了'},
  {from:618,to:690,text:'半自動：每發都要重新扣扳機'},
] as const;

export function captionAt(frame:number):{text:string;opacity:number}{
  const cue=WORDS.find(x=>frame>=x.from&&frame<x.to);
  if(!cue)return {text:'',opacity:0};
  return {text:cue.text,opacity:ease((frame-cue.from)/15)*
    (1-ease((frame-cue.to+17)/17))};
}
