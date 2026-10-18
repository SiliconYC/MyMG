/** Two fixed-axis rigid bodies, unilateral convex contact, no animated motors.
 * Scene-unit angles are physical angles; the pendulum inertia is normalized
 * to 1 kg m². g/l sets its gravitational torque per unit inertia.
 */
import {PITCH,PIVOT_Y,WHEEL_Y,TEETH,
  FACES,toothLocal,dot,sub,type Point,type Side} from './recoil-geometry.ts';

export type PhysicsOptions={step?:number;drive?:number;damping?:number;wheelInertia?:number};
export const PHYSICS={step:1/1920,drive:.011,damping:.028,wheelInertia:.0008,
  gravity:9.7,initialAngle:-.065,initialWheel:-Math.PI/4-PITCH,
  contactSkin:.0004} as const;
export const PENDULUM_LENGTH_METRES=9.80665/PHYSICS.gravity;
export const METRES_PER_SCENE_UNIT=PENDULUM_LENGTH_METRES/5.55;
export type Contact={side:Side;tooth:number;gap:number;normal:Point;point:Point};
export type BeatEvent={time:number;side:Side;tooth:number;wheelAngle:number;impulse:number};
export type PhysicsState={time:number;angle:number;velocity:number;wheel:number;wheelVelocity:number;
  contact:Side|null;tooth:number;gap:number;impulse:number;beats:number;
  driveWork:number;dissipation:number;impactLoss:number;energy:number;residual:number;penetration:number};

