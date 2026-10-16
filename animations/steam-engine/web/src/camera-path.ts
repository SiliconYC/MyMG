/** Deterministic orbit shared by WebGL and all 3D-anchored leader lines.
 *  Short camera transfers, then LONG stable, close views for reading and
 *  comparing low/fast/recovering flyball governor states.
 */
import {smoothstep} from './steam-model.ts';
export type CameraTriple = [number,number,number];
export function cameraPose(t:number){
  const inspect=smoothstep((t-.78)/.43);
  const governorView=smoothstep((t-4.72)/.80);
  const close=smoothstep((t-5.65)/1.10);
  const valveView=smoothstep((t-12.55)/.95);
  const recovery=smoothstep((t-16.25)/.90);
  const azimuth=.43-.19*inspect-.89*governorView+.25*valveView-.11*recovery;
  const elevation=.255+.065*inspect+.105*governorView
    -.045*valveView-.015*recovery;
  const focus:CameraTriple=[
    -1.3*inspect+1.77*governorView-.12*valveView+.12*recovery,
    .24+.12*inspect+2.35*governorView-.42*valveView-.35*recovery,
    -.22*governorView+.20*close,
  ];
  const distance=14.2-.9*inspect-.7*governorView-.15*close;
  const eye:CameraTriple=[
    focus[0]+distance*Math.cos(elevation)*Math.sin(azimuth),
    focus[1]+distance*Math.sin(elevation),
    focus[2]+distance*Math.cos(elevation)*Math.cos(azimuth),
  ];
  return {
    eye,target:focus,
    zoom:85+25*inspect+26*governorView+54*close-18*valveView-20*recovery,
    azimuth,elevation,
  };
}
