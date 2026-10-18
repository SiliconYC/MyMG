/** Purposeful 3D camera: extended LOCKED perspectives, brief clear transfers.
 * All actual motion is between stationary explanatory views of the SAME object.
 * No aimless orbit or extreme left/right macro viewpoint alternation.
 */
export type Vec3=readonly [number,number,number];
export type Chapter='front'|'rear'|'contact'|'proof';
export type CameraPose={
  position:Vec3; target:Vec3; fov:number;
  chapter:Chapter; mode:'observe'|'travel';
};
type Shot={
  start:number;end:number; positionFrom:Vec3;positionTo:Vec3;
  targetFrom:Vec3;targetTo:Vec3;fovFrom:number;fovTo:number;
  chapter:Chapter;mode:CameraPose['mode'];
};
const FRONT:Vec3=[0,1.2,14.5];
const FRONT_AIM:Vec3=[0,-.4,0];

/** Four purposeful views, with compact transfers and a 30-second runtime. */
export const SHOTS:readonly Shot[]=[
  {start:0,end:4,positionFrom:FRONT,positionTo:FRONT,
    targetFrom:FRONT_AIM,targetTo:FRONT_AIM,
    fovFrom:35,fovTo:35,chapter:'front',mode:'observe'},
  {start:4,end:4.7,positionFrom:FRONT,positionTo:[8,1.8,6],
    targetFrom:FRONT_AIM,targetTo:[0,.8,0],
    fovFrom:35,fovTo:37,chapter:'rear',mode:'travel'},
  {start:4.7,end:8,positionFrom:[8,1.8,6],positionTo:[8,1.8,6],
    targetFrom:[0,.8,0],targetTo:[0,.8,0],
    fovFrom:37,fovTo:37,chapter:'rear',mode:'observe'},
  {start:8,end:8.9,positionFrom:[8,1.8,6],positionTo:[0,1.95,-4.1],
    targetFrom:[0,.8,0],targetTo:[0,1.62,0],
    fovFrom:37,fovTo:31,chapter:'contact',mode:'travel'},
  {start:8.9,end:17,positionFrom:[0,1.95,-4.1],positionTo:[0,1.95,-4.1],
    targetFrom:[0,1.62,0],targetTo:[0,1.62,0],
    fovFrom:31,fovTo:31,chapter:'contact',mode:'observe'},
  {start:17,end:17.8,positionFrom:[0,1.95,-4.1],positionTo:[-7.9,1.9,-5],
    targetFrom:[0,1.62,0],targetTo:[0,.95,0],
    fovFrom:31,fovTo:35,chapter:'proof',mode:'travel'},
  {start:17.8,end:18.5,positionFrom:[-7.9,1.9,-5],positionTo:[-7.2,1.6,6],
    targetFrom:[0,.95,0],targetTo:[0,.65,0],
    fovFrom:35,fovTo:35,chapter:'proof',mode:'travel'},
  {start:18.5,end:19.2,positionFrom:[-7.2,1.6,6],positionTo:[0,1.5,12],
    targetFrom:[0,.65,0],targetTo:[0,.55,0],
    fovFrom:35,fovTo:33,chapter:'proof',mode:'travel'},
  {start:19.2,end:25.5,positionFrom:[0,1.5,12],positionTo:[0,1.5,12],
    targetFrom:[0,.55,0],targetTo:[0,.55,0],
    fovFrom:33,fovTo:33,chapter:'proof',mode:'observe'},
  {start:25.5,end:26.2,positionFrom:[0,1.5,12],positionTo:FRONT,
    targetFrom:[0,.55,0],targetTo:FRONT_AIM,
    fovFrom:33,fovTo:35,chapter:'front',mode:'travel'},
  {start:26.2,end:30,positionFrom:FRONT,positionTo:FRONT,
    targetFrom:FRONT_AIM,targetTo:FRONT_AIM,
    fovFrom:35,fovTo:35,chapter:'front',mode:'observe'},
];
const lerp=(a:number,b:number,u:number):number=>a+(b-a)*u;
const lerp3=(a:Vec3,b:Vec3,u:number):Vec3=>[
  lerp(a[0],b[0],u),lerp(a[1],b[1],u),lerp(a[2],b[2],u),
];
const smootherstep=(v:number):number=>{
  const u=Math.max(0,Math.min(1,v));
  return u*u*u*(u*(6*u-15)+10);
};
export function cameraAtFrame(frame:number):CameraPose {
  const t=Math.max(0,Math.min(30,frame/30));
  const shot=SHOTS.find(s=>t>=s.start && t<s.end)??SHOTS[SHOTS.length-1];
  const u=smootherstep((t-shot.start)/(shot.end-shot.start));
  return {
    position:lerp3(shot.positionFrom,shot.positionTo,u),
    target:lerp3(shot.targetFrom,shot.targetTo,u),
    fov:lerp(shot.fovFrom,shot.fovTo,u),
    chapter:shot.chapter,mode:shot.mode,
  };
}
