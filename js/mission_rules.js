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
                return `請沿道路抵達疏散區並降落。巡檢已完成 ${progress.inspectionCheckpoints}/3，可選擇繼續巡檢加分。`;
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
                return `請在受災區降落結算。已撲滅 ${progress.fireSites}/4 個火點，可繼續滅火爭取更高分數。`;
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
