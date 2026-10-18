import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {test} from 'node:test';
const root=resolve(import.meta.dirname,'..');
const read=(p)=>readFileSync(join(root,p),'utf8');

test('Pages portal is a single registered project entry point',()=>{
  const manifest=JSON.parse(read('apps/portal/package.json'));
  const catalog=read('apps/portal/src/catalog.ts');
  const portal=read('apps/portal/src/portal.tsx');
  assert.equal(manifest.private,true);
  assert.match(catalog,/id:\s*'hbm'/);
  assert.match(catalog,/component:\s*HbmMustard03Native/);
  assert.match(portal,/projects\.map/);
  assert.match(portal,/#\/\$\{encodeURIComponent\(project\.id\)\}/);
  assert.match(portal,/component=\{project\.component\}/);
  assert.match(portal,/player\.seekTo/);
});

test('Pages deploys from dev only and does not run on every commit',()=>{
  const workflow=read('.github/workflows/pages.yml');
  assert.match(workflow,/branches:\s*\[dev\]/);
  assert.match(workflow,/paths:/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/dev'/);
  assert.ok(!/^\s+branches:\s*\[main\]/m.test(workflow));
  assert.ok(existsSync(join(root,'apps/portal/vite.config.ts')));
  assert.match(read('apps/portal/vite.config.ts'),/MyMG/);
});

// Guard against restoring the retired Rapier lab in shipped routes or dependencies.
test('retired escapement physics lab stays absent',()=>{
  const catalog=read('apps/portal/src/catalog.ts');
  const player=read('apps/portal/src/portal.tsx');
  const manifest=JSON.parse(read('apps/portal/package.json'));
  const lock=read('pnpm-lock.yaml');
  assert.doesNotMatch(catalog,/escapement-physics-lab|EscapementLabScene/);
  assert.doesNotMatch(player,/escapement-physics-lab|lab-reset|lab-slow/);
  assert.equal(manifest.dependencies['@mymg/escapement-physics-lab'],undefined);
  assert.doesNotMatch(lock,/rapier2d-compat|escapement-physics-lab/);
  assert.ok(!existsSync(join(root,'animations/escapement-physics-lab')));
  assert.ok(!existsSync(join(root,'apps/portal/qa-escapement-physics-lab.mjs')));
  assert.match(catalog,/id: 'pendulum-clock'/);
});
