(function (root, factory) {
    const exported = factory();
    if (typeof module === 'object' && module.exports) module.exports = exported;
    if (root) root.MissionRules = exported;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const MISSION_IDS = Object.freeze({ TUNNEL_RESCUE: 1, WILDFIRE_RESPONSE: 2 });

    const adapters = Object.freeze({
        tunnel: Object.freeze({
            id: MISSION_IDS.TUNNEL_RESCUE,
            name: 'Tunnel Rescue',
            requiredInspectionCheckpoints: 3,
            requiredFireSites: 0,
            pending(progress) {
                return `尚需完成 ${Math.max(0, this.requiredInspectionCheckpoints - progress.inspectionCheckpoints)} 個巡檢點並在終點降落。`;
            }
        }),
        city: Object.freeze({
            id: MISSION_IDS.WILDFIRE_RESPONSE,
            name: 'Wildfire Response',
            requiredInspectionCheckpoints: 0,
            requiredFireSites: 4,
            initialBatteryLines: 20,
            chargeStationLines: 15,
            pending(progress) {
                return `尚需撲滅 ${Math.max(0, this.requiredFireSites - progress.fireSites)} 個火點並到達終點。`;
            }
        }),
        free: Object.freeze({
            id: 0,
            name: 'Free Flight',
            requiredInspectionCheckpoints: 0,
            requiredFireSites: 0,
            pending() { return ''; }
        })
    });

    function forScene(sceneType) {
        return adapters[sceneType] || adapters.free;
    }

    return Object.freeze({ MISSION_IDS, forScene });
});
