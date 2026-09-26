/* Bounded, asynchronous interpreter. Only Mission 3 uses this path.
 * Snapshot the connected blocks before execution; never eval student text. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SkyProgram=api;})(globalThis,()=>{
    const statements=new Set(['event_start','drone_takeoff','drone_land','drone_move_cm','drone_turn','drone_turn_degree','drone_hover','drone_turn_heading','drone_print','sky_set_channel','sky_send','sky_wait_until','sky_activate','controls_if','controls_repeat_ext','controls_whileUntil','variables_set','math_change','procedures_defnoreturn','procedures_callnoreturn']);
    const expressions=new Set(['math_number','logic_boolean','logic_compare','logic_operation','logic_negate','math_arithmetic','variables_get','text','sky_signal','sky_channel','sky_channel_is','sky_gate_open','sky_gate_distance','drone_get_height','drone_get_pos']);
    class ProgramError extends Error {constructor(message,id){super(message);this.name='ProgramError';this.blockId=id;}}
    function compile(workspace){
        let count=0;
        function node(block,expression=false){
            if(!block)return null;
            if(++count>1200)throw new ProgramError('積木數量過多，請把重複行為改用迴圈。',block.id);
            if(block.isEnabled&&!block.isEnabled())return expression?null:node(block.getNextBlock());
            if(!(expression?expressions:statements).has(block.type))throw new ProgramError(`這塊積木不適用於天空機關城：${block.type}。請使用本關工具箱的積木。`,block.id);
            const n={type:block.type,id:block.id,fields:{},inputs:{}};
            for(const input of block.inputList){
                for(const f of input.fieldRow||[])if(f.name)n.fields[f.name]=f.getValue();
                if(input.connection){const valueInput=input.type===1;n.inputs[input.name]=node(input.connection.targetBlock(),valueInput);if(valueInput&&!n.inputs[input.name])throw new ProgramError('這塊積木有未連接的數值或條件，請先填好。',block.id);}
            }
            if(block.type.startsWith('procedures_')){n.name=block.getProcedureCall?.()||block.getFieldValue('NAME');if(block.arguments_?.length)throw new ProgramError('本關的自訂行為先使用無參數程序。',block.id);}
            if(!expression)n.next=node(block.getNextBlock());
            return n;
        }
        const tops=workspace.getTopBlocks(true).filter(b=>!b.outputConnection&&(!b.isEnabled||b.isEnabled()));
        const definitions=tops.filter(b=>b.type==='procedures_defnoreturn');
        const starts=tops.filter(b=>b.type!=='procedures_defnoreturn');
        if(starts.length!==1||starts[0].type!=='event_start')throw new ProgramError('請把飛行積木連在同一個「當按下執行」下；自訂行為可以放在旁邊。');
        const procedures={};for(const block of definitions){const n=node(block);procedures[n.name]=n.inputs.STACK;}
        return {start:node(starts[0]),procedures};
    }
    async function run(program,io){
        const vars=Object.create(null),stats={steps:0,commands:0,loops:0,procedures:0,waits:0};
        function check(){if(io.stopped())throw new ProgramError('STOP');}
        const finite=(x,n)=>{const v=Number(x);if(!Number.isFinite(v)||Math.abs(v)>10000)throw new ProgramError('數值超出可用範圍，請檢查積木參數。',n.id);return v;};
        function value(n){
            if(!n)throw new ProgramError('請連接感測或數值積木。');
            check();const f=n.fields,i=n.inputs,v=k=>value(i[k]);
            switch(n.type){
                case 'math_number':return finite(f.NUM,n);
                case 'text':return f.TEXT;
                case 'logic_boolean':return f.BOOL==='TRUE';
                case 'sky_channel':return f.CHANNEL;
                case 'sky_signal':return io.sensor('signal',n);
                case 'sky_channel_is':return io.sensor('signal',n)===f.CHANNEL;
                case 'sky_gate_open':return io.sensor('open',n);
                case 'sky_gate_distance':return io.sensor('distance',n);
                case 'drone_get_height':return io.sensor('height',n)/({cm:1,mm:.1,m:100,in:2.54}[f.UNIT]||1);
                case 'drone_get_pos':return io.sensor(f.AXIS.toLowerCase(),n);
                case 'variables_get':return vars[f.VAR]??0;
                case 'logic_negate':return !v('BOOL');
                case 'logic_operation':return f.OP==='AND'?(v('A')&&v('B')):(v('A')||v('B'));
                case 'logic_compare':{const a=v('A'),b=v('B');return {EQ:()=>a===b,NEQ:()=>a!==b,LT:()=>a<b,LTE:()=>a<=b,GT:()=>a>b,GTE:()=>a>=b}[f.OP]();}
                case 'math_arithmetic':{const a=finite(v('A'),n),b=finite(v('B'),n);return finite({ADD:()=>a+b,MINUS:()=>a-b,MULTIPLY:()=>a*b,DIVIDE:()=>a/b,POWER:()=>a**b}[f.OP](),n);}
                default:throw new ProgramError('無法讀取這塊感測積木。',n.id);
            }
        }
        async function chain(n,depth=0){
            if(depth>16)throw new ProgramError('自訂行為呼叫層數太多，請檢查是否不斷呼叫自己。',n?.id);
            while(n){
                check();if(++stats.steps>2400)throw new ProgramError('迴圈仍未達到停止條件。請檢查條件與移動距離。',n.id);
                await io.step(n,stats);check();
                const f=n.fields,i=n.inputs,v=k=>value(i[k]);let cmd=null;
                switch(n.type){
                    case 'event_start':break;
                    case 'controls_if':{let chosen=false;for(let j=0;i['IF'+j];j++)if(v('IF'+j)){await chain(i['DO'+j],depth);chosen=true;break;}if(!chosen)await chain(i.ELSE,depth);break;}
                    case 'controls_repeat_ext':{const times=Math.floor(finite(v('TIMES'),n));if(times<0||times>200)throw new ProgramError('重複次數請設為 0 至 200。',n.id);stats.loops++;for(let j=0;j<times;j++){check();await chain(i.DO,depth);await io.sleep(20);}break;}
                    case 'controls_whileUntil':{stats.loops++;let turns=0;while(Boolean(v('BOOL'))===(f.MODE==='WHILE')){check();if(++turns>200)throw new ProgramError('迴圈條件一直未改變。請檢查感測器與每步的動作。',n.id);await chain(i.DO,depth);await io.sleep(20);}break;}
                    case 'sky_wait_until':{stats.waits++;io.waiting?.();let attempts=0;while(!v('CONDITION')){check();if(++attempts>250)throw new ProgramError('等待條件一直未成立。請檢查是否已發送正確訊號，以及等待的條件。',n.id);await io.sleep(80);}break;}
                    case 'procedures_callnoreturn':if(!Object.hasOwn(program.procedures,n.name))throw new ProgramError('找不到這個自訂行為。',n.id);stats.procedures++;await chain(program.procedures[n.name],depth+1);break;
                    case 'variables_set':vars[f.VAR]=v('VALUE');break;
                    case 'math_change':vars[f.VAR]=finite(vars[f.VAR]??0,n)+finite(v('DELTA'),n);break;
                    case 'drone_takeoff':cmd={type:'takeoff'};break;
                    case 'drone_land':cmd={type:'land'};break;
                    case 'drone_hover':{const secs=finite(v('DURATION'),n);if(secs<0||secs>30)throw new ProgramError('懸停時間請設為 0 至 30 秒。',n.id);cmd={type:'hover',param:secs};break;}
                    case 'drone_move_cm':{const dist=finite(v('DIST'),n);if(dist<=0||dist>1200)throw new ProgramError('飛行距離請設為 1 至 1200 cm。',n.id);cmd={type:'move_'+f.DIR.toLowerCase(),param:dist/50};break;}
                    case 'drone_turn':case 'drone_turn_degree':{const angle=finite(v('DEGREE'),n);if(angle<=0||angle>360)throw new ProgramError('轉向角度請設為 1 至 360 度。',n.id);cmd={type:'turn_'+f.DIR.toLowerCase(),param:angle};break;}
                    case 'drone_turn_heading':cmd={type:'set_heading',val:finite(v('DEGREE'),n)};break;
                    case 'drone_print':{const result=String(v('TEXT'));cmd={type:'print',fn:()=>result};break;}
                    case 'sky_set_channel':cmd={type:'sky_set_channel',channel:f.CHANNEL};break;
                    case 'sky_send':cmd={type:'sky_send'};break;
                    case 'sky_activate':cmd={type:'sky_activate'};break;
                    default:throw new ProgramError('這塊積木不能直接執行。',n.id);
                }
                if(cmd){check();if(++stats.commands>600)throw new ProgramError('指令超過安全上限，請檢查迴圈。',n.id);await io.command({...cmd,_blockId:n.id});}
                n=n.next;
            }
        }
        await chain(program.start);return stats;
    }
    return {compile,run,ProgramError};
});
