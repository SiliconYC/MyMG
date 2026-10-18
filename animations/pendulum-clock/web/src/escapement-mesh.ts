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

/** The visible fork is made from one cubic parameterization, fitted between
 * matching boundary controls for each fixed shoe. Both arms share its smooth
 * Bernstein progression and continue directly into the contact shoes.
 */
export function makeAnchorVisualGeometries():THREE.BufferGeometry[]{
  const {entry,exit}=FACES;
  const hub=new THREE.Shape();
  hub.absellipse(0,.033,.04,.05,0,Math.PI*2,false,0);
  const sweptBetweenBoundaries=(outer:readonly (readonly [number,number])[],
    inner:readonly (readonly [number,number])[],root:readonly [number,number])=>{
    // Both sides use the same Bernstein parameter t. Averaging corresponding
    // boundary controls gives the centerline with no spline joins or endpoint
    // kinks. The start is tucked into the common pivot hub.
    const controls=outer.map((p,i)=>[(p[0]+inner[i][0])/2,(p[1]+inner[i][1])/2] as const);
    controls[0]=root;
    const [a,b,c,d]=controls.map(([x,y])=>new THREE.Vector3(x,y,PALLET_PLANE_Z));
    return new THREE.TubeGeometry(new THREE.CubicBezierCurve3(a,b,c,d),128,.0095,12,false);
  };
  const rightBack=exit.polygon[3],leftBack=entry.polygon[3];
  const rightRod=sweptBetweenBoundaries(
    [[.085,.035],[.36,.005],[rightBack[0]+.06,rightBack[1]+.22],rightBack],
    [[.04,-.07],[.34,-.09],[exit.heel[0]-.09,exit.heel[1]+.09],exit.heel],
    [.04,.035],
  );
  const leftRod=sweptBetweenBoundaries(
    [[-.085,.035],[-.36,.005],[leftBack[0]+.09,leftBack[1]+.08],leftBack],
    [[-.085,.035],[-.36,.005],[entry.heel[0]-.04,entry.heel[1]+.23],entry.heel],
    [-.04,.035],
  );

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
