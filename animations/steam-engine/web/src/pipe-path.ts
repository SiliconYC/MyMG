/** Deterministic tangent-continuous steam pipe sections.
 * Each waypoint corner is replaced by a quadratic elbow tangent to its two
 * neighbouring straight runs. Every joint shares EXACTLY the same endpoint:
 * no cylinder/tube gap, overshoot, or fake disconnected elbow.
 */
export type PipePoint = [number,number,number];
export type PipeSection = {
  kind:'straight'|'elbow';
  start:PipePoint;
  end:PipePoint;
  control?:PipePoint;
};

const add=(a:PipePoint,b:PipePoint):PipePoint=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const minus=(a:PipePoint,b:PipePoint):PipePoint=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const scale=(a:PipePoint,k:number):PipePoint=>[a[0]*k,a[1]*k,a[2]*k];
const norm=(a:PipePoint):number=>Math.hypot(a[0],a[1],a[2]);

export function pipeSections(points:readonly PipePoint[],radius=.22):PipeSection[]{
  if(points.length<2)throw new Error('Pipe needs at least two waypoints');
  const sections:PipeSection[]=[];
  let current:PipePoint=[...points[0]];
  for(let i=1;i<points.length-1;i++){
    const corner=points[i];
    const incoming=minus(corner,points[i-1]);
    const outgoing=minus(points[i+1],corner);
    const a=norm(incoming),b=norm(outgoing);
    if(a<1e-8||b<1e-8)throw new Error('Degenerate pipe waypoint');
    const u=scale(incoming,1/a),v=scale(outgoing,1/b);
    // Straight/collinear intermediate points are geometrically redundant.
    if(u[0]*v[0]+u[1]*v[1]+u[2]*v[2]>.999){
      continue;
    }
    const d=Math.min(radius,a*.35,b*.35);
    const entry=minus(corner,scale(u,d)),exit=add(corner,scale(v,d));
    if(norm(minus(entry,current))>1e-8)
      sections.push({kind:'straight',start:current,end:entry});
    sections.push({kind:'elbow',start:entry,control:[...corner],end:exit});
    current=exit;
  }
  const last:PipePoint=[...points[points.length-1]];
  if(norm(minus(last,current))>1e-8)
    sections.push({kind:'straight',start:current,end:last});
  if(sections.length===0)throw new Error('Pipe has no length');
  return sections;
}
