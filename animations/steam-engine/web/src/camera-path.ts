/** Single deterministic orbit shared by the WebGL camera and the 3D leader lines. */
import {smoothstep} from './steam-model.ts';
export type CameraTriple = [number,number,number];
export function cameraPose(t:number){
  const inspect=smoothstep((t-.78)/.43);
  const governorView=smoothstep((t-4.80)/.60);
  const valveView=smoothstep((t-8.85)/.53);
  // Actual orbit around the point of interest, not a lateral camera slide.
  // Almost 50° yaw turn toward the governor plus a modest pitch change.
  const azimuth=.43-.19*inspect-.89*governorView+.32*valveView;
  const elevation=.255+.065*inspect+.105*governorView-.035*valveView;
  const focus:CameraTriple=[
    -1.3*inspect+2.58*governorView-.14*valveView,
    .06+.12*inspect+.93*governorView+.13*valveView,
    -.22*governorView,
  ];
  const distance=14.2-.9*inspect-.7*governorView;
  const eye:CameraTriple=[
    focus[0]+distance*Math.cos(elevation)*Math.sin(azimuth),
    focus[1]+distance*Math.sin(elevation),
    focus[2]+distance*Math.cos(elevation)*Math.cos(azimuth),
  ];
  return {eye,target:focus,zoom:85+25*inspect+15*governorView+7*valveView,
    azimuth,elevation};
}
