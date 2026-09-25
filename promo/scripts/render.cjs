const path=require('node:path'),fs=require('node:fs');
const {bundle}=require('@remotion/bundler');
const {selectComposition,renderMedia,renderStill}=require('@remotion/renderer');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output'),previews=path.join(root,'previews');
for(const d of [output,previews])fs.mkdirSync(d,{recursive:true});
const browserExecutable=process.env.PROMO_CHROME||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined);
(async()=>{
 const serveUrl=await bundle({entryPoint:path.join(root,'src/index.tsx'),publicDir:path.join(root,'public')});
 const common={serveUrl,browserExecutable};
 const composition=await selectComposition({...common,id:'Promo45'});
 if(process.argv[2]==='previews'){
  for(const sec of [2,5,6,11,14.7,16,20,24.8,27,32,34,36,38,40,44]){await renderStill({...common,composition,frame:Math.round(sec*30),output:path.join(previews,`frame-${String(sec).padStart(2,'0')}.png`)});console.log('Preview',sec);}
  return;
 }
 const master=path.join(output,'drone-simulator-promo-45s-master.mp4');let last=-1;
 await renderMedia({...common,composition,codec:'h264',crf:14,audioBitrate:'192k',pixelFormat:'yuv420p',outputLocation:master,concurrency:3,onProgress:({progress})=>{const n=Math.floor(progress*10);if(n!==last){last=n;console.log(`Render ${n*10}%`)}}});
 for(const [suffix,crf] of [['1080p',18],['web',25]]){
  const r=spawnSync('ffmpeg',['-y','-loglevel','error','-i',master,'-c:v','libx264','-preset','slow','-crf',String(crf),'-c:a','aac','-b:a',suffix==='web'?'128k':'192k','-movflags','+faststart',path.join(output,`drone-simulator-promo-45s-${suffix}.mp4`)],{stdio:'inherit'});if(r.status)throw new Error('FFmpeg export failed');
 }
 const poster=await selectComposition({...common,id:'PromoPoster'});
 await renderStill({...common,composition:poster,frame:0,imageFormat:'jpeg',jpegQuality:95,output:path.join(output,'drone-simulator-promo-poster.jpg')});
 console.log('Master, 1080p, web and poster exported.');
})().catch(e=>{console.error(e);process.exit(1)});
