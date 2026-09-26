/* Storm Island: real CC0 model composition. Primitives are limited to water,
   gameplay markers and particles; buildings, terrain and vegetation are GLBs. */
window.Mission3Scene=(()=>{
    let templates=null,loading=null,colliders=[],relayMarkers=[],lamps=[],root=null,cloud=null;
    const extra={
        relay:'assets/models/kenney/factory/machine.glb',screen:'assets/models/kenney/factory/screen-panel-small.glb',
        tent:'assets/models/kenney/survival/tent.glb',platform:'assets/models/kenney/survival/structure-metal-floor.glb',
        road:'assets/models/kenney/starter-city/models/road-straight-lightposts.glb',junction:'assets/models/kenney/starter-city/models/road-intersection.glb',
        house:'assets/models/kenney/flood/suburban/building-type-a.glb'
    };
    async function preload(){
        if(templates)return;
        if(loading)return loading;
        loading=(async()=>{
            const response=await fetch('assets/models/mission3/manifest.json');if(!response.ok)throw new Error('能源島素材清單未能載入');
            const manifest=await response.json(),all={...extra};
            Object.entries(manifest).forEach(([key,item])=>all[key]=item.path);
            const loaded={};
            await Promise.all(Object.entries(all).map(([key,path])=>new Promise((resolve,reject)=>{
                new THREE.GLTFLoader().load(path,gltf=>{loaded[key]=gltf.scene;resolve();},undefined,()=>reject(new Error(`未能載入素材 ${path}`)));
            })));
            templates=loaded;
        })();
        try{await loading;}finally{loading=null;}
    }
    function build(){
        if(!templates)throw new Error('請先載入能源島素材');
        root=environmentGroup;colliders=[];relayMarkers=[];lamps=[];
        const previous={background:scene.background,fog:scene.fog};
        scene.background=new THREE.Color('#b8ced0');scene.fog=new THREE.Fog('#b8ced0',6000,12000);
        root.userData.disposeMission3=()=>{scene.background=previous.background;scene.fog=previous.fog;colliders=[];relayMarkers=[];lamps=[];root=null;};
        root.userData.sceneVariant='mission3';
        currentMazeGrid=null;forestHeightGrid=null;
        startPosition={...Mission3Core.BASE};spawnPosition={...startPosition};targetPosition={x:startPosition.x,z:startPosition.z};
        lastSafePos={...startPosition};
        const batches=new Map(),prepared=new Map(),textureCopies=new Map();
        function model(key,x,y,z,width,height,depth=width,angle=0,solid=false){
            if(!prepared.has(key)){
                const source=templates[key];if(!source)throw new Error(`缺少模型 ${key}`);
                source.updateMatrixWorld(true);
                const box=new THREE.Box3().setFromObject(source),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),parts=[];
                source.traverse(mesh=>{if(mesh.isMesh){
                    const mats=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(mat=>{
                        const copy=mat.clone();
                        if(copy.map){
                            const original=copy.map;
                            if(!textureCopies.has(original.uuid))textureCopies.set(original.uuid,original.clone());
                            copy.map=textureCopies.get(original.uuid);
                        }
                        return copy;
                    });
                    parts.push({geometry:mesh.geometry.clone(),material:Array.isArray(mesh.material)?mats:mats[0],matrix:mesh.matrixWorld.clone()});
                }});
                prepared.set(key,{parts,size,center,minY:box.min.y});
            }
            const item=prepared.get(key),transform=new THREE.Object3D();
            transform.position.set(x,y,z);transform.rotation.y=angle;transform.scale.set(width/item.size.x,item.size.y>0.00001?height/item.size.y:1,depth/item.size.z);transform.updateMatrix();
            const norm=new THREE.Matrix4().makeTranslation(-item.center.x,-item.minY,-item.center.z);
            item.parts.forEach((part,index)=>{
                const id=key+':'+index;if(!batches.has(id))batches.set(id,{...part,matrices:[]});
                batches.get(id).matrices.push(transform.matrix.clone().multiply(norm).multiply(part.matrix));
            });
            if(solid)colliders.push({x,z,y,width:Math.max(width,depth),depth:Math.max(width,depth),height});
        }
        function label(text,x,y,z,width=200){
            const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
            const ctx=canvas.getContext('2d');
            const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;
            const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,toneMapped:false}));
            sprite.position.set(x,y,z);sprite.scale.set(width,width*96/512,1);sprite.renderOrder=5;root.add(sprite);
            function write(value,color='#164d48'){
                ctx.clearRect(0,0,512,96);ctx.fillStyle=color;ctx.fillRect(0,0,512,96);ctx.fillStyle='#ffffff';ctx.font='600 36px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(value,256,48);texture.needsUpdate=true;
            }
            write(text);return {sprite,write};
        }
        function marker(text,x,y,z,radius=70){
            const ring=new THREE.Mesh(new THREE.RingGeometry(radius-5,radius,48),new THREE.MeshBasicMaterial({color:'#f2c56b',side:THREE.DoubleSide}));
            ring.rotation.x=-Math.PI/2;ring.position.set(x,y,z);root.add(ring);
            label(text,x,y+12,z,radius*1.3);return ring;
        }
        // Overlapping authored coastal meshes surround a continuous modelled ground surface.
        for(let x=-1000;x<=1000;x+=250)for(let z=-850;z<=900;z+=250){
            if((x/1200)**2+(z/1100)**2>1.08)continue;
            model('nature-kit/rock_largeA',x,-47,z,550,50,550,(x+z)/500);
            model('nature-kit/ground_grass',x,3,z,260,7,260);
        }
        const sea=new THREE.Mesh(new THREE.PlaneGeometry(12000,12000),new THREE.MeshBasicMaterial({color:new THREE.Color('#568b9a').convertSRGBToLinear()}));
        sea.rotation.x=-Math.PI/2;sea.position.y=-28;sea.receiveShadow=true;root.add(sea);
        // Roads connect the port, village and emergency services; interruption is visible at the town junction.
        for(let z=-600;z<=650;z+=125)model('road',-350,12,z,125,8,125);
        for(let x=-225;x<=650;x+=125)model('road',x,12,400,125,8,125,Math.PI/2);
        model('junction',-350,13,400,125,8,125);
        // Drone Base.
        model('platform',-650,10,650,230,8,230);marker('BASE',-650,20,650,85);
        model('tent',-820,13,520,175,85,130,0,true);
        model('relay',-810,13,710,55,70,55);model('screen',-765,15,600,45,48,25);
        model('car-kit/firetruck',-465,18,620,65,65,150,0,true);
        model('city-kit-industrial/solar-panel-landscape',-805,15,805,130,50,75);
        model('poly-pizza/tower',-925,13,410,75,250,75,0,true);
        label('指揮所 · DRONE BASE',-710,180,715,260);
        // Working port with warehouse roofs, container stacks, cargo vessel and flooded access.
        model('city-kit-industrial/building-a',-800,13,-590,300,135,200,0,true);
        model('city-kit-industrial/building-j',-590,13,-650,160,140,170,0,true);
        for(let i=0;i<7;i++)model('city-kit-industrial/shipping-container-a',-950+(i%3)*105,14+Math.floor(i/6)*45,-90-Math.floor(i/3)*100,95,42,55,0,true);
        model('platform',-1000,-10,-370,170,24,550);
        model('watercraft-kit/ship-cargo-a',-1270,-22,-420,180,170,540,Math.PI/2);
        model('watercraft-kit/boat-tug-a',-1130,-22,80,90,75,150,-.3);
        model('poly-pizza/crane',-960,14,-660,230,350,190,0,true);
        label('港口 · RELAY A',-725,235,-470,240);
        const flood=new THREE.Mesh(new THREE.PlaneGeometry(280,160),new THREE.MeshPhongMaterial({color:'#699eaa',transparent:true,opacity:.8}));
        flood.rotation.x=-Math.PI/2;flood.position.set(-440,22,-550);root.add(flood);
        // Town and civic shelter.
        [[-110,650],[120,620],[370,640],[-70,-70],[180,-80],[380,30]].forEach(([x,z],i)=>model(i%2?'house':'city-kit-commercial/building-a',x,13,z,130,115+i%3*25,140,i%2*Math.PI,true));
        model('city-kit-commercial/building-f',200,13,780,250,160,170,Math.PI,true);
        label('社區避難中心',200,205,780,240);
        for(let i=0;i<5;i++)model('car-kit/cone',-250+i*30,21,400,20,28,20);
        model('nature-kit/rock_largeA',-175,18,403,70,38,60,0,true);
        label('城鎮 · RELAY B',60,225,190,240);
        // Medical Centre landmark: authored building, rooftop helipad, ambulance and emergency tents.
        model('city-kit-commercial/building-c',650,13,520,245,150,220,0,true);
        marker('H · MEDICAL',650,164,520,76);
        model('car-kit/ambulance',760,18,720,60,52,125,Math.PI/2,true);
        model('tent',450,13,780,110,65,100);model('relay',850,13,440,55,65,50);
        label('醫療中心 · 備用電源',650,230,510,275);
        // Mountain ridge and narrow valley. Models, not cone mountains or primitive trees.
        [[360,-470,190],[450,-850,230],[820,-800,290],[920,-410,180],[170,-650,140]].forEach(([x,z,h],i)=>model('nature-kit/rock_largeA',x,8,z,360,h,360,i*.7,true));
        model('nature-kit/rock_largeA',600,10,-550,250,240,250);
        colliders.push({x:600,z:-550,y:10,width:185,depth:180,height:230});
        model('platform',600,240,-550,190,10,180);
        model('city-kit-industrial/windmill',920,150,-640,150,270,120);
        model('poly-pizza/tower',750,230,-700,95,210,95);
        label('山區 · RELAY C',620,425,-560,260);
        for(let i=0;i<62;i++){
            const x=70+(i*197%990),z=-900+(i*113%840);
            if(Math.hypot(x-600,z+550)<150)continue;
            model('nature-kit/tree_pineTallA_detailed',x,14,z,35+i%4*8,90+i%5*16,35+i%4*8,i*.8);
        }
        for(let i=0;i<12;i++)model('nature-kit/tree_oak',-150+(i%4)*190,13,50+Math.floor(i/4)*160,70,100,70,i);
        Mission3Core.RELAYS.forEach((r,i)=>{
            const ground=i===2?250:16;
            model('relay',r.x,ground,r.z,70,60,60);
            model('screen',r.x+40,ground,r.z,30,45,22);
            const ring=marker(r.id,r.x,ground+2,r.z,75);
            const status=label(`${r.id} · 未掃描`,r.x,r.y+70,r.z,220);
            relayMarkers.push({ring,status,last:''});
        });
        // Three status-linked light pools: power restoration changes neighbouring infrastructure.
        [[-760,-370],[190,390],[650,530]].forEach(([x,z])=>{
            const light=new THREE.Mesh(new THREE.CircleGeometry(95,24),new THREE.MeshBasicMaterial({color:'#f1c36c',transparent:true,opacity:0,depthWrite:false}));
            light.rotation.x=-Math.PI/2;light.position.set(x,23,z);root.add(light);lamps.push(light);
        });
        batches.forEach(batch=>{
            const mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.matrices.length);
            batch.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;
            mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
        });
        // Bounded rain volume; no flashes or random forces.
        const positions=new Float32Array(120*6);
        for(let i=0;i<120;i++){const x=350+(i*89%530),z=-820+(i*127%500),y=350+(i*47%320);positions.set([x,y,z,x-8,y-30,z+3],i*6);}
        const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
        const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:'#d8e8ed',transparent:true,opacity:.48}));root.add(rain);
        window.mazeAnimations.push(()=>{
            if(!root)return;
            rain.position.y=-(performance.now()/22)%60;
            rain.visible=!matchMedia('(prefers-reduced-motion: reduce)').matches;
        });
        const cloudCanvas=document.createElement('canvas');cloudCanvas.width=256;cloudCanvas.height=128;
        const cx=cloudCanvas.getContext('2d');
        [[70,68,57],[120,48,48],[173,68,62]].forEach(([x,y,r])=>{const gradient=cx.createRadialGradient(x,y,0,x,y,r);gradient.addColorStop(0,'rgba(42,62,73,.8)');gradient.addColorStop(1,'rgba(42,62,73,0)');cx.fillStyle=gradient;cx.fillRect(0,0,256,128);});
        cloud=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cloudCanvas),transparent:true,opacity:.5,depthWrite:false}));cloud.position.set(650,630,-670);cloud.scale.set(950,360,1);root.add(cloud);
        root.userData.mission3ModelCount=batches.size;
    }
    function update(run){
        if(cloud)cloud.material.opacity=Mission3Core.storm(run)>=70?.65:.25;
        relayMarkers.forEach((item,i)=>{
            const r=run.relays[i],text=!r.scanned?'未掃描':r.activating?'啟動中':r.restored?'已恢復':r.active?'ACTIVE':'OFFLINE';
            if(item.last!==text){item.last=text;item.status.write(`${r.id} · ${text}`,r.active&&r.scanned?'#286c4b':'#825713');item.ring.material.color.set(r.active&&r.scanned?'#8bcfa9':'#edb85e');}
        });
        lamps.forEach((light,i)=>light.material.opacity=(i===2?run.relays.every(r=>r.active):run.relays[i].active)?.23:0);
    }
    function collides(p){
        if(p.y<12||p.y>900||Math.abs(p.x)>1600||Math.abs(p.z)>1400)return true;
        return colliders.some(b=>p.y<b.y+b.height+10&&p.y>b.y-10&&Math.abs(p.x-b.x)<b.width/2+12&&Math.abs(p.z-b.z)<b.depth/2+12);
    }
    return {preload,build,update,collides};
})();
