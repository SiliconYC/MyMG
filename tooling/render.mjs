import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const [id,output, ...options]=process.argv.slice(2);
if(!id||!/^[A-Za-z][A-Za-z0-9]*$/.test(id)){
  console.error('Usage: pnpm render CompositionID [output/file.mp4] [flags]');
  process.exit(2);
}
const target=resolve(root,output||('output/'+id+'.mp4'));
mkdirSync(dirname(target),{recursive:true});
const command=process.platform==='win32'?'pnpm.cmd':'pnpm';
const result=spawnSync(command,['--filter','@mymg/studio','render',id,target,...options],{
  cwd:root,stdio:'inherit',shell:process.platform==='win32'
});
process.exit(result.status??1);
