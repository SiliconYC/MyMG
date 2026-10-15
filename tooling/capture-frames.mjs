import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const [id,csv,output='output/stills']=process.argv.slice(2);
if(!id||!/^[A-Za-z][A-Za-z0-9]*$/.test(id)||!csv||!/^\d+(,\d+)*$/.test(csv)){
  console.error('Usage: pnpm frames CompositionID 0,30,60 [output/stills]');
  process.exit(2);
}
const outputDir=resolve(root,output);
mkdirSync(outputDir,{recursive:true});
const command=process.platform==='win32'?'pnpm.cmd':'pnpm';
for(const raw of csv.split(',')){
  const frame=Number(raw);
  const destination=join(outputDir,id+'-'+String(frame).padStart(4,'0')+'.png');
  const result=spawnSync(command,['--filter','@mymg/studio','still',id,destination,'--frame',String(frame)],{
    cwd:root,stdio:'inherit',shell:process.platform==='win32'
  });
  if(result.status!==0)process.exit(result.status??1);
}
console.log('Inspect screenshots in '+outputDir);
