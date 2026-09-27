/* Mission-local interpreter. No generated JavaScript or eval; expressions are read at execution time. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.FactoryRuntime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const statements = new Set(['event_start', 'drone_takeoff', 'drone_land', 'drone_move_cm', 'drone_move_time',
        'drone_turn', 'drone_turn_degree', 'drone_turn_heading', 'drone_hover', 'drone_print',
        'factory_pickup', 'factory_drop', 'factory_start_repair', 'factory_wait', 'factory_wait_until',
        'factory_repeat', 'factory_until', 'factory_if_else', 'controls_repeat_ext', 'controls_whileUntil', 'controls_if',
        'variables_set', 'math_change', 'factory_set_variable', 'factory_change_variable',
        'procedures_defnoreturn', 'procedures_callnoreturn']);
    const expressions = new Set(['math_number', 'text', 'logic_boolean', 'logic_compare', 'logic_operation', 'logic_negate',
        'math_arithmetic', 'math_modulo', 'math_round', 'variables_get', 'text_join',
        'drone_get_range', 'drone_get_height', 'factory_intake_ready', 'factory_cargo_status', 'factory_repair_ready', 'factory_delivered']);
    class ProgramError extends Error {
        constructor(message, blockId) { super(message); this.name = 'ProgramError'; this.blockId = blockId; }
    }
    const issue = (message, block) => { throw new ProgramError(message, block && block.id); };
    function snapshot(workspace) {
        const procedures = Object.create(null);
        for (const block of workspace.getAllBlocks(false)) {
            if (!block.isEnabled()) continue;
            if (!statements.has(block.type) && !expressions.has(block.type)) {
                issue(block.type === 'drone_goto_xyz' ? '工廠任務不能直接飛到座標。請使用距離與轉向積木。' : `工廠任務未支援「${block.toString(40)}」。請移除或改用工具箱內的積木。`, block);
            }
            if (block.type.startsWith('procedures_') && block.arguments_ && block.arguments_.length) issue('這個任務的函式積木暫時不接受參數。', block);
        }
        let count = 0;
        function copy(block, depth = 0) {
            if (!block) return null;
            if (depth > 200 || ++count > 2500) issue('積木結構太深或太大，請用迴圈整理相同工作。', block);
            if (!block.isEnabled()) return copy(block.getNextBlock(), depth + 1);
            const node = { id: block.id, type: block.type, fields: {}, inputs: {}, next: null };
            for (const input of block.inputList) {
                for (const field of input.fieldRow) if (field.name) node.fields[field.name] = field.getValue();
                if (input.connection) {
                    const child = input.connection.targetBlock();
                    if (!child && input.type === 1) issue('這塊積木有空白輸入，請接上數值或判斷條件。', block);
                    if (child && input.type === 1 && !expressions.has(child.type)) issue('這個輸入需要數值或判斷積木。', block);
                    node.inputs[input.name] = copy(child, depth + 1);
                }
            }
            if (block.type === 'procedures_callnoreturn') node.fields.NAME = block.getProcedureCall();
            node.next = copy(block.getNextBlock(), depth + 1);
            return node;
        }
        const starts = workspace.getTopBlocks(true).filter(b => b.isEnabled() && b.type === 'event_start');
        if (starts.length !== 1) issue('請保留一個「當按下執行」，並把要執行的積木接在下面。', starts[1]);
        for (const b of workspace.getTopBlocks(true)) {
            if (b.isEnabled() && b.type === 'procedures_defnoreturn') {
                const name = b.getFieldValue('NAME');
                if (procedures[name]) issue('函式名稱重複，請重新命名。', b);
                procedures[name] = copy(b).inputs.STACK;
            }
        }
        const program = { start: copy(starts[0]), procedures };
        function freeze(node) { if (!node || typeof node !== 'object' || Object.isFrozen(node)) return; Object.values(node).forEach(freeze); Object.freeze(node); }
        freeze(program); return program;
    }
    async function execute(program, ports) {
        const variables = new Map(), dependencies = new Map();
        let steps = 0, depth = 0;
        const check = () => { if (ports.shouldStop()) throw new ProgramError('執行已停止。', null); };
        function number(value, block) {
            const n = Number(value);
            if (!Number.isFinite(n)) issue('這裡需要有效數字，請檢查輸入及運算。', block);
            return n;
        }
        function value(n, reads = new Set()) {
            if (!n) issue('缺少輸入積木。');
            const read = key => value(n.inputs[key], reads), f = n.fields;
            switch (n.type) {
                case 'math_number': return number(f.NUM, n);
                case 'text': return f.TEXT || '';
                case 'logic_boolean': return f.BOOL === 'TRUE';
                case 'variables_get': (dependencies.get(f.VAR) || []).forEach(x => reads.add(x)); return variables.has(f.VAR) ? variables.get(f.VAR) : 0;
                case 'factory_cargo_status': case 'factory_delivered': case 'factory_intake_ready': case 'factory_repair_ready':
                    reads.add(n.type); return ports.sensor(n.type);
                case 'drone_get_range': return ports.sensor('range', f);
                case 'drone_get_height': return ports.sensor('height', f);
                case 'logic_compare': {
                    const a = read('A'), b = read('B');
                    // Scratch-style numeric comparison where both inputs are non-empty numeric values.
                    const numeric = String(a).trim() !== '' && String(b).trim() !== '' && Number.isFinite(Number(a)) && Number.isFinite(Number(b));
                    const x = numeric ? Number(a) : String(a).toLowerCase(), y = numeric ? Number(b) : String(b).toLowerCase();
                    return ({ EQ: () => x === y, NEQ: () => x !== y, LT: () => x < y, LTE: () => x <= y, GT: () => x > y, GTE: () => x >= y })[f.OP]();
                }
                case 'logic_operation': return f.OP === 'AND' ? Boolean(read('A')) && Boolean(read('B')) : Boolean(read('A')) || Boolean(read('B'));
                case 'logic_negate': return !read('BOOL');
                case 'math_arithmetic': {
                    const a = number(read('A'), n), b = number(read('B'), n);
                    return number(({ ADD: () => a + b, MINUS: () => a - b, MULTIPLY: () => a * b, DIVIDE: () => a / b, POWER: () => a ** b })[f.OP](), n);
                }
                case 'math_modulo': { const d = number(read('DIVISOR'), n); return number(((number(read('DIVIDEND'), n) % d) + d) % d, n); }
                case 'math_round': return ({ ROUND: Math.round, ROUNDUP: Math.ceil, ROUNDDOWN: Math.floor })[f.OP](number(read('NUM'), n));
                case 'text_join': return Object.keys(n.inputs).filter(k => k.startsWith('ADD')).map(k => String(read(k))).join('');
                default: issue('這塊積木不能用作數值或條件。', n);
            }
        }
        async function before(n) {
            check(); if (++steps > 10000) issue('執行步數過多。請檢查迴圈是否會結束。', n);
            await ports.beforeBlock(n, steps); check();
            if (steps % 40 === 0) { await ports.sleep(0.01); check(); }
        }
        async function loop(n, condition, body) {
            let i = 0;
            while (condition(i)) {
                if (i >= 1000) issue('迴圈重複太多次。請檢查結束條件。', n);
                const deliveredBefore = ports.delivered();
                await chain(body);
                ports.onLoop(n.id, i++, ports.delivered() - deliveredBefore);
                await before(n);
            }
        }
        async function chain(first) {
            for (let n = first; n; n = n.next) {
                await before(n);
                const f = n.fields, input = key => value(n.inputs[key]);
                try {
                    switch (n.type) {
                        case 'event_start': break;
                        case 'factory_repeat': case 'controls_repeat_ext': {
                            const times = Math.max(0, Math.round(number(input('TIMES'), n)));
                            if (times > 1000) issue('重複次數太多，請使用 0–1000 之間的數值。', n);
                            await loop(n, i => i < times, n.inputs.DO); break;
                        }
                        case 'factory_until': case 'controls_whileUntil': {
                            const until = n.type === 'factory_until' || f.MODE === 'UNTIL';
                            await loop(n, () => until ? !input('BOOL') : Boolean(input('BOOL')), n.inputs.DO); break;
                        }
                        case 'factory_if_else': case 'controls_if': {
                            let branch = n.inputs.ELSE;
                            for (let i = 0; n.inputs['IF' + i]; i++) {
                                const reads = new Set(), result = Boolean(value(n.inputs['IF' + i], reads));
                                ports.onBranch(n.id, result, [...reads]);
                                if (result) { branch = n.inputs['DO' + i]; break; }
                            }
                            await chain(branch); break;
                        }
                        case 'factory_wait_until': {
                            let waited = 0; const began = ports.simulatedTime ? ports.simulatedTime() : 0;
                            while (!input('BOOL')) {
                                if (ports.simulatedTime) waited = ports.simulatedTime() - began;
                                if (waited >= 60) issue('等待條件超過 60 個模擬秒仍未成立。檢查是否已放入零件並啟動維修。', n);
                                await ports.sleep(0.1); waited += 0.1; check();
                            }
                            break;
                        }
                        case 'factory_wait': case 'drone_hover': {
                            const seconds = number(input('DURATION'), n);
                            if (seconds < 0 || seconds > 600) issue('等待時間請使用 0–600 秒。', n);
                            await ports.sleep(seconds); break;
                        }
                        case 'variables_set': case 'factory_set_variable': {
                            const reads = new Set(); variables.set(f.VAR, value(n.inputs.VALUE, reads)); dependencies.set(f.VAR, reads); break;
                        }
                        case 'math_change': case 'factory_change_variable': {
                            const reads = new Set(dependencies.get(f.VAR) || []), delta = value(n.inputs.DELTA, reads);
                            variables.set(f.VAR, number(variables.get(f.VAR) || 0, n) + number(delta, n)); dependencies.set(f.VAR, reads); break;
                        }
                        case 'procedures_callnoreturn': {
                            if (!(f.NAME in program.procedures)) issue('找不到這個函式的定義。', n);
                            if (++depth > 16) issue('函式呼叫太深。檢查是否不停呼叫自己。', n);
                            await chain(program.procedures[f.NAME]); depth--; break;
                        }
                        case 'drone_print': await ports.action(n.type, { TEXT: input('TEXT') }, n.id); break;
                        default: {
                            const args = { ...f };
                            for (const key of Object.keys(n.inputs)) args[key] = input(key);
                            await ports.action(n.type, args, n.id);
                        }
                    }
                    check();
                } catch (error) { if (!error.blockId) error.blockId = n.id; throw error; }
            }
        }
        await chain(program.start);
        return { steps, variables: Object.fromEntries(variables) };
    }
    return Object.freeze({ snapshot, execute, ProgramError });
});
