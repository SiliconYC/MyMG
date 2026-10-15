import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const required = [
  'pnpm-workspace.yaml', 'package.json', 'tsconfig.base.json',
  'apps/studio/src/index.ts', 'apps/studio/src/root.tsx',
  'packages/mg/src/orthographic-stage.tsx', 'packages/mg/src/timing.ts',
  'animations/hbm/web/src/hbm-infrastructure-check.tsx',
  'apps/portal/src/main.tsx', 'apps/portal/src/catalog.ts',
  '.github/workflows/pages.yml', '.github/workflows/portal-qa.yml',
];
for (const file of required) assert.ok(existsSync(join(root, file)), `Missing ${file}`);
const manifests = [
  'apps/studio/package.json', 'packages/mg/package.json',
  'animations/hbm/web/package.json', 'apps/portal/package.json',
];
const names = new Set();
for (const file of manifests) {
  const json = JSON.parse(readFileSync(join(root, file), 'utf8'));
  assert.ok(json.private, `${file} must stay private`);
  assert.ok(!names.has(json.name), `Duplicate workspace name ${json.name}`);
  names.add(json.name);
}
assert.deepEqual([...names].sort(), ['@mymg/hbm', '@mymg/mg', '@mymg/portal', '@mymg/studio']);
const studio = JSON.parse(readFileSync(join(root,'apps/studio/package.json')));
for (const packageName of ['remotion', '@remotion/cli', '@remotion/three']) {
  assert.equal(studio.dependencies[packageName], '4.0.534', `Remotion version mismatch: ${packageName}`);
}
function scan(dir) {
  for (const e of readdirSync(dir, {withFileTypes: true})) {
    if (['node_modules','.git','.venv','output','dist'].includes(e.name)) continue;
    const path=join(dir,e.name);
    if (e.isDirectory()) scan(path);
    else if (e.name === 'pnpm-lock.yaml' && dir !== root) throw new Error(`Extra lockfile: ${path}`);
    else if (/\.(mp4|mov|webm|wav|aac)$/i.test(e.name)) throw new Error(`Media committed to source: ${path}`);
  }
}
scan(root);
const portal = JSON.parse(readFileSync(join(root, 'apps/portal/package.json'), 'utf8'));
for (const packageName of ['remotion','@remotion/player','@remotion/three']) {
  assert.equal(portal.dependencies[packageName], '4.0.534', `Portal Remotion mismatch: ${packageName}`);
}
console.log('Workspace structure OK: 4 packages, one Studio, one Pages portal, aligned Remotion versions.');
