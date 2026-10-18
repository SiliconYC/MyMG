import assert from 'node:assert/strict';
import {test} from 'node:test';
import {clockAtFrame,FPS,DURATION,TEETH} from '../animations/pendulum-clock/web/src/clock-model.ts';
import {SECOND_HAND} from '../animations/pendulum-clock/web/src/second-hand-geometry.ts';
import {RecoilSimulation,PHYSICS,convexContact} from '../animations/pendulum-clock/web/src/recoil-physics.ts';
import {FACES,PITCH,OUTER_RADIUS,anchorLocalOutline,anchorOutline,wheelOutline,toothLocal,
  palletOutline,PIVOT_Y} from '../animations/pendulum-clock/web/src/recoil-geometry.ts';
import {contactDistance,anchorWheelInterference,polygonInterference} from '../animations/pendulum-clock/web/src/escapement-contact.ts';
import {cameraAtFrame,SHOTS} from '../animations/pendulum-clock/web/src/camera-path.ts';
import {WHEEL_PLANE_Z,PALLET_PLANE_Z,FORK_ARM_PLANE_Z,wheelZRange,palletZRange,
  bearingZRange,spindleZRange,zOverlap,BEARING_INNER_RADIUS,WHEEL_SPINDLE_RADIUS} from '../animations/pendulum-clock/web/src/escapement-axial.ts';

const sim=new RecoilSimulation();
let maxPenetration=0,minWheelSpeed=0,maxAngle=0,contactCount=0,minImpulse=Infinity;
const states=[];
for(let i=0;i<60/PHYSICS.step;i++){
  const s=sim.advance();
  maxPenetration=Math.max(maxPenetration,s.penetration);
  minWheelSpeed=Math.min(minWheelSpeed,s.wheelVelocity);
  maxAngle=Math.max(maxAngle,Math.abs(s.angle));
  if(s.impulse>0)minImpulse=Math.min(minImpulse,s.impulse);
  if(i%64===63){states.push(s);if(s.contact)contactCount++;}
}

test('a reported pallet lock is a real touching contact, not a floating label',()=>{
  for(const frame of [0,6,12,24,30,42,1199,1799]){
    const s=clockAtFrame(frame);
    if(s.contact)assert.ok(contactDistance(s.contact,s)<2e-4*OUTER_RADIUS,`contact at ${frame}`);
  }
  assert.ok(contactCount>1500,'contact must persist across the swing, not just flicker');
});

test('60 seconds sustain real alternating tooth contacts and near-second beats',()=>{
  const events=sim.events;
  assert.ok(events.length>=58&&events.length<=63,`${events.length} actual beats`);
  for(let i=1;i<events.length;i++){
    assert.notEqual(events[i].side,events[i-1].side);
    assert.ok(events[i].impulse>0);
    assert.ok(events[i].time-events[i-1].time>.8&&events[i].time-events[i-1].time<1.1);
  }
  for(let i=2;i<events.length;i++){
    assert.equal(events[i].tooth,(events[i-2].tooth+29)%30,'one physical tooth per full swing');
    assert.ok(Math.abs(events[i].wheelAngle-events[i-2].wheelAngle-PITCH)<.003);
  }
  const mean=(events.at(-1).time-events[10].time)/(events.length-11);
  assert.ok(Math.abs(mean-1)<.05,`mean beat ${mean}s`);
});

test('wheel recoil is a resolved velocity and the shafts transmit energy',()=>{
  assert.ok(minWheelSpeed<-.1,'recoil must be clearly negative');
  assert.ok(maxAngle>.06&&maxAngle<.10,'bounded small pendulum swing');
  assert.ok(sim.state.driveWork>.06);
  assert.ok(sim.state.energy>.02&&sim.state.dissipation>0&&sim.state.impactLoss>0);
  assert.ok(Math.abs(sim.state.residual)<.04*sim.state.driveWork,'energy accounting converges');
  assert.ok(minImpulse>=0,'unilateral contacts never attract');
});

test('every physical substep has bounded tooth/pallet penetration',()=>{
  assert.ok(maxPenetration<2e-4*OUTER_RADIUS,`maximum penetration ${maxPenetration}`);
});

test('the complete anchor and wheel solids clear across the 900-frame film',()=>{
  let count=0;
  for(let f=0;f<DURATION;f++){
    const s=clockAtFrame(f);
    if(anchorWheelInterference(s))count++;
  }
  assert.equal(count,0,`${count} frames have whole-solid interference`);
});

