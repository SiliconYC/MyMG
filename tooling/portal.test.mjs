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
  assert.match(catalog,/component:\s*HbmInfrastructureCheck/);
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
