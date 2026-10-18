import * as THREE from 'three';
import {FACES,anchorLocalOutline,wheelOutline,WHEEL_Y} from './recoil-geometry.ts';
import {WHEEL_THICKNESS,WHEEL_PLANE_Z,PALLET_THICKNESS,PALLET_PLANE_Z} from './escapement-axial.ts';

function profile(points:readonly (readonly [number,number])[]):THREE.Shape{
  const shape=new THREE.Shape();shape.moveTo(...points[0]);
  for(const p of points.slice(1))shape.lineTo(...p);
  shape.closePath();return shape;
}
/** The chamfer is INSET: at its widest plane the XY solid is exactly the
 * audited profile. Default outward Three.js bevels would penetrate at contact.
 */
function extrude(shape:THREE.Shape,depth:number,z:number,bevelSize=.003,bevelSegments=2):THREE.ExtrudeGeometry{
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,steps:1,
    bevelEnabled:true,bevelSize,bevelOffset:-bevelSize,
    bevelThickness:.003,bevelSegments,curveSegments:64});
  geometry.translate(0,0,z-depth/2);return geometry;
}
export function makeEscapeWheel():THREE.ExtrudeGeometry{
  const shape=profile(wheelOutline(0).map(([x,y])=>[x,y-WHEEL_Y]));
  const hole=new THREE.Path();hole.absarc(0,0,.58,0,Math.PI*2,true);
  shape.holes.push(hole);
  return extrude(shape,WHEEL_THICKNESS,WHEEL_PLANE_Z);
}
export function makeAnchorGeometry():THREE.ExtrudeGeometry{
  return extrude(profile(anchorLocalOutline()),PALLET_THICKNESS,PALLET_PLANE_Z,.003,4);
}

/** The visible fork uses two independent swept arms, leaving the space
 * between them open. The contact shoes reuse the audited working-face points;
 * each round arm follows the original certified anchor envelope.
 */
export function makeAnchorVisualGeometries():THREE.BufferGeometry[]{
  const {entry,exit}=FACES;
  const rightBack=exit.polygon[3],leftBack=entry.polygon[3];
  const hub=new THREE.Shape();
  hub.absellipse(0,.033,.04,.05,0,Math.PI*2,false,0);
  const bezier=(a:readonly [number,number],b:readonly [number,number],
    c:readonly [number,number],d:readonly [number,number],t:number):[number,number]=>{
    const u=1-t;
    return [u**3*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t**3*d[0],
      u**3*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t**3*d[1]];
  };
  const between=(a:readonly [number,number],b:readonly [number,number],
    c:readonly [number,number],d:readonly [number,number],
    e:readonly [number,number],f:readonly [number,number],
    g:readonly [number,number],h:readonly [number,number])=>
    Array.from({length:49},(_,i)=>{
      const t=i/48,p=bezier(a,b,c,d,t),q=bezier(e,f,g,h,t);
      return [(p[0]+q[0])/2,(p[1]+q[1])/2] as const;
    });
  const rod=(points:readonly (readonly [number,number])[])=>{
    const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>
      new THREE.Vector3(x,y,PALLET_PLANE_Z)),false,'centripetal');
    return new THREE.TubeGeometry(curve,96,.0095,12,false);
  };
  const rightSpine=between([.085,.035],[.36,.005],
    [rightBack[0]+.06,rightBack[1]+.22],rightBack,
    [.04,-.07],[.34,-.09],[exit.heel[0]-.09,exit.heel[1]+.09],exit.heel);
  const leftSpine=between([-.085,.035],[-.36,.005],
    [leftBack[0]+.09,leftBack[1]+.08],leftBack,
    [-.085,.035],[-.36,.005],[entry.heel[0]-.04,entry.heel[1]+.23],entry.heel);
  const rightRod=rod([[0,.035],...rightSpine.slice(0,-2)]);
  const leftRod=rod([[0,.01],...leftSpine.slice(4,-2)]);

  const shoe=(face:typeof entry)=>{
    const geometry=new THREE.ExtrudeGeometry(profile(face.polygon),{
      depth:PALLET_THICKNESS,steps:1,bevelEnabled:false,curveSegments:32,
    });
    geometry.translate(0,0,PALLET_PLANE_Z-PALLET_THICKNESS/2);
    return geometry;
  };

  return [
    extrude(hub,PALLET_THICKNESS,PALLET_PLANE_Z,.003,4),
    rightRod,leftRod,
    shoe(entry),shoe(exit),
  ];
}
