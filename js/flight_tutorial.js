(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.FlightTutorial = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const steps = Object.freeze([
        { type: 'event_start', title: '先放入開始事件', text: '從「事件」加入「當按下執行」，作為飛行程式的起點。', condition: '加入「當按下執行」' },
        { type: 'drone_takeoff', title: '讓無人機起飛', text: '把「起飛」接在「當按下執行」下方。', condition: '「起飛」已連接到開始事件' },
        { type: 'drone_move_cm', title: '向前飛行 50 cm', text: '接上「向前飛行」，先把距離設為 50 cm。', condition: '向前飛行 50 cm，並接在起飛下方' },
        { type: 'drone_land', title: '最後安全降落', text: '在程式最底部接上「降落」，讓無人機安全回到地面。', condition: '「降落」位於完整程式的最後' },
        { title: '執行並觀察', text: '按下方「執行」，對照高亮積木、目前指令與無人機動作。', condition: '完成起飛、移動及安全降落' },
        { title: '返回修改程式', text: '按「返回修改程式」。積木會保留，再試試把距離改成 100 cm。', condition: '返回編程，找到距離設定' }
    ]);
    function chain(workspace) {
        const roots = workspace.getTopBlocks(false);
        const root = roots.find(block => block.type === 'event_start');
        const blocks = [];
        for (let block = root; block; block = block.getNextBlock()) blocks.push(block);
        return { roots, blocks };
    }
    function inspect(workspace, step) {
        if (!workspace) return { complete: false, message: '積木區正在準備，請稍後再試。' };
        const { roots, blocks } = chain(workspace);
        for (let i = 0; i <= Math.min(step, 3); i++) {
            const block = blocks[i];
            if (!block) return { complete: false, message: '加入本步積木，並接到程式下方。' };
            if (block.type !== steps[i].type || !block.isEnabled()) return { complete: false, message: `第 ${i + 1} 塊的次序或啟用狀態不正確，請依教學調整。` };
        }
        if (step >= 2) {
            const move = blocks[2], distance = move.getInputTargetBlock('DIST');
            if (move.getFieldValue('DIR') !== 'FORWARD' || !distance?.isEnabled() || Number(distance.getFieldValue('NUM')) !== 50) {
                return { complete: false, message: '第一次飛行請先選「前」，距離設為 50 cm。完成後就可以修改。' };
            }
        }
        if (step >= 3 && (blocks.length !== 4 || roots.length !== 1)) {
            return { complete: false, message: '請只保留這段四塊積木的程式；把多餘積木移除，或先匯出備份。' };
        }
        return { complete: true, message: '已連接正確，可以前往下一步。' };
    }
    function addStep(Blockly, workspace, step) {
        if (!steps[step]?.type) return { complete: false, message: '程式已組裝好，請依教學執行或返回修改。' };
        if (inspect(workspace, step).complete) return { complete: true, message: '這一步已完成。' };
        if (step > 0) {
            const previous = inspect(workspace, step - 1);
            if (!previous.complete) return previous;
        }
        const { roots, blocks } = chain(workspace);
        const predecessor = blocks[step - 1];
        if (predecessor?.getNextBlock() && predecessor.getNextBlock().type !== steps[step].type) {
            return { complete: false, message: '連接位置已有其他積木。請先調整次序；教學不會取代你的程式。' };
        }
        let block = blocks[step]?.type === steps[step].type ? blocks[step] : roots.find(item => item.type === steps[step].type);
        if (step === 2 && block?.getInputTargetBlock('DIST') && block.getInputTargetBlock('DIST').type !== 'math_number') {
            return { complete: false, message: '請先把距離換成數字積木；教學不會取代你寫的運算。' };
        }
        if (step === 2 && block && (block.getFieldValue('DIR') !== 'FORWARD'
            || block.getInputTargetBlock('DIST') && Number(block.getInputTargetBlock('DIST').getFieldValue('NUM')) !== 50)) {
            return { complete: false, message: '已保留你設定的方向和距離。第一次飛行請自行選「前」並設為 50 cm，再繼續教學。' };
        }
        Blockly.Events.setGroup(true);
        try {
            if (!block) {
                block = workspace.newBlock(steps[step].type);
                block.initSvg?.();
                if (step === 0) block.moveBy(24, 24);
            }
            if (step === 2) {
                let distance = block.getInputTargetBlock('DIST');
                if (!distance) {
                    distance = workspace.newBlock('math_number');
                    distance.setShadow(true);
                    distance.setFieldValue(50, 'NUM');
                    distance.initSvg?.();
                    block.getInput('DIST').connection.connect(distance.outputConnection);
                }
                distance.render?.();
            }
            if (predecessor && predecessor.getNextBlock() !== block) predecessor.nextConnection.connect(block.previousConnection);
            block.render?.();
        } finally { Blockly.Events.setGroup(false); }
        return { ...inspect(workspace, step), block };
    }
    function distanceBlock(workspace) {
        return workspace && chain(workspace).blocks.find(block => block.type === 'drone_move_cm' && block.getFieldValue('DIR') === 'FORWARD');
    }
    return Object.freeze({ steps, inspect, addStep, distanceBlock });
});
