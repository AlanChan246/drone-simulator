/**
 * 驗證挑戰關換局清理邏輯（markChallengeMazePiece / clearChallengeMazeGeometry 演算法）
 */
function markChallengeMazePiece(obj) {
    if (obj) obj.userData = Object.assign({}, obj.userData, { isChallengeMazePiece: true });
    return obj;
}

function mockChild(flags) {
    return {
        userData: flags.userData || {},
        isWall: !!flags.isWall,
        isExit: !!flags.isExit,
        isStart: !!flags.isStart,
        id: flags.id
    };
}

function clearChallengeMazeGeometry(environmentGroup, state) {
    state.mazeAnimations = [];
    state.roadRegistrySize = 0;
    const toRemove = [];
    environmentGroup.children.forEach(child => {
        if (child.userData && child.userData.isChallengeMazePiece) toRemove.push(child);
        else if (child.isWall || child.isExit || child.isStart) toRemove.push(child);
    });
    toRemove.forEach(obj => {
        const idx = environmentGroup.children.indexOf(obj);
        if (idx >= 0) environmentGroup.children.splice(idx, 1);
    });
    return toRemove.length;
}

function simulateCycle(environmentGroup, state, cycleId) {
    const before = environmentGroup.children.length;
    for (let n = 0; n < 8; n++) {
        environmentGroup.children.push(markChallengeMazePiece(mockChild({ id: `b${cycleId}-${n}`, isWall: true })));
    }
    for (let n = 0; n < 2; n++) {
        environmentGroup.children.push(markChallengeMazePiece(mockChild({ id: `road${cycleId}-${n}`, userData: { isKenneyRoad: true } })));
    }
    environmentGroup.children.push(markChallengeMazePiece(mockChild({ id: `arrow${cycleId}`, userData: { waypointKind: 'alpha' } })));
    state.mazeAnimations.push(() => {}, () => {});
    state.roadRegistrySize += 5;

    const afterAdd = environmentGroup.children.length;
    const removed = clearChallengeMazeGeometry(environmentGroup, state);
    const afterClear = environmentGroup.children.length;

    const taggedLeft = environmentGroup.children.filter(c => c.userData.isChallengeMazePiece).length;
    const errors = [];
    if (afterClear !== before) errors.push(`cycle ${cycleId}: expected ${before} persistent, got ${afterClear}`);
    if (taggedLeft !== 0) errors.push(`cycle ${cycleId}: ${taggedLeft} challenge pieces leaked`);
    if (state.mazeAnimations.length !== 0) errors.push(`cycle ${cycleId}: mazeAnimations not cleared`);
    if (removed !== 11) errors.push(`cycle ${cycleId}: expected remove 11, removed ${removed}`);

    return { cycleId, before, afterAdd, afterClear, removed, errors };
}

const environmentGroup = {
    children: [
        mockChild({ id: 'holodeck' }),
        mockChild({ id: 'grid' })
    ]
};
const state = { mazeAnimations: [], roadRegistrySize: 0 };

const allErrors = [];
for (let r = 1; r <= 5; r++) {
    const result = simulateCycle(environmentGroup, state, r);
    console.log(`Run ${r}: persistent=${result.before} → add=${result.afterAdd} → clear=${result.afterClear} (removed ${result.removed})`);
    allErrors.push(...result.errors);
}

if (allErrors.length) {
    console.error('FAILED:', allErrors);
    process.exit(1);
}
console.log('OK: 5/5 cycles — no leaked challenge pieces, animations reset, holodeck+grid preserved');