test('fractional and random seeking are independent of playback history',()=>{
  const frames=[0,12.125,42.75,1799,1100.33,64,876.01];
  const a=frames.map(clockAtFrame);
  frames.slice().reverse().map(clockAtFrame);
  assert.deepEqual(frames.map(clockAtFrame),a);
  assert.deepEqual(clockAtFrame(-10),clockAtFrame(0));
  assert.deepEqual(clockAtFrame(NaN),clockAtFrame(0));
  assert.deepEqual(clockAtFrame(999999),clockAtFrame(DURATION));
  for(const s of a){assert.equal(s.anchorAngle,s.pendulumAngle);assert.equal(anchorWheelInterference(s),false);}
});

test('seconds hand has a fixed shaft offset and exactly shares wheel displacement',()=>{
  const zero=clockAtFrame(0);
  for(const f of [1,24,31,300,700,1799]){
    const s=clockAtFrame(f);
    assert.equal(s.secondHandAngle,s.wheelAngle-zero.wheelAngle);
    assert.equal(s.minuteHandAngle,s.secondHandAngle/60);
  }
  assert.equal(TEETH,30);assert.equal(FPS,30);
});


test('seconds hand points outward and its shortened shaft cannot pierce the conical tip',()=>{
  // Native Three.js ConeGeometry points along +Y. Its base is at
  // center-height/2, while the tip is at center+height/2.
  const baseY=SECOND_HAND.tipCenterY-SECOND_HAND.tipHeight/2;
  const tipY=SECOND_HAND.tipCenterY+SECOND_HAND.tipHeight/2;
  assert.ok(SECOND_HAND.tailY<0,'short counterweight stays behind the central pivot');
  assert.ok(baseY>0&&tipY>baseY,'the cone points toward the outer dial');
  assert.ok(SECOND_HAND.shaftEndY>baseY,
    'the rod should seat inside the wide base without a visible gap');
  assert.ok(SECOND_HAND.shaftEndY<baseY+.04,
    'the rod should stop at the cone base, not extend toward the tip');
  const coneRadiusAtShaftEnd=SECOND_HAND.tipRadius*
    (tipY-SECOND_HAND.shaftEndY)/SECOND_HAND.tipHeight;
  assert.ok(coneRadiusAtShaftEnd>SECOND_HAND.shaftRadius,
    'the shaft end must be fully hidden inside the tip base');
  assert.ok(tipY<SECOND_HAND.dialMarkOuterRadius-.02,
    'the point must clear the perimeter of the dial markings');
});

test('the public clock film is a focused 30-second cut of the physical simulation',()=>{
  assert.equal(DURATION,30*FPS);
  assert.equal(SHOTS[0].start,0);
  assert.equal(SHOTS.at(-1).end,30);
  assert.ok(SHOTS.filter(shot=>shot.mode==='observe').length>=4);
  assert.ok(clockAtFrame(DURATION-1).seconds<30,
    'the one-minute clock is not accelerated to fit the shortened film');
});

test('removing the drive removes replenishment instead of preserving a programmed oscillation',()=>{
  const off=new RecoilSimulation({drive:0});
  const initial=off.state.energy;
  for(let i=0;i<60/PHYSICS.step;i++)off.advance();
  assert.equal(off.state.driveWork,0);
  assert.ok(off.state.energy<initial*.55,`drive-off energy ${off.state.energy}`);
  assert.ok(off.state.energy<sim.state.energy*.5);
});

test('halving the timestep preserves contacts and converges in energy and trajectory',()=>{
  const refined=new RecoilSimulation({step:PHYSICS.step/2});
  for(let i=0;i<60/refined.step;i++)refined.advance();
  assert.equal(refined.events.length,sim.events.length);
  assert.deepEqual(refined.events.map(e=>[e.side,e.tooth]),sim.events.map(e=>[e.side,e.tooth]));
  assert.ok(Math.abs(refined.state.angle-sim.state.angle)<.003);
  assert.ok(Math.abs(refined.state.wheel-sim.state.wheel)<.005);
  assert.ok(Math.abs(refined.state.residual)<Math.abs(sim.state.residual)*.6);
});

