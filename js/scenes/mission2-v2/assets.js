/* Local visual resources only. Original Kenney templates are never mutated/disposed here. */
(function(root) {
    function createKit(THREE, parent, templates, palette) {
        const materials = new Map(), geometries = new Map(), batches = new Map();
        const transform = new THREE.Object3D();
        function material(color) {
            if (!materials.has(color)) materials.set(color, new THREE.MeshLambertMaterial({color:new THREE.Color(color).convertSRGBToLinear(), flatShading:true}));
            return materials.get(color);
        }
        function geometry(kind) {
            if (!geometries.has(kind)) {
                const make = {box:()=>new THREE.BoxGeometry(1,1,1),
                    cylinder:()=>new THREE.CylinderGeometry(.5,.5,1,10),
                    cone:()=>new THREE.ConeGeometry(.5,1,7),
                    rock:()=>new THREE.IcosahedronGeometry(.5,0)};
                geometries.set(kind, make[kind]());
            }
            return geometries.get(kind);
        }
        function instance(key, geo, mat, matrix, shadow=true) {
            if (!batches.has(key)) batches.set(key,{geo,mat,matrices:[],shadow});
            batches.get(key).matrices.push(matrix.clone());
        }
        function shape(kind, color, x,y,z, sx,sy,sz, ry=0, rz=0) {
            transform.position.set(x,y,z); transform.rotation.set(0,ry,rz); transform.scale.set(sx,sy,sz); transform.updateMatrix();
            instance(kind+':'+color,geometry(kind),material(color),transform.matrix);
        }
        function box(color,x,y,z,sx,sy,sz,ry=0) {shape('box',color,x,y,z,sx,sy,sz,ry);}
        const prepared = new Map();
        function model(key,x,y,z,width,height,angle=0,burnt=false) {
            const template=templates[key];
            if (!template) return;
            if (!prepared.has(key)) {
                // A private scene clone provides normalized, immutable mesh transforms.
                const copy=template.clone(true); copy.updateMatrixWorld(true);
                const bounds=new THREE.Box3().setFromObject(copy), size=bounds.getSize(new THREE.Vector3());
                const center=bounds.getCenter(new THREE.Vector3());
                const parts=[];
                copy.traverse(mesh=>{if(mesh.isMesh){
                    const geo=mesh.geometry.clone(); geometries.set('model:'+key+':'+parts.length,geo);
                    parts.push({geo,matrix:mesh.matrixWorld.clone(),name:mesh.material.name||''});
                }});
                prepared.set(key,{parts,size,center,minY:bounds.min.y});
            }
            const item=prepared.get(key), scale=Math.min(width/Math.max(item.size.x,item.size.z),height/item.size.y);
            const norm=new THREE.Matrix4().makeTranslation(-item.center.x,-item.minY,-item.center.z);
            transform.position.set(x,y,z); transform.rotation.set(0,angle,0); transform.scale.setScalar(scale); transform.updateMatrix();
            item.parts.forEach((part,n)=>{
                const leaf=/leaf|grass/i.test(part.name);
                const rock=/rock/.test(key);
                const color=burnt?(leaf?0x72715b:0x51493f):(leaf?palette.foliage:(rock?palette.stone:palette.bark));
                instance('model:'+key+':'+n+':'+color,part.geo,material(color),transform.matrix.clone().multiply(norm).multiply(part.matrix));
            });
        }
        function flush() {
            batches.forEach(({geo,mat,matrices,shadow})=>{
                const mesh=new THREE.InstancedMesh(geo,mat,matrices.length);
                matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
                mesh.instanceMatrix.needsUpdate=true;
                mesh.castShadow=shadow; mesh.receiveShadow=true;
                // Three r128 does not calculate aggregate instance bounds.
                mesh.frustumCulled=false;
                parent.add(mesh);
            });
            batches.clear();
        }
        function label(text,x,y,z,color=palette.teal,width=140) {
            const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=128;
            const ctx=canvas.getContext('2d'); ctx.fillStyle='#'+color.toString(16).padStart(6,'0'); ctx.fillRect(0,0,512,128);
            ctx.fillStyle='#fff9ec'; ctx.font='600 58px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';ctx.fillText(text,256,65);
            const texture=new THREE.CanvasTexture(canvas); texture.minFilter=THREE.LinearFilter;
            const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true,depthWrite:false}));
            sprite.position.set(x,y,z);sprite.scale.set(width,width/4,1);parent.add(sprite);return sprite;
        }
        return {material,geometry,shape,box,model,flush,label};
    }
    root.Mission2V2Assets=Object.freeze({createKit});
})(typeof globalThis !== 'undefined' ? globalThis : this);
