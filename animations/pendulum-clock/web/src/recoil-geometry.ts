/** Static construction of a recoil anchor. Coordinates are scene units, +Y up.
 * Angles are clockwise from +Y, matching both shafts in the Three.js scene.
 * The finite inclined faces, not a timed release, determine the lift/drop.
 */
export type Point=readonly [number,number];
export type Side='entry'|'exit';
export const TEETH=30;
export const PITCH=2*Math.PI/TEETH;
export const WHEEL_Y=.6;
export const OUTER_RADIUS=.93;
export const ROOT_RADIUS=.72;
export const PIVOT_Y=WHEEL_Y+Math.SQRT2*OUTER_RADIUS;
export const rotate=(p:Point,a:number):Point=>[
  p[0]*Math.cos(a)+p[1]*Math.sin(a),
  -p[0]*Math.sin(a)+p[1]*Math.cos(a),
];
export const add=(a:Point,b:Point):Point=>[a[0]+b[0],a[1]+b[1]];
export const sub=(a:Point,b:Point):Point=>[a[0]-b[0],a[1]-b[1]];
export const dot=(a:Point,b:Point)=>a[0]*b[0]+a[1]*b[1];
export const scale=(p:Point,s:number):Point=>[p[0]*s,p[1]*s];
export const polar=(r:number,a:number):Point=>[r*Math.sin(a),r*Math.cos(a)];
export const anchorWorld=(p:Point,a:number):Point=>add(rotate(p,a),[0,PIVOT_Y]);
export const wheelWorld=(p:Point,a:number):Point=>add(rotate(p,a),[0,WHEEL_Y]);

export type WorkingFace={heel:Point;toe:Point;normal:Point;tangent:Point;polygon:readonly Point[]};
function workingFace(side:Side):WorkingFace{
  const beta=(side==='entry'?-1:1)*Math.PI/4;
  const origin=sub(polar(OUTER_RADIUS,beta),[0,PIVOT_Y-WHEEL_Y]);
  const alpha=(side==='entry'?-10:-80)*Math.PI/180;
  const tangent:Point=[Math.cos(alpha),Math.sin(alpha)];
  const normal:Point=[-tangent[1],tangent[0]]; // material is on this side
  const at=(angle:number):Point=>{
    const a=add(rotate(origin,angle),[0,PIVOT_Y-WHEEL_Y]);
    const t=rotate(tangent,angle),b=dot(a,t);
    const root=Math.sqrt(b*b-dot(a,a)+OUTER_RADIUS**2);
    const u1=-b+root,u2=-b-root;
    return add(origin,scale(tangent,Math.abs(u1)<Math.abs(u2)?u1:u2));
  };
  const heel=at(side==='entry'?-.13:.13);
  const toe=at(side==='entry'?.027:-.027);
  return {heel,toe,normal,tangent,polygon:[heel,toe,
    add(toe,scale(normal,.022)),add(heel,scale(normal,.070))]};
}
export const FACES:Readonly<Record<Side,WorkingFace>>={
  entry:workingFace('entry'),exit:workingFace('exit'),
};

/** Clockwise, backward-leaning sharp teeth. Tip width is a real finite land.
 * The exact same four vertices are used for collision and extrusion.
 */
export const WHEEL_PROFILE:readonly Point[]=[
  [.64,ROOT_RADIUS],[.975,OUTER_RADIUS],[1,OUTER_RADIUS],[1,ROOT_RADIUS],
];
export function toothLocal(index:number):Point[]{
  return WHEEL_PROFILE.map(([u,r])=>polar(r,(index+u)*PITCH));
}
export function toothWorld(index:number,angle:number):Point[]{
  return toothLocal(index).map(p=>wheelWorld(p,angle));
}
export function wheelOutline(angle:number):Point[]{
  return Array.from({length:TEETH},(_,i)=>toothWorld(i,angle)).flat();
}
export function palletOutline(side:Side,angle:number):Point[]{
  return FACES[side].polygon.map(p=>anchorWorld(p,angle));
}

function cubic(a:Point,b:Point,c:Point,d:Point):Point[]{
  return Array.from({length:33},(_,i)=>{
    const t=i/32,u=1-t;
    return [u**3*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t**3*d[0],
      u**3*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t**3*d[1]] as Point;
  });
}
/** One continuous, slim swept anchor. The terminal working edges are exact
 * members of FACES, with no tip-relief or independently positioned shoes.
 */
export function anchorLocalOutline():Point[]{
  const e=FACES.entry,x=FACES.exit;
  const eBack=e.polygon[3];
  const xBack=x.polygon[3];
  const path:Point[]=[[-.085,.035],[-.065,.072],[-.035,.094],[0,.10],[.035,.094],[.065,.072],[.085,.035]];
  path.push(...cubic([.085,.035],[.36,.005],
    [xBack[0]+.06,xBack[1]+.22],xBack).slice(1));
  path.push(x.polygon[2],x.toe,x.heel);
  path.push(...cubic(x.heel,[x.heel[0]-.09,x.heel[1]+.09],
    [.34,-.09],[.04,-.07]).slice(1));
  path.push([0,-.09],[-.04,-.07]);
  path.push(...cubic([-.04,-.07],[-.34,-.09],
    [eBack[0]+.09,eBack[1]+.08],eBack).slice(1));
  path.push(e.polygon[2],e.toe,e.heel);
  path.push(...cubic(e.heel,[e.heel[0]-.04,e.heel[1]+.23],
    [-.36,.005],[-.085,.035]).slice(1));
  return path.slice(0,-1); // Three.js closes the edge; no zero-length duplicate.
}
export function anchorOutline(angle:number):Point[]{
  return anchorLocalOutline().map(p=>anchorWorld(p,angle));
}
/** Non-working central body. Union with the two convex shoes is exactly the
 * manufactured outline; this lets the audit bound all ribs over a swing arc.
 */
export function anchorRibOutline(angle:number):Point[]{
  const toeVertices=[FACES.entry.toe,FACES.entry.polygon[2],FACES.exit.toe,FACES.exit.polygon[2]];
  return anchorLocalOutline().filter(p=>!toeVertices.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-10))
    .map(p=>anchorWorld(p,angle));
}
