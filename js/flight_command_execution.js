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

    async function runQueue(commands, collaborators) {
        const {
            shouldStop,
            beforeCommand,
            executeCommand,
            afterCommand,
            onComplete
        } = collaborators;

        let completed = 0;
        for (let index = 0; index < commands.length; index++) {
            if (shouldStop()) break;
            const command = commands[index];
            const context = { index, total: commands.length, command };
            const shouldExecute = beforeCommand ? await beforeCommand(context) : true;
            if (shouldStop()) break;
            if (shouldExecute !== false) {
                await executeCommand(command, context);
                completed++;
            }
            if (afterCommand) await afterCommand(context);
        }
        const result = { completed, total: commands.length, stopped: shouldStop() };
        if (onComplete) await onComplete(result);
        return result;
    }

    return Object.freeze({ COMMAND_BLOCK_TYPES, isCommandBlockType, runQueue });
});
