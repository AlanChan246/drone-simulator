const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), acorn = require('acorn');
const lifecycle = require('../js/scene_lifecycle.js'), catalog = require('../js/asset_catalog.js');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/simulator.js'), 'utf8');
const nodes = acorn.parse(source, { ecmaVersion: 'latest' }).body;
const code = name => { const n = nodes.find(n => (n.id?.name || n.declarations?.map(d=>d.id.name).join(',')) === name); assert.ok(n,name); return source.slice(n.start,n.end); };

test('scene transitions preload before disposal; failed loads preserve the current scene', async () => {
    const events = [];
    const registry = lifecycle.createRegistry({
        tunnel: {missionId:1, build(){events.push('tunnel');},dispose(){events.push('dispose');}},
        factory: {missionId:3, async preload(){throw Error('missing model');},build(){events.push('factory');}}
    }, {clear(){events.push('clear');}});
    registry.enterSync('tunnel');
    await assert.rejects(registry.enter('factory'), /missing model/);
    assert.equal(registry.active,'tunnel');assert.deepEqual(events,['clear','tunnel']);
    assert.throws(()=>registry.enterSync('unknown'),/Unknown/);assert.equal(registry.active,'tunnel');
});
test('superseded preload never replaces a newer scene; failed builds release partial resources', async () => {
    let release;const events=[];
    const registry=lifecycle.createRegistry({
        slow:{preload:()=>new Promise(r=>release=r),build:()=>events.push('slow')},
        free:{build:()=>events.push('free'),dispose:()=>events.push('leave-free')},
        bad:{build(){throw Error('build');},dispose:()=>events.push('dispose-bad')}
    },{clear:()=>events.push('clear')});
    const pending=registry.enter('slow');registry.enterSync('free');release();assert.equal(await pending,false);
    assert.equal(registry.active,'free');assert.ok(!events.includes('slow'));
    assert.throws(()=>registry.enterSync('bad'),/build/);assert.equal(registry.active,null);
    assert.deepEqual(events,['clear','free','leave-free','clear','dispose-bad','clear']);
});
test('actual scene adapters route all missions, restore outgoing resources and preload factory', async () => {
    const events=[];const context=vm.createContext({SceneLifecycle:lifecycle,environmentGroup:{userData:{}},
        restoreDefaultSceneLighting(){events.push('lighting');},createMazeMap(){events.push('tunnel');context.environmentGroup.userData.disposeMission1Quality=()=>events.push('leave-tunnel');},
        buildMission2V2Scene(){events.push('city');context.environmentGroup.userData.disposeMission2V2=()=>events.push('leave-city');},
        createFreeFlightMap(){events.push('free');},FactoryScene:{preload:async()=>events.push('preload')},
        FactoryMission:{build(){events.push('factory');context.environmentGroup.userData.disposeFactory=()=>events.push('leave-factory');}},
        clearSceneContents(){events.push('clear');},syncDroneToStart(){events.push('spawn');}
    });
    vm.runInContext(code('disposeSceneHook')+'\n'+code('simulatorSceneAdapters')+'\nthis.registry=simulatorSceneAdapters;',context);
    const r=context.registry;assert.equal(r.forMission('training'),'tunnel');assert.equal(r.forMission('2'),'city');assert.equal(r.forMission(3),'factory');
    r.enterSync('tunnel');await r.enter('factory');r.enterSync('city');r.enterSync('free');
    assert.ok(events.indexOf('preload')<events.indexOf('leave-tunnel'));assert.ok(events.indexOf('leave-factory')<events.indexOf('city'));assert.ok(events.indexOf('leave-city')<events.lastIndexOf('free'));
    assert.equal(context.currentSceneType,'free');assert.deepEqual(Object.keys(context.environmentGroup.userData),[]);
});
test('actual preload and district/road loaders use catalog paths, preserve roles and required model destinations', async()=>{
    const loaded=[];
    class Loader {setPath(dir){this.dir=dir;}load(name,ok){loaded.push((this.dir||'')+name);ok({scene:{userData:{},traverse(){}}});}}
    const c=vm.createContext({AssetCatalog:catalog,window:{},THREE:{GLTFLoader:Loader},assets:{kenneyForest:{}},console:{log(){},warn(){},error(){}},getKenneyColormapTexture(){},prepareKenneyDistrictModel(){},prepareKenneyRoadModel(){},prepareKenneyPlotModel(){}});
    for(const n of ['KENNEY_DISTRICT_MANIFEST','KENNEY_ROADS_DIR','preloadModels','loadKenneyDistrictTemplates','loadKenneyRoadTemplates'])vm.runInContext(code(n),c);
    await c.preloadModels();
    const expected=[...catalog.preload.map(e=>e.path),...catalog.district.map(e=>e.dir+e.name),...Object.values(catalog.roads.files).map(n=>catalog.roads.dir+n),catalog.roads.dir+catalog.roads.plot];
    assert.deepEqual(loaded,expected);assert.equal(c.assets.kenneyDistrictTemplates.length,12);assert.ok(c.assets.kenneyForest.charge_machine);assert.ok(c.assets.kenneyPlotTile);
});
test('catalog dependencies exist and GLB external textures remain offline under a Pages subpath',()=>{
    const offline=require('../scripts/offline-resources.cjs').readOfflineResources(root);
    for(const file of catalog.offline){assert.ok(offline.includes(file),file);assert.ok(fs.existsSync(path.join(root,file)),file);
        if(!file.endsWith('.glb'))continue;
        const buffer=fs.readFileSync(path.join(root,file));assert.equal(buffer.readUInt32LE(0),0x46546c67,file);
        const json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString().trim());
        for(const asset of [...(json.images||[]),...(json.buffers||[])])if(asset.uri&&!asset.uri.startsWith('data:')){
            const dependent=path.posix.normalize(path.posix.join(path.posix.dirname(file),decodeURIComponent(asset.uri)));
            assert.ok(offline.includes(dependent),`${file} needs ${dependent}`);
        }
    }
    const worker={};vm.runInNewContext(fs.readFileSync(path.join(root,'js/asset_catalog.js'),'utf8'),worker);assert.equal(worker.AssetCatalog.offline.length,catalog.offline.length);
    assert.ok(Object.isFrozen(catalog.preload)&&Object.isFrozen(catalog.preload[0]));
});
