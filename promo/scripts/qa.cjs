const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),reports=[];
for(const suffix of ['1080p','master','web']){
 const file=path.join(root,'output',`drone-simulator-promo-45s-${suffix}.mp4`);
 const probe=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8'});assert.equal(probe.status,0,probe.stderr);
 const data=JSON.parse(probe.stdout),v=data.streams.find(x=>x.codec_type==='video'),a=data.streams.find(x=>x.codec_type==='audio');
 assert.equal(v.width,1920);assert.equal(v.height,1080);assert.equal(v.r_frame_rate,'30/1');assert.equal(Number(v.nb_frames),1350);assert.equal(Number(v.duration),45);assert.ok(Math.abs(Number(data.format.duration)-45)<.1); // AAC encoder padding may extend the container by <100 ms.
 assert.equal(a.channels,2);assert.equal(a.sample_rate,'48000');
 const decode=spawnSync('ffmpeg',['-v','error','-i',file,'-f','null','-'],{encoding:'utf8'});assert.equal(decode.status,0,decode.stderr);assert.equal(decode.stderr.trim(),'');
 reports.push({suffix,bytes:fs.statSync(file).size,duration:Number(data.format.duration),width:v.width,height:v.height,fps:v.r_frame_rate,frames:Number(v.nb_frames),audio:a.codec_name,decode:'passed'});
}
for(const n of [1,2]){const p=JSON.parse(fs.readFileSync(path.join(root,`captures/mission${n}-proof.json`)));assert.equal(p.completed.complete,true);assert.equal(p.completed.collision,false);assert.equal(p.errors.length,0);assert.ok(p.result.includes(n===1?'700':'1225'));if(n===2){assert.equal(p.completed.variant,'mission2-v2');assert.equal(p.completed.fires,4);}}
fs.writeFileSync(path.join(root,'captures/final-technical-qa.json'),JSON.stringify({checkedAt:new Date().toISOString(),reports},null,2));console.log(JSON.stringify(reports,null,2));
