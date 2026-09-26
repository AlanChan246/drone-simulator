/* Pure mission rules: no DOM, rendering or Blockly dependency. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./config.js'):root.SkyGateConfig);if(typeof module==='object'&&module.exports)module.exports=api;root.SkyGateRules=api;})(globalThis,(config)=>{
    class GateError extends Error {constructor(code,message){super(message);this.name='GateError';this.code=code;}}
    function create(configuration){
        let gates,channel,completed,activated,rejections,reads,waits,elapsed;
        function reset(){gates=configuration.gates.map(g=>({...g,status:'locked',progress:0,read:false}));channel='A';completed=0;activated=false;rejections=0;reads=0;waits=0;elapsed=0;}
        reset();
        const local=(g,p)=>({along:(p.x-g.x)*g.nx+(p.z-g.z)*g.nz,side:(p.x-g.x)*-g.nz+(p.z-g.z)*g.nx,height:p.y-g.base});
        function target(){return gates[completed]||null;}
        function nearby(p){const g=target();if(!g)return false;const l=local(g,p);return l.along>=-config.sensorRange&&l.along<=-18&&Math.abs(l.side)<=90&&l.height>=35&&l.height<=170;}
        function requireTarget(p){const g=target();if(!g)throw new GateError('all-passed','三道閘門已通過，請前往核心平台降落，再啟動基地。');if(!nearby(p))throw new GateError('range',`${g.name} 的感測範圍是門前 190 cm 內。請對準航道並調整高度。`);return g;}
        function signal(p){const g=requireTarget(p);g.read=true;reads++;return g.signal;}
        function select(value){if(!['A','B','C'].includes(value))throw new GateError('channel','通訊頻道必須是 A、B 或 C。');channel=value;}
        function send(p){const g=requireTarget(p);if(channel!==g.signal){rejections++;throw new GateError('wrong-channel',`${g.name} 要求頻道 ${g.signal}，但無人機發送了 ${channel}。請檢查感測結果與條件分支。`);}if(g.status==='locked'){g.status='accepted';g.progress=0;}return g;}
        function tick(ms){const delta=Math.max(0,Math.min(ms,100));elapsed+=delta;for(const g of gates)if(g.status==='accepted'){g.progress=Math.min(1,g.progress+delta/g.openingMs);if(g.progress>=1)g.status='open';}}
        function move(from,to){
            for(const g of gates){
                const a=local(g,from),b=local(g,to);
                // Swept slab test prevents long commands jumping through a locked door.
                if((a.along<-16&&b.along>=-16)||(a.along>16&&b.along<=16)){
                    const plane=a.along<0?-16:16,t=(plane-a.along)/(b.along-a.along);
                    const side=a.side+(b.side-a.side)*t,height=a.height+(b.height-a.height)*t;
                    if(Math.abs(side)<155&&height>-5&&height<280){
                        if(Math.abs(side)>config.aperture.halfWidth||height<config.aperture.minY||height>config.aperture.maxY)throw new GateError('frame',`${g.name} 的門框擋住航線。請從中央通道、標示高度通過。`);
                        if(g.status!=='open'&&g.status!=='completed')throw new GateError('early',g.status==='accepted'?`${g.name} 正在開啟，無人機太早前進了。請等待「閘門已打開」才通過。`:`${g.name} 尚未收到正確的通行訊號。請先感測、選頻道並發送訊號。`);
                    }
                }
                if(g===target()&&a.along<=16&&b.along>16){
                    const t=(16-a.along)/(b.along-a.along),side=a.side+(b.side-a.side)*t,height=a.height+(b.height-a.height)*t;
                    if(g.status==='open'&&Math.abs(side)<=config.aperture.halfWidth&&height>=config.aperture.minY&&height<=config.aperture.maxY){g.status='completed';completed++;}
                }
            }
            if(to.x<-1000||to.x>800||to.z<-1100||to.z>850||to.y>650)throw new GateError('bounds','無人機已離開基地航區。請檢查飛行方向與距離。');
        }
        function activate(p){if(completed!==3)throw new GateError('incomplete',`已通過 ${completed}/3 道閘門。必須依序通過全部閘門才能啟動基地。`);if(p.isFlying||Math.hypot(p.x-config.goal.x,p.z-config.goal.z)>85||Math.abs(p.y-config.goal.y)>18)throw new GateError('landing','請先在中央核心平台降落，再發送啟動指令。');activated=true;}
        function snapshot(){return {configuration, gates:gates.map(g=>({...g})),channel,completed,activated,rejections,reads,waits,elapsed};}
        return {reset,target,nearby,signal,select,send,tick,move,activate,snapshot,isOpen:()=>target()?.status==='open',noteWait:()=>waits++,distance:p=>target()?Math.hypot(p.x-target().x,p.z-target().z):0};
    }
    return {create,GateError};
});
