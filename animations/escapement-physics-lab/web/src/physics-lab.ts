/**
 * #78 independent Rapier 2D experiment. No wheel-step scheduler, SAT or geometric
 * correction. All motion comes from gravity, constant applied torque and Rapier.
 * Coordinates: +Y up, metres (illustrative). Rendering reads THESE colliders.
 */
import RAPIER from '@dimforge/rapier2d-compat';

export const LAB_VERSION = 'Rapier 2D 0.21.0';
export const STEP = 1 / 240;
export const PARAMETERS = Object.freeze({
  gravity: -9.81,
  driveTorque: 0.8,
  pendulumStart: 0.06,
  wheelStart: -0.14,
  wheelDamping: 0.035,
  anchorDamping: 0.015,
  restitution: 0,
  friction: 0.18,
  wheelRadius: 1.83,
  rootRadius: 2.18,
  tipRadius: 2.47,
  pivotY: 3.45,
  pendulumLength: 4.65,
  bobRadius: 0.27,
  solverIterations: 12,
  teeth: 30,
});
export type Side = 'left' | 'right';
export type Mode = 'single' | 'full';
export type Point = readonly [number, number];
export type Solid = {
  name: string;
  owner: 'wheel' | 'anchor';
  kind: 'poly' | 'circle';
  side?: Side;
  vertices?: Point[];
  center?: Point;
  radius?: number;
};
export type Readout = {
  mode: Mode;
  time: number;
  step: number;
  wheelAngle: number;
  anchorAngle: number;
  wheelOmega: number;
  anchorOmega: number;
  forward: number;
  reverse: number;
  contactCount: Record<Side, number>;
  alternations: number;
  contactNow: Record<Side, boolean>;
  impulse: Record<Side, number>;
  totalImpulse: number;
  maxPenetration: number;
  penetrationDuration: number;
  stuckTime: number;
  longestStuck: number;
  wheelTravel: number;
  physicsMs: number;
  initialOverlap: boolean;
  status: 'UNVERIFIED' | 'FAILED' | 'CANDIDATE';
};
// Initial tooth/pallet geometric gap is 0.04m; a freely swinging fork must reach it.
// Scale shoe positions radially about the gear origin; no mid-run contact snapping.
const shoe = (points: Point[]): Point[] => points.map(([x,y]) =>
  [x * 1.10, (y + PARAMETERS.pivotY) * 1.10 - PARAMETERS.pivotY]);
