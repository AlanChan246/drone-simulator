// Exact, reviewed additive Mission 3 integration seams. Historical byte hashes
// still protect every other byte, including legacy dispatch, physics and scoring.
module.exports=function legacySource(source){
    return source
        .replace("(currentSceneType==='storm'?Mission3.commandName(cmd):null)||",'')
        .replace("    if (activeMissionId === 3) return 'mission-3';\n",'')
        .replace("        if (currentSceneType === 'storm') return 'mission-3';\n",'')
        .replace("    if (currentSceneType === 'storm') { Mission3.execute(currentWorkspace); return; }\n",'')
        .replace("    if (window.Mission3) Mission3.sync();\n",'')
        .replace("workspace.updateToolbox(currentSceneType === 'storm' ? Mission3Blockly.toolbox() : toolboxEl);",'workspace.updateToolbox(toolboxEl);')
        .replace("    if (window.Mission3 && currentSceneType === 'storm') Mission3.reset();\n",'')
        .replace("    if (window.Mission3) Mission3.cancel();\n",'')
        .replace("    if (Number(targetMissionId) === 3) Mission3.briefing(title, content);\n    else if (window.V2UI)","    if (window.V2UI)")
        .replace("    } else if (Number(missionId) === 3) {\n        activeMissionId = 3;\n",'')
        .replace("    if (Number(missionId) === 3) {\n        try { await Mission3Scene.preload(); }\n        catch (error) {\n            returnToMissionSelect();\n            showAppMessage({variant:'warn', title:'能源島素材未能載入', body:error.message, nextStep:'檢查連線後重新選擇任務三。'});\n            return;\n        }\n    }\n",'')
        .replace("    } else if (Number(missionId) === 3) {\n        changeScene('storm');\n        Mission3.reset(true);\n",'')
        .replace(" || Number(missionId) === 3;",';')
        .replace("        if(!followDrone && currentSceneType==='storm')camRadius=3300;\n",'')
        .replace("else if(activeMissionId===2)startMission(3);",'')
        .replace(', STORM_ISLAND: 3','')
        .replace("        storm: Object.freeze({\n            id: MISSION_IDS.STORM_ISLAND,\n            name: 'Storm Island: Restore the Grid',\n            requiredInspectionCheckpoints: 0,\n            requiredFireSites: 0,\n            pending() { return '掃描並恢復所有能源站，返回基地降落。'; }\n        }),\n",'');
};
