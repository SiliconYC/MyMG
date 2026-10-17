import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const src=readFileSync(resolve(import.meta.dirname,'../animations/escapement-physics-lab/web/src/physics-lab.ts'),'utf8');
const ui=readFileSync(resolve(import.meta.dirname,'../animations/escapement-physics-lab/web/src/escapement-physics-lab.tsx'),'utf8');
const catalog=readFileSync(resolve(import.meta.dirname,'../apps/portal/src/catalog.ts'),'utf8');
test('issue 78 is a separate Rapier WASM experiment, not a new hand-made solver',()=>{
  assert.match(src,/from '@dimforge\/rapier2d-compat'/);
  assert.match(src,/RAPIER\.JointData\.revolute/g);
  assert.match(src,/\.addTorque\(PARAMETERS\.driveTorque/);
  assert.match(src,/world\.step\(this\.queue\)/);
  assert.match(src,/contactForceEvents|drainContactForceEvents/);
  assert.match(src,/contactCollider\(p, 0\)/);
  assert.match(src,/numContacts\(\)/);
  assert.doesNotMatch(src,/convexOverlap|setNextKinematicRotation|setAngvel\(/);
  assert.match(src,/const teeth = mode === 'single' \? 1 : PARAMETERS\.teeth/);
  assert.match(src,/parameters: PARAMETERS/);
  assert.match(ui,/advanceToStep\(target\)/);
  assert.match(ui,/useCurrentFrame/);
  assert.match(catalog,/id: 'escapement-physics-lab'/);
  assert.match(catalog,/component: EscapementLabScene/);
});
test('Lab never makes success claims before measured contacts',()=>{
  assert.match(ui,/实验未通过物理验证/);
  assert.match(src,/this\.alternations >= 10/);
  assert.match(src,/initialOverlap/);
  assert.match(src,/penetrationDuration/);
});
