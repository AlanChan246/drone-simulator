/* Mission-specific capabilities; standard Blockly owns control flow and variables. */
(function (root) {
    const statement = { previousStatement: null, nextStatement: null, colour: '#167570' };
    Blockly.defineBlocksWithJsonArray([
        { ...statement, type:'m3_scan', message0:'掃描目前能源站', tooltip:'到達能源站後掃描，才能讀取狀態。' },
        { ...statement, type:'m3_activate', message0:'啟動目前能源站', tooltip:'只可啟動已掃描的 OFFLINE 能源站；危險風暴會阻止啟動。' },
        { ...statement, type:'m3_travel', message0:'飛往能源站編號 %1', args0:[{type:'input_value',name:'INDEX',check:'Number'}], tooltip:'1＝港口 A、2＝城鎮 B、3＝山區 C。只飛到一個目標，不會掃描或啟動。山區航程需 5 秒。' },
        { ...statement, type:'m3_return', message0:'返回基地', tooltip:'飛回 Drone Base；仍需降落積木。' },
        { type:'m3_status', message0:'目前能源站狀態', output:'String', colour:'#5869a0' },
        { type:'m3_status_value', message0:'%1', args0:[{type:'field_dropdown',name:'STATUS',options:[['OFFLINE · 離線','OFFLINE'],['ACTIVE · 正常','ACTIVE'],['UNKNOWN · 未掃描','UNKNOWN']]}], output:'String', colour:'#5869a0' },
        { type:'m3_storm', message0:'山區風暴強度 (0–100)', output:'Number', colour:'#5869a0', tooltip:'可在任何位置讀取。≥70 DANGER，40–69 WARNING，<40 SAFE。低風暴窗口至少 11 秒。' },
        { type:'m3_checked', message0:'已掃描能源站數量', output:'Number', colour:'#5869a0' }
    ]);
    const gen=Blockly.JavaScript;
    ['scan','activate','return'].forEach(action=>{
        gen['m3_'+action]=block=>`cmdQueue.push({type:'m3_${action}',_blockId:${JSON.stringify(block.id)}});\n`;
    });
    gen.m3_travel=block=>`cmdQueue.push({type:'m3_travel',index:${gen.valueToCode(block,'INDEX',gen.ORDER_NONE)||1},_blockId:${JSON.stringify(block.id)}});\n`;
    gen.m3_status=()=>['__sense("status")',gen.ORDER_FUNCTION_CALL];
    gen.m3_status_value=block=>[JSON.stringify(block.getFieldValue('STATUS')),gen.ORDER_ATOMIC];
    gen.m3_storm=()=>['__sense("storm")',gen.ORDER_FUNCTION_CALL];
    gen.m3_checked=()=>['__sense("checked")',gen.ORDER_FUNCTION_CALL];

    const supported = new Set(['event_start','drone_takeoff','drone_land','drone_hover','drone_move_cm','drone_move_time','drone_turn','drone_turn_degree','drone_turn_heading','drone_goto_xyz','drone_print','drone_get_pos','drone_get_height','drone_get_range',
        'controls_if','controls_repeat_ext','controls_whileUntil','controls_for','controls_flow_statements','logic_compare','logic_operation','logic_negate','logic_boolean','logic_ternary','logic_null',
        'math_number','math_arithmetic','math_round','math_modulo','math_change','variables_get','variables_set','text','text_join',
        'm3_scan','m3_activate','m3_return','m3_travel','m3_status','m3_status_value','m3_storm','m3_checked']);
    function compile(ws) {
        const blocks=ws.getAllBlocks(false).filter(b=>b.isEnabled());
        const unsupported=blocks.find(b=>!supported.has(b.type));
        if(unsupported)throw new Error(`此任務暫不支援積木 ${unsupported.type}。請使用任務三工具箱中的積木。`);
        if(!blocks.some(b=>b.type==='drone_takeoff'))throw new Error('請加入起飛積木。');
        const oldTrap=gen.INFINITE_LOOP_TRAP;
        const replaced=[];
        // Wrap statement generators, never rewrite the completed source (which can contain learner text).
        for(const type of supported) {
            if(!type.startsWith('drone_')&&!type.startsWith('m3_'))continue;
            const original=gen[type];
            if(typeof original!=='function')continue;
            replaced.push([type,original]);
            gen[type]=function(block){const out=original.call(this,block);return typeof out==='string'?out.replace(/^cmdQueue\.push\(/gm,'await __command('):out;};
        }
        try {
            gen.INFINITE_LOOP_TRAP='await __tick();\n';
            return gen.workspaceToCode(ws);
        } finally {
            gen.INFINITE_LOOP_TRAP=oldTrap;
            replaced.forEach(([type,original])=>{gen[type]=original;});
        }
    }
    function structure(ws) {
        const blocks=ws.getAllBlocks(false).filter(b=>b.isEnabled());
        const counts={};
        for(const b of blocks)if(b.type.startsWith('drone_')||b.type.startsWith('m3_'))counts[b.type]=(counts[b.type]||0)+1;
        return { blocks:blocks.length, loops:blocks.some(b=>/^controls_(repeat|while|for)/.test(b.type)),conditions:blocks.some(b=>b.type==='controls_if'),variables:blocks.some(b=>b.type==='variables_set'||b.type==='math_change'),duplicates:Object.values(counts).reduce((sum,n)=>sum+Math.max(0,n-1),0) };
    }
    function toolbox() {
        const number=(name,n)=>`<value name="${name}"><shadow type="math_number"><field name="NUM">${n}</field></shadow></value>`;
        return `<xml><category name="飛行" colour="#2768ad"><block type="event_start"/><block type="drone_takeoff"/><block type="m3_travel">${number('INDEX',1)}</block><block type="m3_return"/><block type="drone_land"/><block type="drone_hover">${number('DURATION',1)}</block><block type="drone_move_cm">${number('DIST',50)}</block></category>
        <category name="能源與感測" colour="#167570"><block type="m3_scan"/><block type="m3_status"/><block type="m3_status_value"/><block type="m3_activate"/><block type="m3_storm"/><block type="m3_checked"/></category>
        <category name="判斷" colour="#5869a0"><block type="controls_if"><mutation else="1"/></block><block type="logic_compare"/><block type="logic_operation"/><block type="logic_negate"/><block type="logic_boolean"/></category>
        <category name="迴圈" colour="#96630c"><block type="controls_repeat_ext">${number('TIMES',3)}</block><block type="controls_whileUntil"/><block type="controls_for">${number('FROM',1)}${number('TO',3)}${number('BY',1)}</block><block type="controls_flow_statements"/></category>
        <category name="計算" colour="#39804b"><block type="math_number"/><block type="math_arithmetic"/><block type="math_change">${number('DELTA',1)}</block></category><category name="變數" custom="VARIABLE" colour="#6e7425"/>
        <category name="紀錄" colour="#5869a0"><block type="drone_print"/><block type="text"/><block type="text_join"/></category></xml>`;
    }
    root.Mission3Blockly={compile,structure,toolbox};
})(typeof globalThis!=='undefined'?globalThis:this);
