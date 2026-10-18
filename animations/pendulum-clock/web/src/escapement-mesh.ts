import * as THREE from 'three';
import {anchorLocalOutline,wheelOutline,WHEEL_Y} from './recoil-geometry.ts';
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
  return extrude(profile(anchorLocalOutline()),PALLET_THICKNESS,PALLET_PLANE_Z,.008,4);
}
