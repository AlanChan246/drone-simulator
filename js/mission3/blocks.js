/* Inputs and actions only: no solver or automatic navigation block. */
Blockly.defineBlocksWithJsonArray([
    {type:'sky_signal',message0:'閘門要求的頻道',output:'String',colour:'#5b67a5',tooltip:'即時讀取目前閘門的 A / B / C；須在門前感測區。'},
    {type:'sky_channel',message0:'頻道 %1',args0:[{type:'field_dropdown',name:'CHANNEL',options:[['A ●','A'],['B ▲','B'],['C ■','C']]}],output:'String',colour:'#5b67a5'},
    {type:'sky_channel_is',message0:'閘門頻道是 %1？',args0:[{type:'field_dropdown',name:'CHANNEL',options:[['A ●','A'],['B ▲','B'],['C ■','C']]}],output:'Boolean',colour:'#5b67a5',tooltip:'讀取目前閘門訊號，再比較是否相符。'},
    {type:'sky_gate_open',message0:'閘門已打開？',output:'Boolean',colour:'#5b67a5'},
    {type:'sky_gate_distance',message0:'距離下一道閘門（cm）',output:'Number',colour:'#5b67a5'},
    {type:'sky_set_channel',message0:'設定通訊頻道 %1',args0:[{type:'field_dropdown',name:'CHANNEL',options:[['A ●','A'],['B ▲','B'],['C ■','C']]}],previousStatement:null,nextStatement:null,colour:'#007c80'},
    {type:'sky_send',message0:'發送通行訊號',previousStatement:null,nextStatement:null,colour:'#007c80'},
    {type:'sky_wait_until',message0:'等待直到 %1',args0:[{type:'input_value',name:'CONDITION',check:'Boolean'}],previousStatement:null,nextStatement:null,colour:'#96630c'},
    {type:'sky_activate',message0:'啟動天空基地',previousStatement:null,nextStatement:null,colour:'#007c80',tooltip:'通過三道閘門並在核心平台降落後，啟動基地。'}
]);
window.SkyToolbox = (()=>{
    const number=(name,value)=>`<value name="${name}"><shadow type="math_number"><field name="NUM">${value}</field></shadow></value>`;
    const xml=`<xml><category name="事件與飛行" colour="#2768ad"><block type="event_start"/><block type="drone_takeoff"/><block type="drone_move_cm">${number('DIST',50)}</block><block type="drone_turn_degree">${number('DEGREE',90)}</block><block type="drone_land"/><block type="drone_hover">${number('DURATION',1)}</block></category>
    <category name="閘門通訊" colour="#007c80"><block type="sky_channel_is"/><block type="sky_set_channel"/><block type="sky_send"/><block type="sky_gate_open"/><block type="sky_wait_until"><value name="CONDITION"><block type="sky_gate_open"/></value></block><block type="sky_activate"/></category>
    <category name="判斷與迴圈" colour="#96630c"><block type="controls_if"><mutation else="1"/></block><block type="controls_repeat_ext">${number('TIMES',3)}</block><block type="controls_whileUntil"><field name="MODE">UNTIL</field></block><block type="logic_compare"/><block type="logic_operation"/><block type="logic_negate"/><block type="logic_boolean"/></category>
    <category name="感測與數值" colour="#5b67a5"><block type="sky_signal"/><block type="sky_channel"/><block type="sky_gate_distance"/><block type="drone_get_height"/><block type="math_number"/><block type="math_arithmetic"/><block type="drone_print"><value name="TEXT"><shadow type="text"><field name="TEXT">觀察結果</field></shadow></value></block></category>
    <category name="變數" colour="#a55b80" custom="VARIABLE"/><category name="自訂行為" colour="#734c99" custom="SKY_PROCEDURE"/></xml>`;
    function install(ws){ws.registerToolboxCategoryCallback('SKY_PROCEDURE',w=>Blockly.Procedures.flyoutCategory(w).filter(n=>!['procedures_defreturn','procedures_callreturn','procedures_ifreturn'].includes(n.getAttribute('type'))));ws.updateToolbox(Blockly.utils.xml.textToDom(xml));}
    return {install,xml};
})();
