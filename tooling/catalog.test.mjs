import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const catalog=readFileSync(resolve(root,'apps/portal/src/catalog.ts'),'utf8');
const studio=readFileSync(resolve(root,'apps/studio/src/root.tsx'),'utf8');
const ids=[...catalog.matchAll(/^\s*id: '([^']+)'/gm)].map(m=>m[1]);
const compositions=[...catalog.matchAll(/^\s*compositionId: '([^']+)'/gm)].map(m=>m[1]);
assert.ok(ids.length>=2,'HBM and non-HBM demo expected');
assert.equal(ids.length,new Set(ids).size,'Duplicate portal route');
assert.equal(compositions.length,ids.length,'Every project needs a Studio ID');
assert.equal(compositions.length,new Set(compositions).size,'Duplicate Studio composition ID');
assert.match(studio,/projects\.map\(project/,'Studio must use the same catalog');
assert.match(studio,/id={project\.compositionId}/);
for(const id of ids){
  assert.match(id,/^[a-z][a-z0-9-]*$/);
  assert.ok(existsSync(resolve(root,'animations',id,'web','src')),id+' requires independent scene folder');
}
assert.ok(ids.includes('hbm') && ids.includes('demo'));
console.log('Single catalog consistent across portal/Studio: '+ids.join(', '));
