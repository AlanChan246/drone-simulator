const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const files=['index.html','js/main.js','js/simulator.js','js/v2_ui.js','js/scenes/mission2-v2/environment.js'];
 const result=await Promise.all(files.map(async file=>{
  const response=await fetch('https://alanchan246.github.io/drone-simulator/'+file);
  if(!response.ok)throw new Error(`${response.status}: ${file}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  return {file,same:bytes.equals(fs.readFileSync(path.join(root,file))),productionSha256:createHash('sha256').update(bytes).digest('hex')};
 }));
 fs.writeFileSync(path.join(root,'promo/captures/audit/production-parity.json'),JSON.stringify({checkedAt:new Date().toISOString(),files:result},null,2));
 console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
