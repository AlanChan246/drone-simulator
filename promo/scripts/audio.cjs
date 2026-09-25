// Original 120 BPM instrumental and editorial sound design. No samples.
const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const out=path.resolve(__dirname,'../public/audio');fs.mkdirSync(out,{recursive:true});
const sr=48000,duration=45,N=sr*duration;
const music=[new Float32Array(N),new Float32Array(N)],fx=[new Float32Array(N),new Float32Array(N)];
const hz=n=>440*2**((n-69)/12);
function tone(bus,start,length,note,amp,kind='key',pan=0){
 const f=hz(note),count=Math.floor(length*sr),base=Math.floor(start*sr);
 for(let i=0;i<count&&base+i<N;i++){
  const t=i/sr,u=t/length;
  const env=kind==='pad'?Math.min(1,t/.5)*Math.min(1,(length-t)/.65):Math.min(1,t/.006)*Math.exp(-t*(kind==='bass'?5:7))*Math.min(1,(length-t)/.08);
  const wave=Math.sin(2*Math.PI*f*t)+(kind==='pad'?.22:.12)*Math.sin(2*Math.PI*f*2.003*t);
  const v=wave*env*amp;
  bus[0][base+i]+=v*(1-pan*.35);bus[1][base+i]+=v*(1+pan*.35);
  if(kind==='key'&&base+i+Math.round(.1875*sr)<N){bus[1][base+i+Math.round(.1875*sr)]+=v*.18;}
 }
}
function hit(start,kind,amp,bus=music){
 const length=kind==='kick'?.22:kind==='click'?.055:.12,base=Math.floor(start*sr);
 let seed=1234567;
 for(let i=0;i<length*sr&&base+i<N;i++){
  const t=i/sr;seed=(1664525*seed+1013904223)>>>0;const noise=(seed/4294967296)*2-1;
  let v=kind==='kick'?Math.sin(2*Math.PI*(48*t+2.8*(1-Math.exp(-t*35))))*Math.exp(-t*22):noise*Math.exp(-t*(kind==='click'?95:65))*.25+Math.sin(t*2*Math.PI*(kind==='click'?1500:6800))*Math.exp(-t*70)*.12;
  bus[0][base+i]+=v*amp;bus[1][base+i]+=v*amp;
 }
}
const chords=[[50,57,61,66],[47,54,59,62],[43,50,57,59],[45,52,59,61]];
for(let t=0;t<41;t+=4){const ch=chords[(t/4)%4];ch.forEach((n,i)=>tone(music,t,4.4,n+12,.016,'pad',(i-1.5)/2));}
for(let t=4;t<41;t+=.5){
 const ch=chords[Math.floor(t/4)%4],beat=Math.round(t*2);
 const energy=t<14?.65:t>=25&&t<30?.55:1;
 hit(t,'kick',.12*energy);if(beat%2===1)hit(t,'hat',.085*energy);
 tone(music,t,.42,ch[0]-(beat%4===3?0:12),.055*energy,'bass');
 if(t>=8){tone(music,t,.75,ch[[0,2,1,3][beat%4]]+24,.028*energy,'key',beat%2?-.5:.5);}
 if(t>=30){hit(t+.25,'hat',.04);tone(music,t+.25,.6,ch[(beat+1)%4]+24,.018,'key',-.3);}
}
[62,69,73,78].forEach((n,i)=>tone(music,41,4,n,.025,'pad',(i-1.5)/2));
hit(6.9,'click',.17,fx);hit(9.3,'click',.1,fx);hit(10.5,'click',.1,fx);
hit(14.55,'kick',.21,fx);tone(fx,14.55,.7,74,.07,'key');
[0,.1,.22].forEach((d,i)=>tone(fx,25+d,.95,[74,78,81][i],.065,'key',i/4));
tone(fx,30,1.5,62,.045,'key');
[39,39.5,40,40.5].forEach(t=>hit(t,'click',.06,fx));
function wav(filename,bus){
 const b=Buffer.alloc(44+N*4);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(N*4,40);
 for(let i=0;i<N;i++){const t=i/sr,fade=Math.min(1,t/.35,(45-t)/1.1);for(let c=0;c<2;c++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,bus[c][i]*fade))*32767),44+i*4+c*2);}
 fs.writeFileSync(path.join(out,filename),b);
}
wav('music-original.wav',music);wav('sfx-original.wav',fx);
const result=spawnSync('ffmpeg',['-y','-hide_banner','-i',path.join(out,'music-original.wav'),'-i',path.join(out,'sfx-original.wav'),'-filter_complex','[0:a][1:a]amix=inputs=2:normalize=0,loudnorm=I=-18:TP=-1.5:LRA=9:print_format=json[a]','-map','[a]','-ar','48000','-c:a','pcm_s16le',path.join(out,'promo-mix.wav')],{encoding:'utf8'});
fs.writeFileSync(path.resolve(__dirname,'../captures/audio-mix.log'),result.stderr);if(result.status)throw new Error(result.stderr);console.log('Original music + SFX rendered at 48 kHz stereo.');
