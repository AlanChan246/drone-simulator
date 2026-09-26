// Teacher/QA reference only. Never loaded by the student's page.
const n=(key,value)=>`<value name="${key}"><shadow type="math_number"><field name="NUM">${value}</field></shadow></value>`;
const block=(type,inside='')=>({type,inside});
function chain(blocks){return blocks.length?`<block type="${blocks[0].type}">${blocks[0].inside}${blocks.length>1?`<next>${chain(blocks.slice(1))}</next>`:''}</block>`:'';}
const field=(key,value)=>`<field name="${key}">${value}</field>`;
const move=(dir,cm)=>block('drone_move_cm',field('DIR',dir)+n('DIST',cm));
const turn=dir=>block('drone_turn_degree',field('DIR',dir)+n('DEGREE',90));
const channel=value=>block('sky_set_channel',field('CHANNEL',value));
const approach=()=>block('controls_whileUntil',field('MODE','UNTIL')+`<value name="BOOL"><block type="logic_compare">${field('OP','LTE')}<value name="A"><block type="sky_gate_distance"/></value>${n('B',100)}</block></value><statement name="DO">${chain([move('FORWARD',100)])}</statement>`);
function handler({hardcoded,skipWait=false,skipSend=false}={}){
 const choose=hardcoded?channel(hardcoded):block('controls_if',`<mutation elseif="1" else="1"/>${['A','B'].map((s,i)=>`<value name="IF${i}"><block type="sky_channel_is">${field('CHANNEL',s)}</block></value><statement name="DO${i}">${chain([channel(s)])}</statement>`).join('')}<statement name="ELSE">${chain([channel('C')])}</statement>`);
 return [choose,...(skipSend?[]:[block('sky_send')]),...(skipWait?[]:[block('sky_wait_until','<value name="CONDITION"><block type="sky_gate_open"/></value>')])];
}
function solution(options={}){
 const call=()=>block('procedures_callnoreturn','<mutation name="處理閘門"/>');
 const blocks=[block('drone_takeoff'),approach(),call(),move('FORWARD',200),turn('RIGHT'),move('UP',80),approach(),call(),move('FORWARD',200),turn('LEFT'),move('UP',80),approach(),call(),move('FORWARD',300),block('drone_land'),block('sky_activate')];
 return `<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_start" x="30" y="30"><next>${chain(blocks)}</next></block><block type="procedures_defnoreturn" x="490" y="30"><field name="NAME">處理閘門</field><statement name="STACK">${chain(handler(options))}</statement></block></xml>`;
}
function program(blocks){return `<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_start" x="30" y="30"><next>${chain(blocks)}</next></block></xml>`;}
module.exports={solution,program,block,move,turn,channel,handler,approach,chain,n,field};
if(require.main===module){require('fs').writeFileSync('test/fixtures/mission3-conditional.xml',solution());}
