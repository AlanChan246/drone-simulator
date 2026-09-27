(function (root, factory) {
    const config = factory();
    if (typeof module === 'object' && module.exports) module.exports = config;
    root.FactoryConfig = config;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const ports = {
        intake: { x: 0, z: 750, y: 0, label: '取件台' },
        repair: { x: -1200, z: -300, y: 0, label: '維修站' },
        assembly: { x: 1200, z: -300, y: 0, label: '裝配站' },
        goal: { x: 0, z: -1200, y: 0, label: '出貨平台' }
    };
    Object.values(ports).forEach(Object.freeze);
    return Object.freeze({
        id: 'factory', title: '失控機械工廠', storageKey: 'mission-3-factory',
        size: 3000, cellSize: 150, flightLimit: 500, droneRadius: 18,
        spawn: Object.freeze({ x: -1200, y: 14, z: 1200, heading: 0 }),
        ports: Object.freeze(ports), radius: 100, minAltitude: 50, maxAltitude: 180,
        initialOrder: Object.freeze(['正常', '故障', '正常', '故障', '故障', '正常']),
        repairTimes: Object.freeze([6, 9, 12]), feedSeconds: 3,
        overviewRadius: 5100, waitLimit: 60,
        preview: 'assets/images/mission-preview-factory.png'
    });
});
