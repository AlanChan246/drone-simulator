/* THESIS: a daylight research city whose physical gates respond to code.
 * Existing Flight Deck visual language remains authoritative. All structural
 * visible meshes are local Kenney CC0 assets. Canvas sprites/lines are signage
 * and atmosphere, not substitute architecture. */
window.SkyCity = (()=>{
    const files={space:['platform_large','platform_low','gate_complex','structure_detailed','structure_closed','hangar_roundGlass','machine_generatorLarge','machine_wireless','satelliteDish','satelliteDish_large','pipe_straight'],station:['door-double-closed','computer-wide','table-display']};
    let templates=null,pending=null;
    async function preload(){
        if(templates)return;if(pending)return pending;
        pending=(async()=>{const loaded={};const loader=new THREE.GLTFLoader();await Promise.all(Object.entries(files).flatMap(([pack,names])=>names.map(name=>new Promise((resolve,reject)=>loader.load(`assets/models/kenney/sky-city/${pack}/${name}.glb`,g=>{loaded[name]=g.scene;resolve();},undefined,reject)))));templates=loaded;})().catch(e=>{pending=null;throw e;});return pending;
    }
    function build(scene,parent,renderer){
        if(!templates)throw new Error('Sky City models have not loaded');
        const group=new THREE.Group();group.name='Sky Gate Protocol';parent.add(group);
        const saved={background:scene.background,fog:scene.fog,shadow:renderer.shadowMap.enabled,exposure:renderer.toneMappingExposure};
        const lights=[];scene.traverse(o=>{if(o.isLight){lights.push([o,o.intensity]);o.intensity*=.3;}});
        scene.background=new THREE.Color('#b5dbe9');scene.fog=new THREE.Fog('#c7e4ec',2300,5500);renderer.shadowMap.enabled=false;renderer.toneMappingExposure=1.12;
        group.add(new THREE.HemisphereLight(0xf1fbff,0x678ca0,1.1));const sun=new THREE.DirectionalLight(0xfff3dd,1.5);sun.position.set(-800,1400,700);group.add(sun);
        const obstacles=[],gates=[],antennas=[],energized=[];
        function model(name,x,y,z,w,h,d,rotation=0,solid=false){
            const asset=templates[name].clone(true),b=new THREE.Box3().setFromObject(asset),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());
            asset.position.set(-c.x,-b.min.y,-c.z);
            const normalized=new THREE.Group();normalized.add(asset);normalized.scale.set(w/s.x,h/s.y,d/s.z);
            const placed=new THREE.Group();placed.add(normalized);placed.position.set(x,y,z);placed.rotation.y=rotation;group.add(placed);placed.userData.staticAsset=true;
            asset.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
            if(solid)obstacles.push(new THREE.Box3().setFromObject(placed));return placed;
        }
        function panel(width,height,draw){
            const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');draw(ctx,width,height);
            const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;
            const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true}));sprite.userData={canvas,ctx,texture};return sprite;
        }
        function label(text,x,y,z,w=180){const sprite=panel(600,120,(c,W,H)=>{c.fillStyle='#164d48';c.fillRect(0,0,W,H);c.fillStyle='#fffef9';c.font='bold 48px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,W/2,H/2);});sprite.scale.set(w,w/5,1);sprite.position.set(x,y,z);group.add(sprite);return sprite;}
        function pad(x,y,z,labelText){
            const sprite=panel(256,256,(c)=>{c.strokeStyle='#137a89';c.lineWidth=10;c.strokeRect(10,10,236,236);c.beginPath();c.arc(128,128,88,0,Math.PI*2);c.stroke();c.fillStyle='#164d48';c.font='bold 74px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(labelText,128,130);});
            const mesh=new THREE.Mesh(new THREE.PlaneGeometry(155,155),new THREE.MeshBasicMaterial({map:sprite.material.map,transparent:true,depthWrite:false,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y+2,z);group.add(mesh);sprite.material.dispose();
        }
        for(const p of SkyGateConfig.platforms){model('platform_large',p.x,p.y-20,p.z,p.w,20,p.d);model('platform_low',p.x,p.y-110,p.z,p.w*.75,85,p.d*.72);}
        // Open, offset landmarks keep the flight corridor and camera sight lines clear.
        model('hangar_roundGlass',-650,0,160,205,130,160,Math.PI/2,true);
        model('machine_generatorLarge',-330,80,185,105,95,70,0,true);
        model('computer-wide',-160,80,180,95,60,40,0,true);
        model('hangar_roundGlass',240,160,-235,220,130,155,0,true);
        model('structure_closed',265,160,-705,155,210,155,0,true);
        model('structure_closed',265,370,-705,110,160,110,0,true);
        energized.push(model('hangar_roundGlass',265,530,-705,190,80,140));
        antennas.push(model('satelliteDish_large',265,610,-705,125,100,125));
        model('table-display',-110,160,-700,90,65,80,0,true);
        for(const p of [{x:-610,z:475,y:0},{x:175,z:170,y:80},{x:-95,z:-520,y:160}])antennas.push(model('machine_wireless',p.x,p.y,p.z,65,125,65));
        // Reused conduits are authored asset meshes, not primitive bars.
        [[-590,15,250,200],[165,95,30,220],[-75,175,-410,260]].forEach(([x,y,z,d])=>energized.push(model('pipe_straight',x,y,z,18,18,d)));
        pad(-450,0,450,'H');pad(50,160,-650,'ON');
        label('出發 · 面向閘門 1',-450,55,540,230);label('核心平台 · 降落後啟動',50,210,-765,270);
        SkyGateConfig.gates.forEach(g=>{
            const yaw=g.nx?Math.PI/2:0;
            model('gate_complex',g.x,g.base-25,g.z,310,270,70,yaw);
            const shutter=model('door-double-closed',g.x,g.base+25,g.z,190,180,18,yaw);
            const display=panel(640,190,()=>{});display.scale.set(220,65,1);display.position.set(g.x,g.base+305,g.z);group.add(display);
            const zone=label(`感測區 · 高度 ${g.base+94}`,g.x-g.nx*120,g.base+20,g.z-g.nz*120,170);
            gates.push({shutter,display,zone,key:''});
        });
        // Distant research outposts establish height without enlarging the playable world.
        [[-1150,-700,0],[850,100,-100],[750,-1450,80],[-1050,900,-160]].forEach(([x,z,y],i)=>{model('platform_large',x,y-30,z,260,30,230);model('structure_detailed',x,y,z,110,130,100);model('satelliteDish',x,y+130,z,80,70,75,i);});
        const cloudTexture=panel(256,256,c=>{const gradient=c.createRadialGradient(128,128,10,128,128,125);gradient.addColorStop(0,'rgba(255,255,255,.9)');gradient.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=gradient;c.fillRect(0,0,256,256);}).material.map;
        const cloudMaterial=new THREE.SpriteMaterial({map:cloudTexture,transparent:true,opacity:.65,depthWrite:false});
        for(let i=0;i<26;i++){const cloud=new THREE.Sprite(cloudMaterial);cloud.position.set(Math.sin(i*2.4)*1700,-250-(i%4)*70,Math.cos(i*2.4)*1750-300);cloud.scale.set(700+(i%3)*200,190,1);group.add(cloud);}
        [...antennas,...energized,...gates.map(g=>g.shutter)].forEach(o=>o.userData.staticAsset=false);
        group.updateMatrixWorld(true);
        const batches=new Map();
        for(const object of [...group.children])if(object.userData.staticAsset){
            object.traverse(mesh=>{if(!mesh.isMesh)return;const m=mesh.material;
                const geometry=(mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);
                const key=[m.type,m.color?.getHex(),m.map?.uuid,m.roughness,m.metalness,m.transparent,m.opacity,Object.keys(geometry.attributes).sort().join(',')].join('|');
                if(!batches.has(key))batches.set(key,{material:m,geometries:[]});batches.get(key).geometries.push(geometry);
            });group.remove(object);
        }
        for(const {material,geometries} of batches.values()){
            const merged=THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);group.add(new THREE.Mesh(merged,material));geometries.forEach(g=>g.dispose());
        }
        let awake=false;
        function update(snapshot,dt,reduced){
            snapshot.gates.forEach((g,i)=>{
                const view=gates[i];const aperture=g.status==='completed'||g.status==='open'?1:g.progress;view.shutter.position.y=g.base+25+aperture*180;view.shutter.scale.y=Math.max(.025,1-aperture);view.display.visible=!(followDrone&&g.status==='completed');
                const status={locked:'待通訊',accepted:'訊號接收 · 開啟中',open:'已開啟 · 可通過',completed:'已通過'}[g.status];
                const key=g.signal+status+g.read;if(key!==view.key){view.key=key;const {ctx:c,texture}=view.display.userData;c.clearRect(0,0,640,190);c.fillStyle=g.status==='completed'?'#1d6650':'#173e50';c.fillRect(0,0,640,190);c.fillStyle='#fffef9';c.textAlign='center';c.font='bold 66px sans-serif';c.fillText(`${g.id}   ${g.signal} ${ {A:'●',B:'▲',C:'■'}[g.signal]}`,320,77);c.font='36px sans-serif';c.fillText(status,320,147);texture.needsUpdate=true;}
            });
            if(snapshot.activated&&!awake){awake=true;for(const object of energized)object.traverse(o=>{if(o.isMesh){o.userData.skyIdleMaterial=o.material;o.material=o.material.clone();o.material.color.set('#53c9cc');if(o.material.emissive)o.material.emissive.set('#286c70');}});}
            if(!snapshot.activated&&awake){awake=false;for(const object of energized)object.traverse(o=>{if(o.isMesh){if(o.userData.skyIdleMaterial){o.material.dispose();o.material=o.userData.skyIdleMaterial;delete o.userData.skyIdleMaterial;}}});}
            if(awake&&!reduced)antennas.forEach((a,i)=>a.rotation.y+=dt*.00018*(i%2?-1:1));
        }
        function dispose(){scene.background=saved.background;scene.fog=saved.fog;renderer.shadowMap.enabled=saved.shadow;renderer.toneMappingExposure=saved.exposure;lights.forEach(([o,v])=>o.intensity=v);}
        return {update,dispose,obstacles,group};
    }
    return {preload,build,files};
})();
