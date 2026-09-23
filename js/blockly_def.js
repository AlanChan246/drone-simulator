// ==========================================
// 檔案：js/blockly_def.js
// 用途：定義 Blockly 積木外觀與生成代碼邏輯
// ==========================================
Blockly.defineBlocksWithJsonArray([
    // --- Events ---
    {
        "type": "event_start",
        "message0": "當按下執行",
        "nextStatement": null, "colour": "#FFBF00", "tooltip": "程式開始"
    },
    {
        "type": "event_wait_key",
        "message0": "等待按下空白鍵",
        "previousStatement": null, "nextStatement": null, "colour": "#FFBF00", "tooltip": "暫停直到按下空白鍵"
    },
    // --- Basic Flight ---
    {
        "type": "drone_takeoff",
        "message0": "起飛",
        "previousStatement": null, "nextStatement": null, "colour": "#4C97FF"
    },
    {
        "type": "drone_land",
        "message0": "降落",
        "previousStatement": null, "nextStatement": null, "colour": "#4C97FF"
    },
    {
        "type": "drone_collect_water",
        "message0": "取水",
        "previousStatement": null, "nextStatement": null, "colour": "#00adb5",
        "tooltip": "在水源上方取水"
    },
    {
        "type": "drone_release_water",
        "message0": "噴水滅火",
        "previousStatement": null, "nextStatement": null, "colour": "#ff5722",
        "tooltip": "在火場上方噴水滅火"
    },
    {
        "type": "drone_hover",
        "message0": "懸停 %1 秒",
        "args0": [{ "type": "input_value", "name": "DURATION", "check": "Number" }],
        "previousStatement": null, "nextStatement": null, "colour": "#4C97FF"
    },
    {
        "type": "drone_move_time",
        "message0": "向 %1 飛行 %2 秒，動力 %3 %%",
        "args0": [
            { "type": "field_dropdown", "name": "DIR", "options": [["前", "FORWARD"], ["後", "BACKWARD"], ["左", "LEFT"], ["右", "RIGHT"], ["上", "UP"], ["下", "DOWN"]] },
            { "type": "input_value", "name": "DURATION", "check": "Number" },
            { "type": "input_value", "name": "POWER", "check": "Number" }
        ],
        "previousStatement": null, "nextStatement": null, "colour": "#4C97FF"
    },
    {
        "type": "drone_move_cm",
        "message0": "向 %1 飛行 %2 cm",
        "args0": [
            { "type": "field_dropdown", "name": "DIR", "options": [["前", "FORWARD"], ["後", "BACKWARD"], ["左", "LEFT"], ["右", "RIGHT"], ["上", "UP"], ["下", "DOWN"]] },
            { "type": "input_value", "name": "DIST", "check": "Number" }
        ],
        "previousStatement": null, "nextStatement": null, "colour": "#4C97FF"
    },
    {
        "type": "drone_turn",
        "message0": "向 %1 轉 %2 度",
        "args0": [
            { "type": "field_dropdown", "name": "DIR", "options": [["左", "LEFT"], ["右", "RIGHT"]] },
            { "type": "input_value", "name": "DEGREE", "check": "Number" }
        ],
        "previousStatement": null, "nextStatement": null, "colour": "#4C97FF"
    },
    {
        "type": "drone_goto_xyz",
        "message0": "飛往座標 (x, y, z) = (%1, %2, %3) m",
        "args0": [
            { "type": "input_value", "name": "X", "check": "Number" },
            { "type": "input_value", "name": "Y", "check": "Number" },
            { "type": "input_value", "name": "Z", "check": "Number" }
        ],
        "previousStatement": null, "nextStatement": null, "colour": "#4C97FF"
    },
    {
        "type": "drone_turn_degree",
        "message0": "向 %1 轉 %2 度",
        "args0": [
            { "type": "field_dropdown", "name": "DIR", "options": [["左", "LEFT"], ["右", "RIGHT"]] },
            { "type": "input_value", "name": "DEGREE", "check": "Number" }
        ],
        "previousStatement": null, "nextStatement": null, "colour": "#4C97FF"
    },
    {
        "type": "drone_turn_time",
        "message0": "向 %1 轉 %2 秒，動力 %3 %%",
        "args0": [
            { "type": "field_dropdown", "name": "DIR", "options": [["左", "LEFT"], ["右", "RIGHT"]] },
            { "type": "input_value", "name": "DURATION", "check": "Number" },
            { "type": "input_value", "name": "POWER", "check": "Number" }
        ],
        "previousStatement": null, "nextStatement": null, "colour": "#4C97FF"
    },
    // --- Advanced Flight ---
    {
        "type": "drone_set_variable",
        "message0": "設定 %1 為 %2 %%",
        "args0": [
            { "type": "field_dropdown", "name": "VAR", "options": [["橫滾", "ROLL"], ["俯仰", "PITCH"], ["偏航", "YAW"], ["升降", "THROTTLE"]] },
            { "type": "input_value", "name": "VAL", "check": "Number" }
        ],
        "previousStatement": null, "nextStatement": null, "colour": "#364d99"
    },
    {
        "type": "drone_turn_heading",
        "message0": "轉至航向 %1 °",
        "args0": [{ "type": "input_value", "name": "DEGREE", "check": "Number" }],
        "previousStatement": null, "nextStatement": null, "colour": "#364d99"
    },
    {
        "type": "drone_move_complex",
        "message0": "按目前動力飛行 %1 秒",
        "args0": [{ "type": "input_value", "name": "DURATION", "check": "Number" }],
        "previousStatement": null, "nextStatement": null, "colour": "#364d99"
    },
    {
        "type": "drone_move_complex_infinite",
        "message0": "按目前動力飛行一小步",
        "previousStatement": null, "nextStatement": null, "colour": "#364d99",
        "tooltip": "使用當前參數移動一小步"
    },
    // --- Lights ---
    {
        "type": "drone_set_led_color",
        "message0": "設定 %1 燈光為 %2，亮度 %3",
        "args0": [
            { "type": "field_dropdown", "name": "DRONE_ID", "options": [["無人機", "drone"]] },
            { "type": "input_value", "name": "COLOR" },
            { "type": "input_value", "name": "BRIGHTNESS", "check": "Number" }
        ],
        "inputsInline": true,
        "previousStatement": null, "nextStatement": null, "colour": 260,
        "tooltip": "Set LED color and brightness"
    },
    {
        "type": "drone_set_led_rgb",
        "message0": "設定 %1 燈光 R %2 G %3 B %4，亮度 %5",
        "args0": [
            { "type": "field_dropdown", "name": "DRONE_ID", "options": [["無人機", "drone"]] },
            { "type": "input_value", "name": "R_VAL", "check": "Number" },
            { "type": "input_value", "name": "G_VAL", "check": "Number" },
            { "type": "input_value", "name": "B_VAL", "check": "Number" },
            { "type": "input_value", "name": "BRIGHTNESS", "check": "Number" }
        ],
        "inputsInline": true,
        "previousStatement": null, "nextStatement": null, "colour": 260,
        "tooltip": "Set custom RGB values"
    },
    {
        "type": "drone_led_off",
        "message0": "關閉 %1 燈光",
        "args0": [
            { "type": "field_dropdown", "name": "DRONE_ID", "options": [["無人機", "drone"]] }
        ],
        "inputsInline": true,
        "previousStatement": null, "nextStatement": null, "colour": 260,
        "tooltip": "Turn off LED"
    },
    {
        "type": "drone_led_sequence",
        "message0": "設定 %1 燈效 %2，R %3 G %4 B %5，速度 %6",
        "args0": [
            { "type": "field_dropdown", "name": "DRONE_ID", "options": [["無人機", "drone"]] },
            { "type": "field_dropdown", "name": "SEQUENCE", "options": [["漸變", "DIMMING"], ["閃爍", "BLINKING"]] },
            { "type": "input_value", "name": "R_VAL", "check": "Number" },
            { "type": "input_value", "name": "G_VAL", "check": "Number" },
            { "type": "input_value", "name": "B_VAL", "check": "Number" },
            { "type": "field_dropdown", "name": "SPEED", "options": [["1", "1"], ["2", "2"], ["3", "3"]] }
        ],
        "inputsInline": true,
        "previousStatement": null, "nextStatement": null, "colour": 260,
        "tooltip": "Play LED sequence"
    },
    // --- Sensors ---
    {
        "type": "drone_get_range",
        "message0": "讀取 %1 距離（%2）",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "TYPE",
                "options": [
                    ["前方", "front"],
                    ["左", "left"],
                    ["右", "right"],
                    ["下方", "bottom"]
                ]
            },
            {
                "type": "field_dropdown",
                "name": "UNIT",
                "options": [
                    ["cm", "cm"],
                    ["mm", "mm"],
                    ["in", "in"],
                    ["m", "m"]
                ]
            }
        ],
        "output": "Number",
        "colour": "#5b67a5",
        "tooltip": "Get distance from sensor"
    },
    {
        "type": "drone_get_height",
        "message0": "讀取高度（%1）",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "UNIT",
                "options": [
                    ["cm", "cm"],
                    ["mm", "mm"],
                    ["in", "in"],
                    ["m", "m"]
                ]
            }
        ],
        "output": "Number",
        "colour": "#5b67a5",
        "tooltip": "Get drone height from bottom sensor"
    },
    // --- Console ---
    {
        "type": "drone_print",
        "message0": "記錄 %1",
        "args0": [
            {
                "type": "input_value",
                "name": "TEXT"
            }
        ],
        "previousStatement": null,
        "nextStatement": null,
        "colour": 210, 
        "tooltip": "Print text to console log"
    },
    {
        "type": "drone_get_pos",
        "message0": "讀取目前 %1 座標",
        "args0": [
            {
                "type": "field_dropdown",
                "name": "AXIS",
                "options": [["x", "X"], ["y", "Y"], ["z", "Z"]]
            }
        ],
        "output": "Number",
        "colour": "#5b67a5",
        "tooltip": "獲取無人機當前坐標 (cm)"
    },
]);
// --- Generator Functions ---
// 輔助函數：為命令添加積木塊 ID
function addBlockIdToCommand(block, commandObj) {
    if (block && block.id) {
        return `Object.assign(${commandObj}, {_blockId: '${block.id}'})`;
    }
    return commandObj;
}

