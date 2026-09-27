const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createRun}=require('../scripts/qa-output.cjs');
test('QA runs never reuse an output directory and reject paths outside it',()=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'drone-qa-output-test-'));
 try{const a=createRun('factory',parent),b=createRun('factory',parent);assert.notEqual(a.directory,b.directory);
 fs.writeFileSync(a.file('results.json'),'first');fs.writeFileSync(b.file('results.json'),'second');assert.equal(fs.readFileSync(a.file('results.json'),'utf8'),'first');assert.throws(()=>a.file('../preview.png'),/basenames/);
 }finally{fs.rmSync(parent,{recursive:true,force:true});}
});
