/* Sky Gate Protocol uses centimetres, matching the existing simulator. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SkyGateConfig=api;})(globalThis,()=>{
    const gates = [
        {id:1,name:'閘門 1',x:-450,z:150,base:0,nx:0,nz:-1},
        {id:2,name:'閘門 2',x:-50,z:50,base:80,nx:1,nz:0},
        {id:3,name:'閘門 3',x:50,z:-450,base:160,nx:0,nz:-1}
    ];
    const platforms = [
        {x:-450,z:400,y:0,w:300,d:350}, {x:-450,z:125,y:0,w:360,d:350},
        {x:-200,z:50,y:80,w:400,d:300}, {x:50,z:50,y:80,w:300,d:300},
        {x:50,z:-220,y:160,w:300,d:350}, {x:50,z:-510,y:160,w:420,d:420},
        {x:50,z:-700,y:160,w:450,d:300}
    ];
    const permutations=['ABC','ACB','BAC','BCA','CAB','CBA'];
    function configuration(mode='standard',revision=0){
        const index=mode==='challenge'?(revision+3)%6:2;
        return {mode,revision,key:`${mode==='challenge'?'C':'S'}-${revision+1}`,gates:gates.map((g,i)=>({...g,signal:permutations[index][i],openingMs:mode==='challenge'?[2400,3600,4800][(i+revision)%3]:[1800,2400,3000][i]}))};
    }
    return {gates,platforms,configuration,spawn:{x:-450,y:14,z:450,heading:0},goal:{x:50,z:-650,y:174},aperture:{halfWidth:90,minY:35,maxY:170},sensorRange:190};
});
