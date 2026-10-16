/** Cinematic camera direction, pure and deterministic for Remotion seeking.
 * One physically connected clock mechanism throughout the entire shot.
 * The lens starts in front of the dial, tracks around the frame, then reveals
 * the escapement from behind and moves close enough to inspect tooth release.
 */
export type Vec3 = readonly [number, number, number];
export type CameraPose = {
  position: Vec3;
  target: Vec3;
  fov: number;
  chapter: 'whole' | 'reveal' | 'escapement' | 'dial';
};

type Key = {time: number; position: Vec3; target: Vec3; fov: number; chapter: CameraPose['chapter']};

/** Explicit directed orbit: sign of z crosses zero, not a flat XY pan. */
export const CAMERA_KEYS: readonly Key[] = [
  {time:0, position:[4.4,1.4,20.5], target:[0,-.60,0], fov:34, chapter:'whole'},
  {time:5, position:[9.8,2.5,15.1], target:[0,-.25,0], fov:34, chapter:'reveal'},
  {time:11,position:[10.3,3.1,4.6], target:[0,.45,0], fov:36, chapter:'reveal'},
  {time:17,position:[6.5,2.9,-7.8], target:[0,.92,0], fov:35, chapter:'escapement'},
  {time:23,position:[1.7,2.5,-9.0], target:[0,1.03,0], fov:35, chapter:'escapement'},
  {time:31,position:[-1.9,2.35,-6.4],target:[0,1.15,0], fov:36, chapter:'escapement'},
  {time:38,position:[-9.7,2.7,-6.2], target:[0,.70,0], fov:34, chapter:'reveal'},
  {time:44,position:[-10.5,2.3,5.5], target:[0,.35,0], fov:34, chapter:'reveal'},
  {time:50,position:[-4.2,1.6,11.3], target:[0,.52,0], fov:32, chapter:'dial'},
  {time:56,position:[1.7,1.5,15.2], target:[0,-.22,0], fov:34, chapter:'whole'},
  {time:60,position:[4.4,1.4,20.5], target:[0,-.60,0], fov:34, chapter:'whole'},
];

const interpolate = (a:number,b:number,u:number):number => a+(b-a)*u;
const smooth = (u:number):number=>u*u*(3-2*u);
const interpolateVec = (a:Vec3,b:Vec3,u:number):Vec3 => [
  interpolate(a[0],b[0],u),interpolate(a[1],b[1],u),interpolate(a[2],b[2],u),
];

/** At 30 FPS, final frame is 59.966s and seam loops to first shot. */
export function cameraAtFrame(frame:number):CameraPose {
  const t = Math.max(0,Math.min(60,frame/30));
  const segment=CAMERA_KEYS.findIndex((k,i)=>i<CAMERA_KEYS.length-1 &&
    t>=k.time && t<CAMERA_KEYS[i+1].time);
  const index=segment===-1 ? CAMERA_KEYS.length-2 : segment;
  const from=CAMERA_KEYS[index], to=CAMERA_KEYS[index+1];
  const phase=smooth(Math.max(0,Math.min(1,(t-from.time)/(to.time-from.time))));
  return {
    position:interpolateVec(from.position,to.position,phase),
    target:interpolateVec(from.target,to.target,phase),
    fov:interpolate(from.fov,to.fov,phase),
    chapter:from.chapter,
  };
}
