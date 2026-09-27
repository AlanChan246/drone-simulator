(function (root, factory) {
    const exported = factory();
    if (typeof module === 'object' && module.exports) module.exports = exported;
    if (root) root.FlightCommandExecution = exported;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const COMMAND_BLOCK_TYPES = Object.freeze([
        'event_wait_key', 'drone_takeoff', 'drone_land', 'drone_hover',
        'drone_move_time', 'drone_move_cm', 'drone_goto_xyz', 'drone_turn_degree',
        'drone_collect_water', 'drone_release_water', 'drone_turn_time',
        'drone_set_variable', 'drone_turn_heading', 'drone_move_complex',
        'drone_move_complex_infinite', 'drone_set_color', 'drone_set_led_color',
        'drone_set_led_rgb', 'drone_led_off', 'drone_led_sequence',
        'drone_set_heading', 'console_print', 'drone_print', 'drone_turn'
    ]);

    function isCommandBlockType(type) {
        return COMMAND_BLOCK_TYPES.includes(type);
    }

    class CancelledError extends Error {
        constructor() { super('執行已停止。'); this.name = 'CancelledError'; }
    }

    function createSession() {
        let revision = 0;
        function capture() {
            const ticket = revision;
            const isCurrent = () => ticket === revision;
            const check = () => { if (!isCurrent()) throw new CancelledError(); };
            return Object.freeze({ isCurrent, check,
                async wait(promise) { const result = await promise; check(); return result; },
                finish(callback) { if (isCurrent()) callback(); }
            });
        }
        return Object.freeze({ begin() { revision++; return capture(); }, cancel() { revision++; }, capture });
    }

    async function runQueue(commands, collaborators) {
        const { shouldStop, beforeCommand, executeCommand, afterCommand, onComplete } = collaborators;
        let completed = 0, failure;
        try {
            for (let index = 0; index < commands.length; index++) {
                if (shouldStop()) break;
                const command = commands[index];
                const context = { index, total: commands.length, command };
                const shouldExecute = beforeCommand ? await beforeCommand(context) : true;
                if (shouldStop()) break;
                if (shouldExecute !== false) { await executeCommand(command, context); completed++; }
                if (shouldStop()) break;
                if (afterCommand) await afterCommand(context);
            }
        } catch (error) {
            if (!(error instanceof CancelledError)) failure = error;
        }
        const result = { completed, total: commands.length, stopped: shouldStop() };
        if (failure) result.error = failure;
        if (onComplete) await onComplete(result);
        if (failure) throw failure;
        return result;
    }

    return Object.freeze({ COMMAND_BLOCK_TYPES, isCommandBlockType, createSession, CancelledError, runQueue });
});