test('convex contacts distinguish separation, touch and overlap with a correct lever point',()=>{
  const a=[[0,0],[1,0],[1,1],[0,1]];
  assert.equal(convexContact(a,[[2,0],[3,0],[3,1],[2,1]]).gap,1);
  assert.equal(convexContact(a,[[1,0],[2,0],[2,1],[1,1]]).gap,0);
  assert.ok(Math.abs(convexContact(a,[[.9,0],[2,0],[2,1],[.9,1]]).gap+.1)<1e-12);
  assert.equal(polygonInterference(a,[[.4,-1],[.6,-1],[.6,2],[.4,2]]),true);
});

test('shared machining profiles are simple and every tooth collider is convex',()=>{
  const sign=p=>p.map((a,i)=>{const b=p[(i+1)%p.length],c=p[(i+2)%p.length];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);});
  for(let i=0;i<30;i++)assert.ok(sign(toothLocal(i)).every(v=>v<=1e-12));
  const shape=anchorLocalOutline();
  assert.ok(shape.every(p=>p.every(Number.isFinite)));
  for(const side of ['entry','exit'])for(const p of FACES[side].polygon)
    assert.ok(shape.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-10),'all actual working vertices belong to the rendered anchor');
});

test('axial working overlap and real bored bearing remain mechanically assembled',()=>{
  assert.equal(WHEEL_PLANE_Z,PALLET_PLANE_Z);assert.equal(FORK_ARM_PLANE_Z,WHEEL_PLANE_Z);
  assert.ok(zOverlap(wheelZRange,palletZRange)>.1);
  assert.ok(zOverlap(bearingZRange,spindleZRange)>=.22-1e-10);
  assert.ok(BEARING_INNER_RADIUS-WHEEL_SPINDLE_RADIUS>.005);
});

test('camera keeps the contact view readable and cuts dead time with brisk transitions',()=>{
  assert.deepEqual(cameraAtFrame(11*30).position,cameraAtFrame(16*30).position);
  assert.equal(cameraAtFrame(11*30).chapter,'contact');
  for(let f=1;f<DURATION;f++){
    const a=cameraAtFrame(f-1),b=cameraAtFrame(f);
    assert.ok(Math.hypot(...a.position.map((v,i)=>v-b.position[i]))<1.2);
    assert.ok(Number.isFinite(b.fov));
  }
  for(let i=1;i<SHOTS.length;i++)assert.equal(SHOTS[i-1].end,SHOTS[i].start);
});

test('all nonworking ribs clear the entire tooth envelope throughout the continuous swing',async()=>{
  const {anchorRibOutline,WHEEL_Y}=await import('../animations/pendulum-clock/web/src/recoil-geometry.ts');
  let minimum=Infinity;
  const angularStep=.18/512;
  for(let k=0;k<=512;k++){
    const vertices=anchorRibOutline(-.09+k*angularStep);
    for(let i=0;i<vertices.length;i++){
      const a=vertices[i],b=vertices[(i+1)%vertices.length],dx=b[0]-a[0],dy=b[1]-a[1];
      const t=Math.max(0,Math.min(1,(-a[0]*dx+(WHEEL_Y-a[1])*dy)/(dx*dx+dy*dy)));
      minimum=Math.min(minimum,Math.hypot(a[0]+t*dx,a[1]+t*dy-WHEEL_Y)-OUTER_RADIUS);
    }
  }
  // Every point lies within 1.2 of P. The Lipschitz bound covers the entire
  // interval BETWEEN samples, not just the displayed animation frames.
  assert.ok(minimum-1.2*angularStep/2>.02);
  assert.ok(maxAngle<.09,'every substep remains inside the certified swing envelope');
});

test('the rendered bevels remain inside the audited XY solids',async()=>{
  const {makeEscapeWheel,makeAnchorGeometry}=await import('../animations/pendulum-clock/web/src/escapement-mesh.ts');
  const {WHEEL_Y}=await import('../animations/pendulum-clock/web/src/recoil-geometry.ts');
  const allowed=(p,poly)=>{
    let inside=false,min=Infinity;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[j],b=poly[i],dx=b[0]-a[0],dy=b[1]-a[1],ll=dx*dx+dy*dy;
      const t=ll?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/ll)):0;
      min=Math.min(min,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));
      if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside||min<2e-7;
  };
  for(const [mesh,poly] of [[makeEscapeWheel(),wheelOutline(0).map(([x,y])=>[x,y-WHEEL_Y])],[makeAnchorGeometry(),anchorLocalOutline()]]){
    const vertices=mesh.getAttribute('position');
    for(let i=0;i<vertices.count;i++)assert.ok(allowed([vertices.getX(i),vertices.getY(i)],poly),'actual chamfer extends beyond physical solid');
    mesh.dispose();
  }
});