const leftPad: Point[] = shoe([[-1.80,-1.58],[-1.58,-1.80],[-1.41,-1.72],[-1.61,-1.43]]);
const rightPad: Point[] = shoe([[1.41,-1.72],[1.58,-1.80],[1.80,-1.58],[1.61,-1.43]]);
const tooth = (angle: number): Point[] => {
  const at = (r: number, a: number): Point => [r * Math.cos(a), r * Math.sin(a)];
  return [at(PARAMETERS.rootRadius, angle - 0.075),
    at(PARAMETERS.tipRadius, angle + 0.008),
    at(PARAMETERS.rootRadius, angle + 0.073)];
};
const rotate = ([x, y]: Point, a: number): Point =>
  [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const worldPoint = (p: Point, owner: 'wheel' | 'anchor', a: number): Point => {
  const [x, y] = rotate(p, a);
  return [x, y + (owner === 'anchor' ? PARAMETERS.pivotY : 0)];
};
const polygon = (points: Point[]) =>
  RAPIER.ColliderDesc.convexHull(new Float32Array(points.flatMap(p => [...p])));

let ready: Promise<void> | null = null;
export function initRapier(): Promise<void> {
  if (!ready) ready = RAPIER.init().then(() => undefined).catch(error => {ready = null; throw error;});
  return ready;
}

export class EscapementSimulation {
  readonly world: RAPIER.World;
  readonly wheel: RAPIER.RigidBody;
  readonly anchor: RAPIER.RigidBody;
  readonly solids: Solid[] = [];
  readonly mode: Mode;
  private queue: RAPIER.EventQueue;
  private sides = new Map<number, Side>();
  private palletColliders: RAPIER.Collider[] = [];
  private toothColliders: RAPIER.Collider[] = [];
  private contact = {left: false, right: false};
  private counts = {left: 0, right: 0};
  private impulses = {left: 0, right: 0};
  private alternations = 0;
  private lastSide: Side | null = null;
  private totalImpulse = 0;
  private maxPenetration = 0;
  private penetrationDuration = 0;
  private forward = 0;
  private reverse = 0;
  private stagnant = 0;
  private longestStuck = 0;
  private physicsMs = 0;
  private n = 0;
  readonly initialOverlap: boolean;

  constructor(mode: Mode = 'full') {
    this.mode = mode;
    this.world = new RAPIER.World({x: 0, y: PARAMETERS.gravity});
    this.world.timestep = STEP;
    this.world.numSolverIterations = PARAMETERS.solverIterations;
    // Independent fixed bearings, two dynamic rigid bodies, two real revolute joints.
    const groundWheel = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const groundAnchor = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, PARAMETERS.pivotY));
    this.wheel = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setRotation(mode === 'single' ? 2.13 : PARAMETERS.wheelStart)
        .setLinearDamping(0.02).setAngularDamping(PARAMETERS.wheelDamping)
        .setCcdEnabled(true));
    this.anchor = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(0, PARAMETERS.pivotY)
        .setRotation(PARAMETERS.pendulumStart)
        .setAngularDamping(PARAMETERS.anchorDamping).setCcdEnabled(true));
    const joint = RAPIER.JointData.revolute({x: 0, y: 0}, {x: 0, y: 0});
    this.world.createImpulseJoint(joint, groundWheel, this.wheel, true);
    this.world.createImpulseJoint(
      RAPIER.JointData.revolute({x: 0, y: 0}, {x: 0, y: 0}),
      groundAnchor, this.anchor, true);
    this.addCircle('hub', 'wheel', [0, 0], PARAMETERS.wheelRadius, 0.12);
    const teeth = mode === 'single' ? 1 : PARAMETERS.teeth;
    for (let i = 0; i < teeth; ++i) {
      const points = tooth(i * 2 * Math.PI / PARAMETERS.teeth);
      this.addPoly('tooth-' + i, 'wheel', points, 0.13);
    }
    this.addPoly('pallet-left', 'anchor', leftPad, 0.8, 'left');
    if (mode === 'full') this.addPoly('pallet-right', 'anchor', rightPad, 0.8, 'right');
    // Bob and rod share the SAME rigid body as both pallets.
    this.addCircle('bob', 'anchor', [0, -PARAMETERS.pendulumLength],
      PARAMETERS.bobRadius, 1.5);
    // Rapier addTorque is persistent until resetTorques; call only once.
    this.wheel.addTorque(PARAMETERS.driveTorque, true);
    this.queue = new RAPIER.EventQueue(true);
    // Narrow-phase geometry preflight, BEFORE any integration or solver correction.
    this.initialOverlap = this.toothColliders.some(t =>
      this.palletColliders.some(p => (t.contactCollider(p, 0)?.distance ?? 0) < -1e-6));
  }

  private addPoly(name: string, owner: 'wheel' | 'anchor',
      vertices: Point[], density: number, side?: Side) {
    const desc = polygon(vertices);
    if (!desc) throw new Error('Rapier rejected convex hull: ' + name);
    const collider = this.world.createCollider(desc.setDensity(density)
      .setFriction(PARAMETERS.friction).setRestitution(PARAMETERS.restitution)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS |
        RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS), owner === 'wheel' ? this.wheel : this.anchor);
    if (side) {this.sides.set(collider.handle, side); this.palletColliders.push(collider);}
    if (name.startsWith('tooth')) this.toothColliders.push(collider);
    this.solids.push({name, owner, kind: 'poly', vertices, side});
  }
  private addCircle(name: string, owner: 'wheel' | 'anchor',
      center: Point, radius: number, density: number) {
    this.world.createCollider(RAPIER.ColliderDesc.ball(radius)
      .setTranslation(center[0], center[1]).setDensity(density)
      .setFriction(PARAMETERS.friction), owner === 'wheel' ? this.wheel : this.anchor);
    this.solids.push({name, owner, kind: 'circle', center, radius});
  }
  step() {
    const was = this.wheel.rotation();
    const t0 = performance.now();
    this.world.step(this.queue);
    this.physicsMs += performance.now() - t0;
    this.n += 1;
    // Rapier may normalize 2D rotations near +/-PI: unwrap per-step angular travel.
    let da = this.wheel.rotation() - was;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    if (da > 0) this.forward += da;
    else this.reverse -= da;
    // Count only actual Rapier collision transitions between a wheel and a pallet.
    this.queue.drainCollisionEvents((a, b, started) => {
      const side = this.sides.get(a) ?? this.sides.get(b);
      if (!side) return;
      // Ignore same-body contacts: wheel and anchor are different dynamic bodies.
      if (started && !this.contact[side]) {
        this.counts[side]++;
        if (this.lastSide && this.lastSide !== side) this.alternations++;
        this.lastSide = side;
      }
      this.contact[side] = started;
    });
    this.queue.drainContactForceEvents(e => {
      const side = this.sides.get(e.collider1()) ?? this.sides.get(e.collider2());
      if (!side) return;
      const impulse = e.totalForceMagnitude() * STEP;
      this.impulses[side] += impulse;
      this.totalImpulse += impulse;
    });
    // Signed contact distances are read from Rapier manifold, never a self-made solver.
    let penetrating = false;
    const seen = {left: false, right: false};
    for (const [handle, side] of this.sides) {
      const c = this.world.getCollider(handle);
      if (!c) continue;
      this.world.contactPairsWith(c, other => {
        if (other.parent()?.handle !== this.wheel.handle) return;
        this.world.contactPair(c, other, manifold => {
          for (let i = 0; i < manifold.numContacts(); i++) {
            const depth = Math.max(0, -manifold.contactDist(i));
            this.maxPenetration = Math.max(this.maxPenetration, depth);
            if (depth > 0.001) penetrating = true;
            seen[side] = true;
          }
        });
      });
    }
    this.contact = seen;
    if (penetrating) this.penetrationDuration += STEP;
    if (Math.abs(this.wheel.angvel()) < 0.025 && (seen.left || seen.right))
      this.stagnant += STEP;
    else this.stagnant = 0;
    this.longestStuck = Math.max(this.longestStuck, this.stagnant);
  }
  advanceToStep(target: number) {
    if (target < this.n) throw new Error('Cannot seek backwards inside rigid world: reset first');
    while (this.n < target) this.step();
    return this.read();
  }
  read(): Readout {
    const wheelAngle = this.wheel.rotation();
    const status: Readout['status'] = this.initialOverlap || this.maxPenetration > .03
      || this.longestStuck > 3 || this.reverse > 1 ? 'FAILED'
      : this.n >= 10 / STEP && this.alternations >= 10 &&
        this.totalImpulse > .0001 ? 'CANDIDATE' : 'UNVERIFIED';
    return {
      mode: this.mode, time: this.n * STEP, step: this.n,
      wheelAngle, anchorAngle: this.anchor.rotation(),
      wheelOmega: this.wheel.angvel(), anchorOmega: this.anchor.angvel(),
      forward: this.forward, reverse: this.reverse,
      contactCount: {...this.counts}, alternations: this.alternations,
      contactNow: {...this.contact}, impulse: {...this.impulses},
      totalImpulse: this.totalImpulse, maxPenetration: this.maxPenetration,
      penetrationDuration: this.penetrationDuration,
      stuckTime: this.stagnant, longestStuck: this.longestStuck,
      wheelTravel: this.forward - this.reverse,
      physicsMs: this.physicsMs, initialOverlap: this.initialOverlap, status,
    };
  }
  free() {this.queue.free(); this.world.free();}
}
export function worldVertices(s: Solid, angle: number): Point[] {
  if (!s.vertices) return [];
  return s.vertices.map(p => worldPoint(p, s.owner, angle));
}
export type Audit = Readout & {seconds: number; accepted: boolean; engine: string; parameters: typeof PARAMETERS};
export function runAudit(seconds: 10 | 60, mode: Mode = 'full'): Audit {
  const sim = new EscapementSimulation(mode);
  try {
    sim.advanceToStep(Math.round(seconds / STEP));
    const result = sim.read();
    return {...result, seconds, accepted: mode === 'full' &&
      !result.initialOverlap && result.alternations >= 10 &&
      result.totalImpulse > .0001 && result.reverse < .5 &&
      result.maxPenetration < .03 && result.longestStuck < 3,
      engine: LAB_VERSION, parameters: PARAMETERS};
  } finally {sim.free();}
}
