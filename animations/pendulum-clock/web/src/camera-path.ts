/** Frame-deterministic, continuous perspective tour of ONE mechanism.
 * Long observation shots and short, decisive transfers replace a constant orbit.
 * A hold is allowed a tiny dolly, but not a distracting long camera journey.
 */
export type Vec3 = readonly [number,number,number];
export type Chapter = 'front' | 'rear' | 'entry' | 'exit' | 'proof';
export type CameraPose = {
  position: Vec3;
  target: Vec3;
  fov: number;
  chapter: Chapter;
  mode: 'observe' | 'travel';
};
type Shot = {
  start:number; end:number;
  positionFrom:Vec3; positionTo:Vec3;
  targetFrom:Vec3; targetTo:Vec3;
  fovFrom:number; fovTo:number;
  chapter:Chapter; mode:CameraPose['mode'];
};
const FRONT:[number,number,number]=[3.3,1.4,15];
const FRONT_TARGET:[number,number,number]=[0,-.15,0];
/** Each adjoining interval starts exactly at the previous interval's last pose. */
export const SHOTS: readonly Shot[] = [
  {start:0,end:4.6,positionFrom:FRONT,positionTo:[3.1,1.5,14.6],
    targetFrom:FRONT_TARGET,targetTo:[0,-.12,0],fovFrom:33,fovTo:33,chapter:'front',mode:'observe'},
  {start:4.6,end:5.5,positionFrom:[3.1,1.5,14.6],positionTo:[12,2.4,8],
    targetFrom:[0,-.12,0],targetTo:[0,.75,0],fovFrom:33,fovTo:35,chapter:'rear',mode:'travel'},
  {start:5.5,end:6.4,positionFrom:[12,2.4,8],positionTo:[8.2,2.3,-7.3],
    targetFrom:[0,.75,0],targetTo:[0,1.25,0],fovFrom:35,fovTo:35,chapter:'rear',mode:'travel'},
  {start:6.4,end:12.2,positionFrom:[8.2,2.3,-7.3],positionTo:[7.6,2.35,-7.5],
    targetFrom:[0,1.25,0],targetTo:[0,1.3,0],fovFrom:35,fovTo:35,chapter:'rear',mode:'observe'},
  {start:12.2,end:13.7,positionFrom:[7.6,2.35,-7.5],positionTo:[0,2.2,-3.8],
    targetFrom:[0,1.3,0],targetTo:[-.95,1.62,0],fovFrom:35,fovTo:28,chapter:'entry',mode:'travel'},
  {start:13.7,end:22.4,positionFrom:[0,2.2,-3.8],positionTo:[.18,2.23,-3.65],
    targetFrom:[-.95,1.62,0],targetTo:[-.90,1.62,0],fovFrom:28,fovTo:28,chapter:'entry',mode:'observe'},
  {start:22.4,end:23.6,positionFrom:[.18,2.23,-3.65],positionTo:[-.2,2.3,-3.8],
    targetFrom:[-.90,1.62,0],targetTo:[1,1.62,0],fovFrom:28,fovTo:28,chapter:'exit',mode:'travel'},
  {start:23.6,end:32,positionFrom:[-.2,2.3,-3.8],positionTo:[-.05,2.28,-3.6],
    targetFrom:[1,1.62,0],targetTo:[1.05,1.63,0],fovFrom:28,fovTo:28,chapter:'exit',mode:'observe'},
  {start:32,end:33.3,positionFrom:[-.05,2.28,-3.6],positionTo:[-8.3,2.7,-7.4],
    targetFrom:[1.05,1.63,0],targetTo:[0,1.2,0],fovFrom:28,fovTo:35,chapter:'rear',mode:'travel'},
  {start:33.3,end:41.7,positionFrom:[-8.3,2.7,-7.4],positionTo:[-7.8,2.55,-7.5],
    targetFrom:[0,1.2,0],targetTo:[0,1.25,0],fovFrom:35,fovTo:35,chapter:'rear',mode:'observe'},
  {start:41.7,end:42.7,positionFrom:[-7.8,2.55,-7.5],positionTo:[-11,2.0,4],
    targetFrom:[0,1.25,0],targetTo:[0,.8,0],fovFrom:35,fovTo:34,chapter:'proof',mode:'travel'},
  {start:42.7,end:43.6,positionFrom:[-11,2.0,4],positionTo:[-1.5,1.5,11.8],
    targetFrom:[0,.8,0],targetTo:[0,.6,0],fovFrom:34,fovTo:31,chapter:'proof',mode:'travel'},
  {start:43.6,end:51.7,positionFrom:[-1.5,1.5,11.8],positionTo:[-1.3,1.5,11.5],
    targetFrom:[0,.6,0],targetTo:[0,.6,0],fovFrom:31,fovTo:31,chapter:'proof',mode:'observe'},
  {start:51.7,end:52.8,positionFrom:[-1.3,1.5,11.5],positionTo:[2.8,1.6,15.4],
    targetFrom:[0,.6,0],targetTo:[0,-.10,0],fovFrom:31,fovTo:33,chapter:'front',mode:'travel'},
  {start:52.8,end:59.2,positionFrom:[2.8,1.6,15.4],positionTo:[3.15,1.48,14.8],
    targetFrom:[0,-.10,0],targetTo:[0,-.14,0],fovFrom:33,fovTo:33,chapter:'front',mode:'observe'},
  {start:59.2,end:60,positionFrom:[3.15,1.48,14.8],positionTo:FRONT,
    targetFrom:[0,-.14,0],targetTo:FRONT_TARGET,fovFrom:33,fovTo:33,chapter:'front',mode:'travel'},
];
const lerp=(a:number,b:number,t:number):number=>a+(b-a)*t;
const lerpVec=(a:Vec3,b:Vec3,t:number):Vec3=>[
  lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t),
];
const clamp=(x:number):number=>Math.max(0,Math.min(1,x));
/** Smootherstep has zero first and second derivatives at shot boundaries. */
const ease=(x:number):number=>{
  const t=clamp(x);return t*t*t*(t*(6*t-15)+10);
};
export function cameraAtFrame(frame:number):CameraPose {
  const seconds=clamp(frame/30/60)*60;
  const shot=SHOTS.find(s=>seconds>=s.start&&seconds<s.end)??SHOTS[SHOTS.length-1];
  const u=ease((seconds-shot.start)/(shot.end-shot.start));
  return {
    position:lerpVec(shot.positionFrom,shot.positionTo,u),
    target:lerpVec(shot.targetFrom,shot.targetTo,u),
    fov:lerp(shot.fovFrom,shot.fovTo,u),
    chapter:shot.chapter,
    mode:shot.mode,
  };
}