function area(p:readonly Point[]):number{
  return p.reduce((s,a,i)=>s+a[0]*p[(i+1)%p.length][1]-a[1]*p[(i+1)%p.length][0],0);
}
type ConvexProfile={vertices:readonly Point[];normals:readonly Point[]};
function prepare(vertices:readonly Point[]):ConvexProfile{
  const sign=area(vertices)>0?1:-1;
  return {vertices,normals:vertices.map((a,i)=>{
    const b=vertices[(i+1)%vertices.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    return [sign*dy/length,-sign*dx/length] as Point;
  })};
}
function transform(profile:ConvexProfile,c:number,s:number,y:number):ConvexProfile{
  return {vertices:profile.vertices.map(p=>[p[0]*c+p[1]*s,-p[0]*s+p[1]*c+y] as Point),
    normals:profile.normals.map(p=>[p[0]*c+p[1]*s,-p[0]*s+p[1]*c] as Point)};
}
const TOOTH_PROFILES=Array.from({length:TEETH},(_,i)=>prepare(toothLocal(i)));
const PALLET_PROFILES={entry:prepare(FACES.entry.polygon),exit:prepare(FACES.exit.polygon)};
/** Largest signed separating distance. A separated pair can be discarded as
 * soon as ANY axis exceeds the speculative margin; touching pairs retain the
 * full SAT manifold and correct vertex/edge lever point.
 */
function preparedContact(anchor:ConvexProfile,wheel:ConvexProfile,margin:number):
  {gap:number;normal:Point;point:Point}|null{
  let best=-Infinity,normal:Point=[0,1],wheelVertex=true;
  for(const [profile,other,flip] of [[anchor,wheel.vertices,1],[wheel,anchor.vertices,-1]] as const){
    for(let i=0;i<profile.vertices.length;i++){
      const a=profile.vertices[i],n=profile.normals[i];
      let separation=Infinity;
      for(const p of other)separation=Math.min(separation,(p[0]-a[0])*n[0]+(p[1]-a[1])*n[1]);
      if(separation>margin)return null;
      if(separation>best){best=separation;normal=[flip*n[0],flip*n[1]];wheelVertex=flip===1;}
    }
  }
  let min=Infinity,x=0,y=0,count=0;
  for(const p of wheelVertex?wheel.vertices:anchor.vertices){
    const v=dot(p,normal)*(wheelVertex?1:-1);
    if(v<min-1e-9){min=v;x=p[0];y=p[1];count=1;}
    else if(Math.abs(v-min)<1e-9){x+=p[0];y+=p[1];count++;}
  }
  return {gap:best,normal,point:[x/count,y/count]};
}
export function convexContact(anchor:readonly Point[],wheel:readonly Point[]):
  {gap:number;normal:Point;point:Point}{
  return preparedContact(prepare(anchor),prepare(wheel),Infinity)!;
}
export function contactsAt(angle:number,wheel:number,skin:number=PHYSICS.contactSkin):Contact[]{
  const result:Contact[]=[],ca=Math.cos(angle),sa=Math.sin(angle),cw=Math.cos(wheel),sw=Math.sin(wheel);
  for(const side of ['entry','exit'] as const){
    const pallet=transform(PALLET_PROFILES[side],ca,sa,PIVOT_Y);
    const centre=pallet.vertices.reduce((v,p)=>[v[0]+p[0]/4,v[1]+p[1]/4] as Point,[0,0] as Point);
    const index=Math.floor((Math.atan2(centre[0],centre[1]-WHEEL_Y)-wheel)/PITCH)-1;
    for(let j=index-1;j<=index+2;j++){
      const tooth=((j%TEETH)+TEETH)%TEETH;
      const c=preparedContact(pallet,transform(TOOTH_PROFILES[tooth],cw,sw,WHEEL_Y),skin);
      if(c&&c.gap<skin)result.push({...c,side,tooth});
    }
  }
  return result;
}
const cwMoment=(r:Point,n:Point)=>r[1]*n[0]-r[0]*n[1];
const kinetic=(a:number,w:number,inertia:number)=>(a*a+inertia*w*w)/2;

export class RecoilSimulation{
  readonly step:number;readonly drive:number;readonly damping:number;readonly inertia:number;
  readonly events:BeatEvent[]=[];
  state:PhysicsState;
  private count=0;private lastSide:Side='entry';private initialEnergy:number;
  constructor(options:PhysicsOptions={}){
    this.step=options.step??PHYSICS.step;this.drive=options.drive??PHYSICS.drive;
    this.damping=options.damping??PHYSICS.damping;this.inertia=options.wheelInertia??PHYSICS.wheelInertia;
    if(!(this.step>0&&Number.isFinite(this.step)&&this.inertia>0))throw new Error('Invalid mechanical timestep/inertia');
    // Put an entry tooth on the actual finite face at the initial angle.
    let wheel=PHYSICS.initialWheel;
    for(let i=0;i<12;i++){
      const cs=contactsAt(PHYSICS.initialAngle,wheel,1).filter(c=>c.side==='entry');
      const c=cs.sort((a,b)=>Math.abs(a.gap)-Math.abs(b.gap))[0];
      const jw=cwMoment(sub(c.point,[0,WHEEL_Y]),c.normal);
      wheel-=c.gap/jw;
    }
    this.initialEnergy=PHYSICS.gravity*(1-Math.cos(PHYSICS.initialAngle));
    const initialContact=contactsAt(PHYSICS.initialAngle,wheel,.00002).find(c=>c.side==='entry');
    if(!initialContact)throw new Error('The initial entry tooth is not seated on its working face');
    this.state={time:0,angle:PHYSICS.initialAngle,velocity:0,wheel,wheelVelocity:0,
      contact:initialContact.side,tooth:initialContact.tooth,gap:initialContact.gap,
      impulse:0,beats:0,driveWork:0,dissipation:0,
      impactLoss:0,energy:this.initialEnergy,residual:0,penetration:0};
  }
  /** A bounded replay from a cached frame; no state from a later seek leaks in. */
  fork():RecoilSimulation{
    return Object.assign(Object.create(RecoilSimulation.prototype) as RecoilSimulation,{
      step:this.step,drive:this.drive,damping:this.damping,inertia:this.inertia,
      events:[],state:{...this.state},count:this.count,lastSide:this.lastSide,
      initialEnergy:this.initialEnergy,
    });
  }
  advance():PhysicsState{
    const s=this.state,h=this.step,previousWheel=s.wheel;
    let a=s.angle,w=s.wheel;
    let va=s.velocity+h*(-PHYSICS.gravity*Math.sin(a)-this.damping*s.velocity);
    let vw=s.wheelVelocity+h*this.drive/this.inertia;
    const before=kinetic(va,vw,this.inertia);
    let impulse=0,side:Side|null=null,tooth=-1,gap=Infinity;
    const jacobian=(c:Contact)=>{
      const jw=METRES_PER_SCENE_UNIT*cwMoment(sub(c.point,[0,WHEEL_Y]),c.normal);
      const ja=-METRES_PER_SCENE_UNIT*cwMoment(sub(c.point,[0,PIVOT_Y]),c.normal);
      return {jw,ja,mass:jw*jw/this.inertia+ja*ja};
    };
    // Speculative impulses stop closure at the finite surface, not before it.
    const speculative=contactsAt(a,w);
    for(let iteration=0;iteration<3;iteration++){
      for(const c of speculative){
        const {jw,ja,mass}=jacobian(c);
        const j=Math.max(0,(-Math.max(0,c.gap)*METRES_PER_SCENE_UNIT/h-jw*vw-ja*va)/mass);
        va+=ja*j;vw+=jw*j/this.inertia;
        if(j>0){impulse+=j;side=c.side;tooth=c.tooth;gap=c.gap;}
      }
    }
    const impactLoss=Math.max(0,before-kinetic(va,vw,this.inertia));
    a+=h*va;w+=h*vw;
    // Split geometric correction: never add a velocity/energy kick.
    let actual=contactsAt(a,w,.00002);
    for(let iteration=0;iteration<8;iteration++){
      let corrected=false;
      for(const c of actual){
        if(c.gap>=-1e-10)continue;
        const {jw,ja,mass}=jacobian(c),j=-c.gap*METRES_PER_SCENE_UNIT/mass;
        a+=ja*j;w+=jw*j/this.inertia;corrected=true;
      }
      if(!corrected)break;
      actual=contactsAt(a,w,.00002);
    }
    actual.sort((x,y)=>x.gap-y.gap);
    const c=actual[0];
    // A reported contact always means geometrical touching, even at a reversal.
    side=c?.side??null;tooth=c?.tooth??-1;gap=c?.gap??Infinity;
    const time=++this.count*h;
    let newBeat=false;
    if(side&&side!==this.lastSide&&impulse>1e-10){
      this.events.push({time,side,tooth,wheelAngle:w,impulse});this.lastSide=side;
      newBeat=true;
    }
    const driveWork=s.driveWork+this.drive*(w-previousWheel);
    const dissipation=s.dissipation+h*this.damping*s.velocity**2;
    const loss=s.impactLoss+impactLoss;
    const energy=kinetic(va,vw,this.inertia)+PHYSICS.gravity*(1-Math.cos(a));
    this.state={time,angle:a,velocity:va,wheel:w,wheelVelocity:vw,contact:side,tooth,gap,
      impulse,beats:s.beats+(newBeat?1:0),driveWork,dissipation,impactLoss:loss,energy,
      residual:energy-this.initialEnergy-driveWork+dissipation+loss,
      penetration:Math.max(0,...actual.map(c=>-c.gap))};
    return this.state;
  }
}
