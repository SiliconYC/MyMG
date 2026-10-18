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

/** The visible fork is made from two halves of one vertex-up parabola. Its
 * apex sits at the top pivot, and each half ends inside its fixed contact shoe.
 */
export function makeAnchorVisualGeometries():THREE.BufferGeometry[]{
  const {entry,exit}=FACES;
  const hub=new THREE.Shape();
  hub.absellipse(0,.033,.04,.05,0,Math.PI*2,false,0);
  const apex:[number,number]=[0,.033];
  const parabolicArm=(end:readonly [number,number])=>{
    // Quadratic Bézier parameterization of y = apexY - k*x²: the control
    // point keeps the tangent horizontal at the apex. Both arms use this same
    // curve and remain tucked into the hub until they emerge at its shoulders.
    const a=new THREE.Vector3(apex[0],apex[1],PALLET_PLANE_Z);
    const b=new THREE.Vector3(end[0]/2,apex[1],PALLET_PLANE_Z);
    const c=new THREE.Vector3(end[0],end[1],PALLET_PLANE_Z);
    return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a,b,c),128,.0095,12,false);
  };
  const rightTip:[number,number]=[(exit.heel[0]+exit.polygon[3][0])/2,
    (exit.heel[1]+exit.polygon[3][1])/2];
  const leftTip=entry.polygon[3];
  const rightRod=parabolicArm(rightTip);
  const leftRod=parabolicArm(leftTip);

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
