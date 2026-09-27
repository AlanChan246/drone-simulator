const fs = require('node:fs');
let id = 0;
const esc = x => String(x).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const value = (name, xml) => `<value name="${name}">${xml}</value>`;
const field = (name, v) => `<field name="${name}">${esc(v)}</field>`;
const num = v => `<shadow type="math_number">${field('NUM', v)}</shadow>`;
const text = v => `<shadow type="text">${field('TEXT', v)}</shadow>`;
const b = (type, content = '') => ({ type, content });
function chain(blocks) { return blocks.length ? `<block type="${blocks[0].type}" id="factory-fixture-${++id}">${blocks[0].content}${blocks.length > 1 ? `<next>${chain(blocks.slice(1))}</next>` : ''}</block>` : ''; }
const xml = blocks => `<xml xmlns="https://developers.google.com/blockly/xml">${chain(blocks)}</xml>`;
const move = (dir, distance) => b('drone_move_cm', field('DIR', dir) + value('DIST', num(distance)));
const waitFor = type => b('factory_wait_until', value('BOOL', chain([b(type)])));
const faultyRoute = () => [move('FORWARD', 1050), move('LEFT', 1200), b('factory_drop'), b('factory_start_repair'), waitFor('factory_repair_ready'), b('factory_pickup'), move('RIGHT', 2400)];
const normalRoute = () => [move('FORWARD', 1050), move('RIGHT', 1200)];
const condition = () => value('IF0', chain([b('logic_compare', field('OP', 'EQ') + value('A', chain([b('factory_cargo_status')])) + value('B', text('故障')))]));
const part = (hardcoded = null) => [waitFor('factory_intake_ready'), b('factory_pickup'), ...(hardcoded === null ? [b('factory_if_else', condition() + `<statement name="DO0">${chain(faultyRoute())}</statement><statement name="ELSE">${chain(normalRoute())}</statement>`)] : hardcoded ? faultyRoute() : normalRoute()), b('factory_drop'), move('LEFT', 1200), move('BACKWARD', 1050)];
const entry = () => [b('event_start'), b('drone_takeoff'), move('FORWARD', 1500), move('RIGHT', 1200), move('BACKWARD', 1050)];
function reference({ unrolled = false, hardcoded = false, procedures = false } = {}) {
    id = 0;
    const items = unrolled || hardcoded ? Array.from({ length: 6 }, (_, i) => part(hardcoded ? [false,true,false,true,true,false][i] : null)).flat()
        : [b('factory_repeat', value('TIMES', num(6)) + `<statement name="DO">${chain(procedures ? [b('procedures_callnoreturn','<mutation name="處理一件零件"/>')] : part())}</statement>`)];
    let result = xml([...entry(), ...items, move('FORWARD', 1950), b('drone_land')]);
    if (procedures) result = result.replace('</xml>', chain([b('procedures_defnoreturn', field('NAME','處理一件零件') + `<statement name="STACK">${chain(part())}</statement>`)]) + '</xml>');
    return result;
}
module.exports = { reference, xml, b, move, waitFor, value, field, num, text, chain, entry };
if (require.main === module) {
    fs.mkdirSync('test/fixtures', { recursive: true });
    fs.writeFileSync('test/fixtures/factory-reference.xml', reference());
    fs.writeFileSync('test/fixtures/factory-functions.xml', reference({ procedures: true }));
}
