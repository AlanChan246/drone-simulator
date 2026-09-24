/*
THESIS: A working woodland fire-response corridor, with the original flight contract.
OWN-WORLD: Sage woods, sand tracks, chalk landing pads, evergreen roofs and rescue orange.
STORY: Launch at the ranger base, collect water, reach the fire fronts, hand over at rescue.
FIRST VIEWPORT: A service road frames the west; the trail network opens toward rescue at NE.
FORM: Code-led spatial environment, approved 2026-09-24; no page identity replacement.
FINISH: Behaviour parity, multi-camera evidence, measured rendering and recorded asset provenance.
*/
(function(root) {
    const C=root.Mission2V2Config;
    function selected(search) { return new URLSearchParams(search).get('scene')!=='mission2-legacy'; }
    function build({THREE,scene,parent,templates,stations,createFireEffects,createFireLabel,animations}) {
        const P=C.palette, grid=C.grid;
        const kit=root.Mission2V2Assets.createKit(THREE,parent,templates,P);
        const {box,shape,model,label}=kit;
        const random=(a,b=0)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};
        const center=(i,j)=>({x:C.offsetX+j*C.cellSize+75,z:C.offsetZ+i*C.cellSize+75});
        const fireCells=[];grid.forEach((row,i)=>row.forEach((v,j)=>{if(v===4)fireCells.push([i,j]);}));
        const nearFire=(i,j)=>fireCells.some(([a,b])=>Math.hypot(i-a,j-b)<1.8);

        // Only this variant borrows global lighting, with an exact restoration closure.
        const lights=scene.children.filter(o=>o.isLight).map(light=>({light,color:light.color.clone(),
            intensity:light.intensity,position:light.position.clone(),ground:light.groundColor?.clone()}));
        const background=scene.background, fog=scene.fog;
        scene.background=new THREE.Color(0xdde5d9);scene.fog=new THREE.Fog(0xdde5d9,4200,7200);
        lights.forEach(({light})=>{
            light.color.setHex(0xfff4dc);
            if(light.isHemisphereLight){light.color.setHex(0xe8efe4);light.groundColor.setHex(0x7f8266);light.intensity=.65;}
            else if(light===scene.userData.mainDirLight){light.intensity=.9;light.position.set(-900,1800,-600);}
            else light.intensity=.1;
        });
        parent.userData.disposeMission2V2=()=>{
            scene.background=background;scene.fog=fog;
            lights.forEach(({light,color,intensity,position,ground})=>{light.color.copy(color);light.intensity=intensity;light.position.copy(position);if(ground)light.groundColor.copy(ground);});
        };
        parent.userData.sceneVariant=C.id;

        // Broad continuous land, with relief strictly outside the fixed, flat playfield.
        const terrain=new THREE.PlaneGeometry(8500,8500,100,100);terrain.rotateX(-Math.PI/2);
        const pos=terrain.attributes.position, colors=[];
        for(let k=0;k<pos.count;k++){
            const x=pos.getX(k),z=pos.getZ(k),outside=Math.max(Math.abs(x),Math.abs(z))-1120;
            const staging=(x<-1100&&x>-2050&&Math.abs(z)<1700)||(x>1080&&x<1550&&z<-550&&z>-1200);
            const hill=(staging?0:Math.max(0,outside))*.17*(.65+.35*Math.sin(x*.002)*Math.cos(z*.0018));
            pos.setY(k,-3+hill);
            const color=new THREE.Color(P.grass).convertSRGBToLinear();color.multiplyScalar(.91+random(k)*.13);
            colors.push(color.r,color.g,color.b);
        }
        terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();
        const ground=new THREE.Mesh(terrain,new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true}));
        ground.receiveShadow=true;parent.add(ground);

        // One continuous path surface: adjacent cells meet without model-tile seams.
        grid.forEach((row,i)=>row.forEach((value,j)=>{
            const {x,z}=center(i,j);
            if(value!==1){
                box(P.verge,x,-1.7,z,150,1,150);
                box(P.trail,x,-.9,z,124,1,124);
                if(grid[i]?.[j+1]!==undefined&&grid[i][j+1]!==1)box(P.trail,x+75,-.9,z,30,1,124);
                if(grid[i+1]?.[j]!==undefined&&grid[i+1][j]!==1)box(P.trail,x,-.9,z+75,124,1,30);
                // A few compact stones on verges, never in the flight centerline.
                if(value===0&&random(i,j)>.65)shape('rock',P.stone,x+66,2,z-48,8,5,11);
            }else{
                const burnt=nearFire(i,j),edge=i===0||j===0||i===13||j===13;
                // Cohesive undergrowth fills a blocked cell so gaps do not promise a route.
                shape('rock',burnt?0x7c775e:0x6d7e58,x,8,z,144,24,144,random(i,j));
                const count=edge?2:3;
                for(let k=0;k<count;k++){
                    const r=random(i*17+j,k+3),angle=r*Math.PI*2;
                    const px=x+Math.cos(angle)*35,pz=z+Math.sin(angle)*35;
                    if(burnt){
                        shape('cylinder',0x51493f,px,42,pz,9,84,9,r);
                        shape('cylinder',0x51493f,px+9,57,pz,5,39,5,r,.6);
                        if(k===0)model('forest_rock_a',px,0,pz,65,46,r,true);
                    }else model(k%2?'forest_tree_c':'forest_tree_b',px,0,pz,edge?108:91,edge?250:210,angle);
                }
            }
        }));

        // A sparse second tree belt and landforms provide a place beyond the grid.
        for(let k=0;k<92;k++){
            const a=k/92*Math.PI*2,r=1380+random(k,4)*850,x=Math.cos(a)*r,z=Math.sin(a)*r;
            // Keep service and rescue staging areas open and visible.
            if((x<-1070&&z<150)||(x>1020&&z<-550))continue;
            const h=Math.max(0,Math.max(Math.abs(x),Math.abs(z))-1120)*.17*(.65+.35*Math.sin(x*.002)*Math.cos(z*.0018))-3;
            model(k%3?'forest_tree_c':'forest_tree_b',x,h,z,140+random(k)*70,280+random(k,8)*170,a);
            if(k%7===0)model('forest_rock_b',x+65,h,z-70,160,85,a);
        }

        function rail(x,z,length,alongZ=false){
            for(let d=-length/2;d<=length/2;d+=85){
                box(P.bark,x+(alongZ?0:d),35,z+(alongZ?d:0),8,70,8);
            }
            box(0xa69879,x,45,z,alongZ?7:length,7,alongZ?length:7);
            box(0xa69879,x,22,z,alongZ?7:length,7,alongZ?length:7);
        }
        function shelter(x,z,width,depth){
            box(0xbcb8a6,x,2,z,width+35,6,depth+35);
            [-1,1].forEach(dx=>[-1,1].forEach(dz=>box(P.paper,x+dx*(width/2-10),95,z+dz*(depth/2-10),9,190,9)));
            box(P.paper,x,183,z,width,12,depth);
            box(P.teal,x,197,z,width+16,16,depth+16);
            box(P.orange,x,183,z-depth/2-2,width,18,5);
        }
        function supplies(x,z){
            box(0xb6a27e,x,19,z,45,38,38);box(P.paper,x,39,z,47,3,40);
            box(P.orange,x,20,z-20,12,33,1);
            box(P.teal,x+50,14,z+5,36,28,33);
        }
        function pad(x,z,goal){
            // Top remains below the unchanged 14 cm initial drone anchor.
            box(0x9a9c90,x,4,z,126,8,126);box(P.paper,x,8.3,z,116,1,116);
            const color=goal?P.teal:P.orange;
            [-1,1].forEach(d=>{box(color,x+d*47,9,z,5,1,100);box(color,x,9,z+d*47,100,1,5);});
            box(color,x-18,9,z,7,1,46);box(color,x+18,9,z,7,1,46);box(color,x,9,z,36,1,7);
            [-1,1].forEach(dx=>[-1,1].forEach(dz=>{shape('cylinder',color,x+dx*62,13,z+dz*62,7,25,7);}));
            label(goal?'救援降落':'起飛基地',x,125,z-48,color,156);
        }
        pad(C.spawn.x,C.spawn.z,false);pad(C.goal.x,C.goal.z,true);

        // Foreground approach road and equipment use life-sized world dimensions.
        box(0x71756c,-1340,-2,0,330,2,3100);
        box(0xb6b9a3,-1513,-1,0,15,2,3100);box(0xb6b9a3,-1167,-1,0,15,2,3100);
        for(let z=-1450;z<1500;z+=160)box(P.paper,-1340,-.3,z,7,1,65);
        shelter(-1240,-900,230,240);supplies(-1260,-870);supplies(-1220,-1000);
        label('林務救援站',-1260,245,-950,P.teal,230);
        rail(-1105,-745,250,true);
        // Closed road gate tells the land-access story without adding a flight obstacle.
        box(P.paper,-1340,55,-590,310,16,12);
        for(let x=-1460;x<-1200;x+=54)box(P.orange,x,55,-598,27,16,2);
        box(P.dark,-1500,45,-590,18,90,18);box(P.dark,-1180,45,-590,18,90,18);
        // Ranger hut: quiet single-storey silhouette beyond the active forest border.
        box(0xd9d1b9,-1750,125,-780,300,250,340);
        box(P.teal,-1750,261,-780,330,25,370);
        box(P.bark,-1598,83,-780,4,166,76);
        [-1,1].forEach(d=>box(0x597b78,-1750+d*80,139,-953,65,64,3));
        box(P.paper,-1750,230,-954,275,12,5);
        // Water tank, another landmark, kept off the interactive water points.
        shape('cylinder',0xb0b8ae,-1640,100,-280,170,200,170);
        shape('cylinder',P.teal,-1640,206,-280,177,12,177);
        box(P.orange,-1640,106,-366,80,22,3);
        shelter(1230,-850,250,280);supplies(1245,-865);supplies(1180,-940);
        label('救援集結',1230,245,-880,P.teal,210);
        rail(1095,-730,220,true);

        // Four water collection areas: shoreline and approach deck stay in their cells.
        grid.forEach((row,i)=>row.forEach((value,j)=>{
            const {x,z}=center(i,j);
            if(value===5){
                shape('cylinder',0xa3a99c,x,.3,z,139,3,139);
                shape('cylinder',P.water,x,2,z,121,2,121);
                shape('cylinder',0x72a6b0,x,3.1,z,84,.4,84);
                for(let n=0;n<9;n++){
                    const a=n/9*Math.PI*2;shape('rock',P.stone,x+Math.cos(a)*67,4,z+Math.sin(a)*67,16,10,18,a);
                }
                box(P.paper,x,4,z+55,62,5,24);
                box(P.teal,x-30,26,z+58,6,48,6);box(P.teal,x+30,26,z+58,6,48,6);
                label('取水',x,85,z-25,0x326775,100);
            }
            if(value===4){
                // Burn perimeter, cracked timber and standing remnants remain after extinguishing.
                shape('cylinder',0x7c725e,x,.1,z,143,1,137);
                shape('cylinder',0x56534a,x,1,z,108,1,104);
                for(let k=0;k<4;k++){
                    const a=k*1.5;shape('cylinder',0x433e35,x+Math.cos(a)*33,8,z+Math.sin(a)*33,10,65,10,a,Math.PI/2);
                }
                const fire=new THREE.Group();fire.position.set(x,0,z);
                fire.userData.isForestFire=true;fire.userData.fireIJ=i+','+j;
                const effects=createFireEffects(i,j);
                // Daylight fire reads by shape and color; no extra per-fire dynamic lights.
                [...effects.children].filter(o=>o.isLight).forEach(o=>effects.remove(o));
                fire.userData.effects=effects;fire.add(effects);createFireLabel(fire,i,j);parent.add(fire);
            }
        }));

        stations.forEach((station,index)=>{
            const {x,z}=station;
            // Keep the visible equipment envelope on the original sensor machine,
            // rather than suggesting an empty gap where a distance ray sees it.
            const machine=station.mesh.children.find(object=>object.isWall);
            station.mesh.updateWorldMatrix(true,true);
            const equipmentBounds=new THREE.Box3().setFromObject(machine);
            const equipmentSize=equipmentBounds.getSize(new THREE.Vector3());
            const equipmentCenter=equipmentBounds.getCenter(new THREE.Vector3());
            box(0xb6b8a6,x,1,z,128,3,128);
            box(0xcfab54,x,3,z,105,1,105);
            // Separate dynamic charge color from instanced static furniture.
            const group=new THREE.Group();group.position.set(x,0,z);
            const mat=new THREE.MeshLambertMaterial({color:new THREE.Color(0xd49b39).convertSRGBToLinear()});
            const plate=new THREE.Mesh(new THREE.CylinderGeometry(37,37,2,24),mat);plate.position.y=5;group.add(plate);
            station.mesh=group;station.baseAppearance=[{material:mat,color:mat.color.getHex(),emissive:mat.emissive.getHex(),emissiveIntensity:mat.emissiveIntensity}];
            parent.add(group);
            box(P.paper,equipmentCenter.x,equipmentCenter.y,equipmentCenter.z,equipmentSize.x,equipmentSize.y,equipmentSize.z);
            box(P.teal,equipmentCenter.x,equipmentBounds.max.y+3,equipmentCenter.z,equipmentSize.x+4,6,equipmentSize.z+4);
            box(P.dark,equipmentCenter.x,equipmentCenter.y,equipmentBounds.min.z-1,25,16,2);
            box(P.orange,equipmentCenter.x,equipmentCenter.y,equipmentBounds.min.z-3,17,3,1);
            label('補給 '+(index+1),x,105,z-36,0x826329,127);
        });
        kit.flush();
        // Render-only geometry is not a sensor target. In particular, Sprite.raycast
        // requires a raycaster camera that the existing sensor code does not supply.
        parent.traverse(object=>{
            if ((object.isMesh || object.isSprite) && !object.isWall && !object.parent?.isWall) {
                object.raycast=()=>{};
            }
        });
        // Store public diagnostics on the scene root for the local QA harness only.
        parent.userData.mission2V2={variant:C.id,gridRows:grid.length,assetPolicy:'private geometry/materials, shared read-only templates'};
    }
    root.Mission2V2=Object.freeze({selected,build});
})(typeof globalThis !== 'undefined' ? globalThis : this);