Blockly.JavaScript['event_start'] = function(block) { return ""; };
Blockly.JavaScript['event_wait_key'] = function(block) { 
    return `cmdQueue.push(Object.assign({type: 'wait_key', text: 'Wait Key'}, {_blockId: '${block.id}'}));\n`; 
};
Blockly.JavaScript['drone_takeoff'] = function(block) { 
    return `cmdQueue.push(Object.assign({type: 'takeoff', text: 'Takeoff'}, {_blockId: '${block.id}'}));\n`; 
};
Blockly.JavaScript['drone_land'] = function(block) { 
    return `cmdQueue.push(Object.assign({type: 'land', text: 'Land'}, {_blockId: '${block.id}'}));\n`; 
};
Blockly.JavaScript['drone_collect_water'] = function(block) {
    return `cmdQueue.push(Object.assign({type: 'collect_water', text: 'Collect Water'}, {_blockId: '${block.id}'}));\n`;
};
Blockly.JavaScript['drone_release_water'] = function(block) {
    return `cmdQueue.push(Object.assign({type: 'release_water', text: 'Release Water'}, {_blockId: '${block.id}'}));\n`;
};
Blockly.JavaScript['drone_hover'] = function(block) {
    let d = Blockly.JavaScript.valueToCode(block, 'DURATION', Blockly.JavaScript.ORDER_ATOMIC) || '1';
    return `cmdQueue.push(Object.assign({type: 'hover', param: ${d}, text: 'Hover ${d}s'}, {_blockId: '${block.id}'}));\n`;
};
Blockly.JavaScript['drone_move_time'] = function(block) {
    let dir = block.getFieldValue('DIR'); 
    let d = Blockly.JavaScript.valueToCode(block, 'DURATION', Blockly.JavaScript.ORDER_ATOMIC) || '1';
    let p = Blockly.JavaScript.valueToCode(block, 'POWER', Blockly.JavaScript.ORDER_ATOMIC) || '50';
    return `cmdQueue.push(Object.assign({type: 'move_${dir.toLowerCase()}', param: ${d}, power: ${p}, text: 'Go ${dir} ${d}s'}, {_blockId: '${block.id}'}));\n`;
};
Blockly.JavaScript['drone_move_cm'] = function(block) {
    let dir = block.getFieldValue('DIR');
    let d = Blockly.JavaScript.valueToCode(block, 'DIST', Blockly.JavaScript.ORDER_ATOMIC) || '50';
    let timeCalc = `${d} / 50.0`; 
    return `cmdQueue.push(Object.assign({type: 'move_${dir.toLowerCase()}', param: ${timeCalc}, text: 'Go ${dir} ${d}cm'}, {_blockId: '${block.id}'}));\n`;
};
Blockly.JavaScript['drone_goto_xyz'] = function(block) {
    let x = Blockly.JavaScript.valueToCode(block, 'X', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    let y = Blockly.JavaScript.valueToCode(block, 'Y', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    let z = Blockly.JavaScript.valueToCode(block, 'Z', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return `cmdQueue.push(Object.assign({type: 'goto_xyz', x: ${x}*100, y: ${z}*100, z: ${y}*(-100), text: 'Goto (${x},${y},${z})m'}, {_blockId: '${block.id}'}));\n`; 
};
Blockly.JavaScript['drone_turn_degree'] = function(block) {
    let dir = block.getFieldValue('DIR');
    let d = Blockly.JavaScript.valueToCode(block, 'DEGREE', Blockly.JavaScript.ORDER_ATOMIC) || '90';
    return `cmdQueue.push(Object.assign({type: 'turn_${dir.toLowerCase()}', param: ${d}, text: 'Turn ${dir} ${d}°'}, {_blockId: '${block.id}'}));\n`;
};
Blockly.JavaScript['drone_turn_time'] = function(block) {
    let dir = block.getFieldValue('DIR');
    let d = Blockly.JavaScript.valueToCode(block, 'DURATION', Blockly.JavaScript.ORDER_ATOMIC) || '1';
    let p = Blockly.JavaScript.valueToCode(block, 'POWER', Blockly.JavaScript.ORDER_ATOMIC) || '50';
    return `cmdQueue.push(Object.assign({type: 'turn_time', dir: '${dir}', param: ${d}, power: ${p}, text: 'Turn ${dir} ${d}s'}, {_blockId: '${block.id}'}));\n`;
};
Blockly.JavaScript['drone_set_variable'] = function(block) {
    let v = block.getFieldValue('VAR');
    let val = Blockly.JavaScript.valueToCode(block, 'VAL', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return `cmdQueue.push(Object.assign({type: 'set_var', var: '${v}', val: ${val}, text: 'Set ${v} ${val}%'}, {_blockId: '${block.id}'}));\n`;
};
Blockly.JavaScript['drone_turn_heading'] = function(block) {
    let h = Blockly.JavaScript.valueToCode(block, 'DEGREE', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return `cmdQueue.push(Object.assign({type: 'set_heading', val: ${h}, text: 'Heading ${h}°'}, {_blockId: '${block.id}'}));\n`;
};
Blockly.JavaScript['drone_move_complex'] = function(block) {
    let d = Blockly.JavaScript.valueToCode(block, 'DURATION', Blockly.JavaScript.ORDER_ATOMIC) || '1';
    return `cmdQueue.push(Object.assign({type: 'move_complex', param: ${d}, text: 'Move(${d}s)'}, {_blockId: '${block.id}'}));\n`;
};
Blockly.JavaScript['drone_move_complex_infinite'] = function(block) {
    return `cmdQueue.push(Object.assign({type: 'move_complex', param: 0.1, text: 'Move()'}, {_blockId: '${block.id}'}));\n`;
};
Blockly.JavaScript['drone_set_color'] = function(block) {
    let c = block.getFieldValue('COLOR');
    return `cmdQueue.push(Object.assign({type: 'set_color', param: '${c}', text: 'LED ${c}'}, {_blockId: '${block.id}'}));\n`;
};
// --- Light 生成邏輯 ---
Blockly.JavaScript['drone_set_led_color'] = function(block) {
    let color = Blockly.JavaScript.valueToCode(block, 'COLOR', Blockly.JavaScript.ORDER_ATOMIC) || "'#ff0000'";
    let bright = Blockly.JavaScript.valueToCode(block, 'BRIGHTNESS', Blockly.JavaScript.ORDER_ATOMIC) || '255';
    return `cmdQueue.push(Object.assign({type: 'led_hex_bright', color: ${color}, brightness: ${bright}, text: 'LED ' + ${color} + ' (' + ${bright} + ')'}, {_blockId: '${block.id}'}));\n`;
};
Blockly.JavaScript['drone_set_led_rgb'] = function(block) {
    let r = Blockly.JavaScript.valueToCode(block, 'R_VAL', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    let g = Blockly.JavaScript.valueToCode(block, 'G_VAL', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    let b = Blockly.JavaScript.valueToCode(block, 'B_VAL', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    let br = Blockly.JavaScript.valueToCode(block, 'BRIGHTNESS', Blockly.JavaScript.ORDER_ATOMIC) || '255';
    return `cmdQueue.push(Object.assign({type: 'led_rgb', r: ${r}, g: ${g}, b: ${b}, brightness: ${br}, text: 'LED RGB(' + ${r} + ',' + ${g} + ',' + ${b} + ')'}, {_blockId: '${block.id}'}));\n`;
};
Blockly.JavaScript['drone_led_off'] = function(block) {
    return `cmdQueue.push(Object.assign({type: 'led_off', text: 'LED OFF'}, {_blockId: '${block.id}'}));\n`;
};
Blockly.JavaScript['drone_led_sequence'] = function(block) {
    let seq = block.getFieldValue('SEQUENCE'); 
    let r = Blockly.JavaScript.valueToCode(block, 'R_VAL', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    let g = Blockly.JavaScript.valueToCode(block, 'G_VAL', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    let b = Blockly.JavaScript.valueToCode(block, 'B_VAL', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return `cmdQueue.push(Object.assign({type: 'led_seq', seq: '${seq}', r: ${r}, g: ${g}, b: ${b}, text: 'Seq: ${seq}'}, {_blockId: '${block.id}'}));\n`;
};
Blockly.JavaScript['drone_get_range'] = function(block) {
    var sensorType = block.getFieldValue('TYPE');
    var unit = block.getFieldValue('UNIT');
    var code = `getSensorReading('${sensorType}', '${unit}')`; 
    return [code, Blockly.JavaScript.ORDER_FUNCTION_CALL];
};
Blockly.JavaScript['drone_get_height'] = function(block) {
    var unit = block.getFieldValue('UNIT');
    var code = `getSensorReading('bottom', '${unit}')`;
    return [code, Blockly.JavaScript.ORDER_FUNCTION_CALL];
};
Blockly.JavaScript['drone_print'] = function(block) {
    var msgCode = Blockly.JavaScript.valueToCode(block, 'TEXT', Blockly.JavaScript.ORDER_NONE) || "''";
    var targetBlock = block.getInputTargetBlock('TEXT');
    var prefix = ""; 
    var suffix = ""; 
    if (targetBlock) {
        if (targetBlock.type === 'drone_get_height') {
            prefix = "Height: ";
            var unit = targetBlock.getFieldValue('UNIT'); 
            suffix = " " + unit; 
        } else if (targetBlock.type === 'drone_get_range') {
            var rangeType = targetBlock.getFieldValue('TYPE');
            var unit = targetBlock.getFieldValue('UNIT');
            
            if (rangeType === 'front') prefix = "Front Range: ";
            else prefix = "Bottom Range: ";
            
            suffix = " " + unit;
        }
    }
    
    return `cmdQueue.push(Object.assign({
        type: 'print', 
        fn: () => "${prefix}" + ${msgCode} + "${suffix}", 
        text: 'Print Output'
    }, {_blockId: '${block.id}'}));\n`;
};
// Legacy XML used the shorter turn block name; retain identical command semantics.
Blockly.JavaScript['drone_turn'] = Blockly.JavaScript['drone_turn_degree'];
