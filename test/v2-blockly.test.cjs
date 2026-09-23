const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Blockly = require('blockly/node');
const { javascriptGenerator } = require('blockly/javascript');
Blockly.JavaScript = javascriptGenerator;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/blockly_def.js'), 'utf8'), { Blockly });
function commands(xml) {
    const workspace = new Blockly.Workspace();
    try {
        Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), workspace);
        const code = javascriptGenerator.workspaceToCode(workspace);
        const context = { cmdQueue: [] };
        vm.runInNewContext(code, context, { timeout: 1000 });
        return context.cmdQueue;
    } finally { workspace.dispose(); }
}
test('pre-redesign tunnel XML generates the same nine flight commands with source links', () => {
    const result = commands(fs.readFileSync(path.join(__dirname, 'fixtures/tunnel-direct.xml'), 'utf8'));
    assert.equal(result.length, 9);
    assert.equal(result[0].type, 'takeoff');
    assert.equal(result.at(-1).type, 'land');
    assert.equal(result.filter(c => c.type === 'move_left').length, 4);
    assert.equal(result.filter(c => c.type === 'move_forward').length, 3);
    assert.ok(result.every(c => typeof c._blockId === 'string' && c._blockId.length));
});
test('existing fire-rescue program retains water, recharge waits and all 68 commands', () => {
    const result = commands(fs.readFileSync(path.join(__dirname, 'fixtures/city-reference.xml'), 'utf8'));
    assert.equal(result.length, 68);
    assert.equal(result.filter(c => c.type === 'collect_water').length, 4);
    assert.equal(result.filter(c => c.type === 'release_water').length, 4);
    assert.equal(result.filter(c => c.type === 'hover').length, 3);
    assert.equal(result.at(-1).type, 'land');
});
test('legacy short turn block continues to generate a valid rotation command', () => {
    const result = commands('<xml><block type="drone_turn"><field name="DIR">LEFT</field><value name="DEGREE"><shadow type="math_number"><field name="NUM">90</field></shadow></value></block></xml>');
    assert.equal(result[0].type, 'turn_left');
    assert.equal(result[0].param, 90);
});

test('invalid or unknown imported blocks leave the existing program intact', () => {
    const io = require('../js/blockly_workspace_io.js');
    const workspace = new Blockly.Workspace();
    try {
        io.replace(Blockly, workspace, '<xml><block type="drone_takeoff" id="student-work"/></xml>');
        assert.throws(() => io.replace(Blockly, workspace, '<xml><block type="missing_block"/></xml>'));
        assert.equal(workspace.getAllBlocks(false).length, 1);
        assert.equal(workspace.getBlockById('student-work').type, 'drone_takeoff');
        assert.throws(() => io.replace(Blockly, workspace, '<not-workspace/>'));
        assert.ok(workspace.getBlockById('student-work'));
    } finally { workspace.dispose(); }
});