test('the visible anchor is two separate swept arms around a compact pivot hub',async()=>{
  const {makeAnchorVisualGeometries}=await import('../animations/pendulum-clock/web/src/escapement-mesh.ts');
  const parts=makeAnchorVisualGeometries();
  assert.equal(parts.length,5,'one pivot hub, two swept arms and two fixed shoes');
  const contains=(geometry,point)=>{
    const p=geometry.getAttribute('position'),idx=geometry.index;
    for(let n=0;n<(idx?idx.count:p.count);n+=3){
      const ids=idx?[idx.getX(n),idx.getX(n+1),idx.getX(n+2)]:[n,n+1,n+2];
      const a=[p.getX(ids[0]),p.getY(ids[0])],b=[p.getX(ids[1]),p.getY(ids[1])],c=[p.getX(ids[2]),p.getY(ids[2])];
      const cross=(u,v)=>u[0]*v[1]-u[1]*v[0];
      const v0=[b[0]-a[0],b[1]-a[1]],v1=[c[0]-a[0],c[1]-a[1]],v2=[point[0]-a[0],point[1]-a[1]];
      const den=cross(v0,v1);
      if(Math.abs(den)<1e-12)continue;
      const u=cross(v2,v1)/den,v=cross(v0,v2)/den;
      if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)return true;
    }
    return false;
  };
  assert.ok(contains(parts[0],[0,.04]),'the pivot remains visually connected');
  parts[1].computeBoundingBox();parts[2].computeBoundingBox();
  assert.ok(parts[1].boundingBox.max.x>.62,'right arm sweeps into its pallet');
  assert.ok(parts[2].boundingBox.min.x<-.8&&parts[2].boundingBox.min.y<-.55,
    'the extended left arm reaches its pallet');
  for(const arm of parts.slice(1,3)){
    arm.computeBoundingBox();
    assert.ok(arm.boundingBox.max.y>.035&&arm.boundingBox.max.y<.055,
      'each shared parabolic arm has its apex at the top pivot');
  }
  for(const [part,face] of [[parts[3],FACES.entry],[parts[4],FACES.exit]])
    for(const point of face.polygon){
      const p=part.getAttribute('position');
      assert.ok(Array.from({length:p.count},(_,i)=>Math.hypot(p.getX(i)-point[0],p.getY(i)-point[1]))
        .some(distance=>distance<5e-8),'the unchanged pallet stays attached at its exact vertices');
    }
  assert.ok(!parts.some(part=>contains(part,[0,-.2])),'the fork keeps a visible central opening');
  const leftPositions=parts[2].getAttribute('position');
  assert.ok(Array.from({length:leftPositions.count},(_,i)=>
    contains(parts[3],[leftPositions.getX(i),leftPositions.getY(i)])).some(Boolean),
    'the left arm physically overlaps the unchanged entry shoe');
  const polygon=anchorLocalOutline();
  const tubeEnvelopeTolerance=.0105;
  const inside=(point)=>{
    let result=false,min=Infinity;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const a=polygon[i],b=polygon[j];
      const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
      const t=length?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)):0;
      min=Math.min(min,Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy));
      if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])result=!result;
    }
    return result||min<tubeEnvelopeTolerance;
  };
  for(const part of parts){
    const p=part.getAttribute('position');
    for(let i=0;i<p.count;i++)assert.ok(inside([p.getX(i),p.getY(i)]),
      'visual metal follows audited anchor profile within its round-arm envelope');
    part.dispose();
  }
});

test('the machined one-piece anchor has no self-crossing perimeter',()=>{
  const p=anchorLocalOutline();
  const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
  for(let i=0;i<p.length;i++)for(let j=i+2;j<p.length;j++){
    if(i===0&&j===p.length-1)continue;
    const a=p[i],ab=sub(p[(i+1)%p.length],a),c=p[j],cd=sub(p[(j+1)%p.length],c),den=cross(ab,cd);
    if(Math.abs(den)<1e-14)continue;
    const t=cross(sub(c,a),cd)/den,u=cross(sub(c,a),ab)/den;
    assert.ok(!(t>1e-8&&t<1-1e-8&&u>1e-8&&u<1-1e-8),`crossing edges ${i}, ${j}`);
  }
});
