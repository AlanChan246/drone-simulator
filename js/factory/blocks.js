/* Scratch zh-tw wording; factory actions are simulator extensions, not Scratch native blocks. */
(function (root) {
    const B = root.Blockly;
    const statement = (type, message0, args0 = [], colour = '#007c80') => ({ type, message0, args0, previousStatement: null, nextStatement: null, colour });
    const bool = name => ({ type: 'input_value', name, check: 'Boolean' });
    const num = name => ({ type: 'input_value', name, check: 'Number' });
    B.defineBlocksWithJsonArray([
        statement('factory_pickup', '夾取零件'), statement('factory_drop', '放下零件'), statement('factory_start_repair', '啟動維修'),
        ...[['factory_intake_ready', '取件台有零件？', 'Boolean'], ['factory_cargo_status', '夾具上的零件狀態', 'String'],
            ['factory_repair_ready', '維修完成？', 'Boolean'], ['factory_delivered', '已交付零件數', 'Number']]
            .map(([type, message0, output]) => ({ type, message0, output, colour: '#3683a6', tooltip: '工廠擴充偵測；執行到這裡才讀取現場狀態。' })),
        statement('factory_wait', '等待 %1 秒', [num('DURATION')], '#b96b11'),
        statement('factory_wait_until', '等待直到 %1', [bool('BOOL')], '#b96b11'),
        { ...statement('factory_repeat', '重複 %1 次', [num('TIMES')], '#b96b11'), message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }] },
        { ...statement('factory_until', '重複直到 %1', [bool('BOOL')], '#b96b11'), message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }] },
        { ...statement('factory_if_else', '如果 %1 那麼', [bool('IF0')], '#b96b11'), message1: '%1', args1: [{ type: 'input_statement', name: 'DO0' }], message2: '否則', message3: '%1', args3: [{ type: 'input_statement', name: 'ELSE' }] },
        statement('factory_set_variable', '變數 %1 設為 %2', [{ type: 'field_variable', name: 'VAR', variable: '計數' }, { type: 'input_value', name: 'VALUE' }], '#a96012'),
        statement('factory_change_variable', '變數 %1 改變 %2', [{ type: 'field_variable', name: 'VAR', variable: '計數' }, num('DELTA')], '#a96012')
    ]);
    // Generators are deliberately unavailable outside the live factory interpreter.
    for (const name of Object.keys(B.Blocks).filter(n => n.startsWith('factory_'))) B.JavaScript[name] = () => { throw new Error('這是工廠任務擴充積木，請切換至失控機械工廠執行。'); };
    const n = (name, value) => `<value name="${name}"><shadow type="math_number"><field name="NUM">${value}</field></shadow></value>`;
    const block = (type, content = '') => `<block type="${type}">${content}</block>`;
    const toolbox = `<xml>
      <category name="事件" colour="#96630c">${block('event_start')}</category>
      <category name="飛行指令" colour="#2768ad">${block('drone_takeoff')}${block('drone_land')}${block('drone_move_cm', n('DIST', 150))}${block('drone_turn_degree', n('DEGREE', 90))}${block('drone_hover', n('DURATION', 1))}${block('drone_turn_heading', n('DEGREE', 0))}</category>
      <category name="工廠擴充" colour="#007c80"><label text="磁力夾具與機器操作"/>${block('factory_pickup')}${block('factory_drop')}${block('factory_start_repair')}</category>
      <category name="控制" colour="#b96b11">${block('factory_repeat', n('TIMES', 6))}${block('factory_if_else')}${block('factory_until')}${block('factory_wait_until')}${block('factory_wait', n('DURATION', 1))}</category>
      <category name="偵測" colour="#3683a6">${block('factory_cargo_status')}${block('factory_intake_ready')}${block('factory_repair_ready')}${block('factory_delivered')}${block('drone_get_range')}${block('drone_get_height')}</category>
      <category name="運算" colour="#448b35">${block('logic_compare', '<field name="OP">EQ</field><value name="B"><shadow type="text"><field name="TEXT">故障</field></shadow></value>')}${block('logic_operation')}${block('logic_negate')}${block('logic_boolean')}${block('math_number')}${block('math_arithmetic')}${block('math_modulo')}${block('math_round')}${block('text', '<field name="TEXT">故障</field>')}${block('text_join')}</category>
      <category name="變數" colour="#a96012" custom="FACTORY_VARIABLE"/>
      <category name="函式積木" colour="#a34082" custom="FACTORY_PROCEDURE"/>
      <category name="輸出" colour="#3683a6">${block('drone_print', '<value name="TEXT"><shadow type="text"><field name="TEXT">觀察零件狀態</field></shadow></value>')}</category>
    </xml>`;
    function install(ws) {
        ws.registerToolboxCategoryCallback('FACTORY_VARIABLE', workspace => {
            const nodes = B.Variables.flyoutCategory(workspace);
            nodes.forEach(node => {
                if (node.getAttribute('type') === 'variables_set') node.setAttribute('type', 'factory_set_variable');
                if (node.getAttribute('type') === 'math_change') node.setAttribute('type', 'factory_change_variable');
            });
            return nodes;
        });
        ws.registerToolboxCategoryCallback('FACTORY_PROCEDURE', workspace => B.Procedures.flyoutCategory(workspace).filter(node => !['procedures_defreturn', 'procedures_ifreturn', 'procedures_callreturn'].includes(node.getAttribute('type'))));
        ws.updateToolbox(B.utils.xml.textToDom(toolbox));
    }
    root.FactoryBlocks = { install, toolbox };
})(typeof globalThis !== 'undefined' ? globalThis : this);
