#!/usr/bin/env node
// node tooling/new-mg.mjs <slug> <中文标题>
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [slug,title]=process.argv.slice(2);
if(!slug || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug) || !title?.trim()){
  console.error('Usage: node tooling/new-mg.mjs <lowercase-kebab-slug> <title>');
  process.exit(2);
}
const catalogPath=resolve(root,'apps/portal/src/catalog.ts');
const catalog=readFileSync(catalogPath,'utf8');
const componentName=slug.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join('')+'Scene';
const sourcePath=resolve(root,'animations',slug,'web','src',slug+'.tsx');
if(existsSync(sourcePath) || new RegExp("id: '"+slug+"'").test(catalog)){
  throw new Error('Project already exists: '+slug);
}
const imp="import {"+componentName+"} from '../../../animations/"+slug+"/web/src/"+slug+"';\n";
const object=[
  '  {',
  "    id: '"+slug+"',",
  "    compositionId: '"+componentName+"',",
  '    title: '+JSON.stringify(title.trim())+',',
  '    titleEn: '+JSON.stringify(slug.toUpperCase())+',',
  "    category: '二维 / 新作品',",
  "    description: '使用脚手架生成的 MG 项目。',",
  "    status: '原型',",
  '    component: '+componentName+',',
  '    durationInFrames: 90, fps: 30, width: 1280, height: 720,',
  "    notes: ['请编辑自己的画面和作品描述。'],",
  '  },',
].join('\n')+'\n';
const importMarker='// @mymg-generator-imports';
const projectMarker='  // @mymg-generator-projects';
if(!catalog.includes(importMarker)||!catalog.includes(projectMarker)){
  throw new Error('Missing catalog markers, refusing partial scaffold');
}
const newCatalog=catalog.replace(importMarker,imp+importMarker).replace(projectMarker,object+projectMarker);
const source=[
"import React from 'react';",
"import {AbsoluteFill, useCurrentFrame} from 'remotion';",
'',
'export const '+componentName+': React.FC = () => {',
'  const frame=useCurrentFrame();',
"  return <AbsoluteFill style={{background:'#F1EEE8',color:'#21303B',",
"    justifyContent:'center',alignItems:'center',fontSize:64}}>",
'    <div>'+JSON.stringify(title.trim())+'</div>',
'    <div style={{fontSize:24}}>FRAME {frame}</div>',
'  </AbsoluteFill>;',
'};',
].join('\n')+'\n';
mkdirSync(dirname(sourcePath),{recursive:true});
writeFileSync(sourcePath,source);
writeFileSync(catalogPath,newCatalog);
console.log('Created '+slug+'; edit scene/catalog, run pnpm check and pnpm qa:portal.');
