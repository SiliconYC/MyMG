import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
const [filename,expectedDuration,expectedFps='30']=process.argv.slice(2);
if(!filename||!existsSync(resolve(filename))){
  console.error('Usage: pnpm qa output/example.mp4 [duration_seconds] [fps]');
  process.exit(2);
}
const result=spawnSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',resolve(filename)],{encoding:'utf8'});
if(result.status!==0)throw new Error('ffprobe unavailable; install FFmpeg');
const data=JSON.parse(result.stdout);
const video=data.streams.find(s=>s.codec_type==='video');
if(!video)throw new Error('Video stream missing');
const [a,b]=video.r_frame_rate.split('/').map(Number),fps=a/b;
const duration=Number(data.format.duration);
if(Math.abs(fps-Number(expectedFps))>.01)throw new Error('Frame rate mismatch: '+fps);
if(expectedDuration&&Math.abs(duration-Number(expectedDuration))>.08)throw new Error('Duration mismatch: '+duration);
if(!video.width||!video.height)throw new Error('Invalid resolution');
console.log(JSON.stringify({codec:video.codec_name,width:video.width,height:video.height,fps,duration,frames:video.nb_frames,audio:data.streams.some(s=>s.codec_type==='audio')},null,2));
console.log('Metadata verified. Captured frames still require visual review.');
