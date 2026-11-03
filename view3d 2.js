// 3D view: Three.js scene, cinematic physical rendering, orbit + walk, slabs/walls with openings, catalog furniture, custom GLB/OBJ.
import { defById, getCatalog } from './catalog.js';
import { floorBaseY, floorTopY } from './store.js';
import { FINISH_MAP, ZONE_MAP, POOL_WATER_MAP } from './mats.js';

export class View3D {
  constructor(canvas, app){
    this.cv=canvas; this.app=app;
    this.ready=false; this.mode='orbit';
    this.showAll=true; this.shadows=true;
    this.groups={}; // floorIdx -> Group
    this.itemRoots=new Map(); // itemId -> Object3D
    this.wallMeshes=[];
    this.templateCache=new Map(); // defId/customId -> Object3D template
    this.fps=0;
    this.walk={ yaw:0, pitch:0, keys:new Set(), joy:{x:0,y:0}, eye:1.6 };
    this._downPos=null; this._moved=false;
    this.envI=1.0;
  }

  async init(onProg){
    const THREE = await import('https://esm.sh/three@0.160.0');
    this.THREE=THREE;
    const { OrbitControls } = await import('https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js');
    this.OrbitControls=OrbitControls;
    onProg?.('building physical renderer');

    const renderer=new THREE.WebGLRenderer({
      canvas:this.cv,
      antialias:true,
      powerPreference:'high-performance',
      precision:'highp'
    });
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.08;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer=renderer;

    const scene=new THREE.Scene();
    scene.background=new THREE.Color(0x0a101d);
    scene.fog=new THREE.Fog(0x0a101d, 45, 150);
    this.scene=scene;

    // HDR Environment generation for realistic reflections
    try{
      const { RoomEnvironment }=await import('https://esm.sh/three@0.160.0/examples/jsm/environments/RoomEnvironment.js');
      const pmrem=new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const envTex=pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
      scene.environment=envTex;
      this.envMap=envTex;
    }catch(e){ console.warn('env skipped',e); }

    const camera=new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(10, 8.5, 12);
    this.camera=camera;

    // Natural physical lighting
    const hemi=new THREE.HemisphereLight(0xdbe7ff, 0x544738, 1.15);
    scene.add(hemi); this.hemi=hemi;

    const amb=new THREE.AmbientLight(0xffffff, 0.18);
    scene.add(amb); this.amb=amb;

    const sun=new THREE.DirectionalLight(0xfffaed, 3.4);
    sun.position.set(16, 24, 11);
    sun.castShadow=true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left=-24; sun.shadow.camera.right=24;
    sun.shadow.camera.top=24; sun.shadow.camera.bottom=-24;
    sun.shadow.camera.near=1; sun.shadow.camera.far=90;
    sun.shadow.bias=-0.00015;
    sun.shadow.normalBias=0.025;
    scene.add(sun); scene.add(sun.target); this.sun=sun;

    // Interior physical lights
    this.interior=[];
    for(let i=0;i<6;i++){
      const pl=new THREE.PointLight(0xffdfa8, 0, 16, 1.7);
      pl.castShadow=false;
      scene.add(pl);
      this.interior.push(pl);
    }

    // Sky Dome
    this.skyMat=new THREE.ShaderMaterial({
      side:THREE.BackSide, depthWrite:false, fog:false,
      uniforms:{
        top:{value:new THREE.Color(0x285fb0)},
        bot:{value:new THREE.Color(0xdceaff)}
      },
      vertexShader:'varying vec3 vP; void main(){vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){float h=normalize(vP).y; vec3 c=mix(bot,top,smoothstep(-0.04,0.48,h)); c=mix(c,bot*0.9,smoothstep(-0.06,-0.5,h)); gl_FragColor=vec4(c,1.0);}'
    });
    const sky=new THREE.Mesh(new THREE.SphereGeometry(450,32,16),this.skyMat);
    sky.frustumCulled=false; sky.renderOrder=-10; scene.add(sky); this.sky=sky;

    // Stars
    {
      const n=500, pos=new Float32Array(n*3);
      let seed=12345; const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
      for(let i=0;i<n;i++){
        const t=rnd()*Math.PI*2, p=Math.acos(rnd()*0.95), R2=420;
        pos[i*3]=R2*Math.sin(p)*Math.cos(t); pos[i*3+1]=R2*Math.cos(p)+10; pos[i*3+2]=R2*Math.sin(p)*Math.sin(t);
      }
      const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3));
      this.starMat=new THREE.PointsMaterial({color:0xd9e3ff,size:1.8,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false});
      const stars=new THREE.Points(g,this.starMat); stars.frustumCulled=false; stars.renderOrder=-9; scene.add(stars);
    }

    // Ground
    const { tex:texFn }=await import('./mats.js');
    this._tex=texFn;
    const gtex=texFn(THREE,'grass',90,90);
    const gnd=new THREE.Mesh(new THREE.CircleGeometry(160,48), new THREE.MeshStandardMaterial({map:gtex, color:0x8fa57a, roughness:0.95, metalness:0.0}));
    gnd.material.envMapIntensity=0.25;
    gnd.rotation.x=-Math.PI/2; gnd.receiveShadow=true; scene.add(gnd); this.gnd=gnd;

    const grid=new THREE.GridHelper(60,60,0x2b466d,0x17253d);
    grid.position.y=0.02; grid.material.transparent=true; grid.material.opacity=0.35; scene.add(grid);

    // Controls
    const ctl=new OrbitControls(camera, this.cv);
    ctl.target.set(0,1,0); ctl.enableDamping=true; ctl.dampingFactor=0.06;
    ctl.maxPolarAngle=Math.PI*0.49; ctl.minDistance=1.2; ctl.maxDistance=85;
    this.controls=ctl;

    this.resize(); new ResizeObserver(()=>this.resize()).observe(this.cv.parentElement);
    this.bindInput();
    this.ready=true;
    this.preset='orbit';
    this.loop();
    this.applyGraphics();
    this.rebuild();
  }

  resize(){
    if(!this.ready) return;
    const r=this.cv.parentElement.getBoundingClientRect();
    const w=Math.max(2,r.width), h=Math.max(2,r.height);
    this.renderer.setSize(w,h,false);
    this.camera.aspect=w/h; this.camera.updateProjectionMatrix();
  }

  setShowAll(v){ this.showAll=v; this.rebuild(); }
  setShadows(v){
    this.app.state.settings.shadows=v;
    import('./store.js').then(m=>m.saveState(this.app.state)).catch(()=>{});
    this.applyGraphics(); this.rebuild();
  }

  applyGraphics(){
    if(!this.ready) return;
    const st=this.app.state, s=st.settings;
    import('./mats.js').then(M=>{
      if(s.quality==null){ s.quality=M.deviceDefaultQuality(); s.shadows=M.QUALITY[s.quality]?.sunShadow??true; }
      s.quality=M.qualityId(s.quality);
      if(s.shadows==null){ s.shadows=M.QUALITY[s.quality]?.sunShadow??true; }
      if(s.autoQuality==null) s.autoQuality=true;
      if(!this.effQ||!M.QUALITY[this.effQ]) this.effQ=s.quality;
      const q=M.QUALITY[this.effQ]||M.QUALITY.balanced;
      const L=M.LIGHTING[s.lighting||'day']||M.LIGHTING.day;
      const bright=s.brightness??1, warm=s.warmth??0.35;
      
      this.envI=q.env*1.15;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, q.pr));
      const wantShadows=!!s.shadows&&q.shadow>0;
      this.shadows=wantShadows;
      this.renderer.shadowMap.enabled=wantShadows;
      this.sun.castShadow=wantShadows;
      const sz=Math.max(q.shadow||1024, 1536);
      if(this.sun.shadow.mapSize.x!==sz){
        this.sun.shadow.mapSize.set(sz,sz);
        if(this.sun.shadow.map){ this.sun.shadow.map.dispose(); this.sun.shadow.map=null; }
      }

      const sunC=new this.THREE.Color(L.sun);
      sunC.lerp(new this.THREE.Color(warm>0.5?0xff944d:0xfffaea), Math.abs(warm-0.35)*0.85);
      this.sun.color.copy(sunC);
      this.sun.intensity=L.sunI*bright*1.1;
      this.sun.position.set(...L.pos);

      this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.gnd); this.hemi.intensity=L.hemiI*(0.75+bright*0.35);
      this.amb.intensity=0.12+0.1*bright;
      this.scene.background=new this.THREE.Color(L.bg);
      this.scene.fog=new this.THREE.Fog(L.skyBot??L.bg, L.fog[0], L.fog[1]);
      if(this.skyMat){ this.skyMat.uniforms.top.value.set(L.skyTop??L.bg); this.skyMat.uniforms.bot.value.set(L.skyBot??L.bg); }
      if(this.starMat){ this.starMat.opacity=L.stars??0; }
      if(this.sky&&this.controls){ const t=this.controls.target; this.sky.position.set(t.x,0,t.z); }
      this.renderer.toneMappingExposure=L.exp*(0.8+bright*0.28);

      for(const pl of this.interior){ pl.intensity=L.int*26*bright; pl.color.set(warm>0.4?0xffca8d:0xfff5e6); }
      if(this.gnd){ this.gnd.material.color.set(L.bg===0x0b1220?0x243326:0x8fa57a); }
      this.scene.traverse(o=>{ if(o.isMesh&&o.material&&'envMapIntensity' in o.material&&!o.userData.keepEnv){ o.material.envMapIntensity=this.envI*(o.userData.envMul||1); } });
      this.resize();
    }).catch(()=>{});
  }

  setPreset(name){
    this.preset=name;
    const st=this.app.state, y=floorTopY(st,st.activeFloor);
    const fl=st.floors[st.activeFloor];
    const cx=fl.slab?.cx||0, cz=fl.slab?.cz||0;
    const W=Math.max(fl.slab?.w||10, 8), D=Math.max(fl.slab?.d||8, 8);
    if(name==='walk'){ this.setMode('walk'); }
    else{
      this.mode='orbit'; if(this.ready) this.controls.enabled=true;
      if(name==='top'){ this.camera.position.set(cx,y+22,cz+0.01); this.controls.target.set(cx,y,cz); }
      else if(name==='dollhouse'){ this.camera.position.set(cx+W*0.9,y+W*0.9,cz+D*1.1); this.controls.target.set(cx,y+1,cz); }
      else if(name==='exterior'){ const R=Math.max(W,D)*1.5+6; this.camera.position.set(cx+R*0.8,y+6,cz+R*0.9); this.controls.target.set(cx,y+1.5,cz); }
      else { this.camera.position.set(cx+9,y+8,cz+11); this.controls.target.set(cx,y+1,cz); }
    }
    this.applyVisibility();
    if(this.ready) this.controls.update();
  }

  applyVisibility(){
    const hide=this.preset==='top'||this.preset==='dollhouse';
    for(const m of (this.ceilMeshes||[])) m.visible=!hide;
    for(const m of (this.roofMeshes||[])) m.visible=!hide;
    const wantSolid=this.preset==='exterior'||this.preset==='dollhouse';
    if(wantSolid!==this.solidGhost){ this.solidGhost=wantSolid; this.rebuild(); }
  }

  setMode(m){
    this.mode=m;
    if(!this.ready) return;
    this.controls.enabled=(m==='orbit');
    if(m==='walk'){
      const st=this.app.state;
      const y=floorTopY(st, st.activeFloor)+this.walk.eye;
      const fl=st.floors[st.activeFloor];
      const cx=fl.slab?.cx||0, cz=fl.slab?.cz||0;
      this.camera.position.set(cx+3, y, cz+4);
      this.walk.yaw=Math.atan2(this.camera.position.x-cx, this.camera.position.z-cz)+Math.PI;
      this.walk.pitch=-0.1;
      this.applyWalkCam();
    } else {
      const st=this.app.state;
      const y=floorTopY(st, st.activeFloor);
      this.controls.target.set(0,y+1,0);
    }
  }

  applyWalkCam(){
    this.camera.rotation.set(0,0,0); this.camera.rotation.order='YXZ';
    this.camera.rotation.y=this.walk.yaw; this.camera.rotation.x=this.walk.pitch;
  }

  bindInput(){
    const cv=this.cv;
    cv.addEventListener('pointerdown',e=>{
      this._downPos={x:e.clientX,y:e.clientY}; this._moved=false; this._drag3d=null;
      if((this.app.tool==='select'||this.app.tool==='move')&&!this.app.pendingDef) this._maybeDrag(e);
    });
    cv.addEventListener('pointermove',e=>{
      if(this._downPos && Math.hypot(e.clientX-this._downPos.x,e.clientY-this._downPos.y)>7) this._moved=true;
      if(this.mode==='walk' && e.buttons && this._downPos){
        const dx=e.movementX||0, dy=e.movementY||0;
        this.walk.yaw-=dx*0.004; this.walk.pitch=Math.max(-1.2,Math.min(1.2,this.walk.pitch-dy*0.004));
        this.applyWalkCam();
      }
      if(this._drag3d && e.buttons) this._dragMove(e);
      else if(!e.buttons) this._updateGhost(e);
    });
    const up=e=>{
      if(this._downPos && !this._moved){ this.tap(e.clientX,e.clientY); }
      this._downPos=null;
      if(this._drag3d){ this._drag3d=null; if(this.mode==='orbit') this.controls.enabled=true; this.hideGhost(); this.app.live(); }
    };
    cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',()=>{this._downPos=null; this._drag3d=null;});
    window.addEventListener('keydown',e=>{
      if(this.mode!=='walk') return;
      this.walk.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup',e=>{ this.walk.keys.delete(e.key.toLowerCase()); });
  }

  raycastAt(px,py){
    const r=this.cv.getBoundingClientRect();
    const nx=((px-r.left)/r.width)*2-1, ny=-((py-r.top)/r.height)*2+1;
    const rc=new this.THREE.Raycaster(); rc.setFromCamera({x:nx,y:ny}, this.camera);
    return { rc, hits:rc.intersectObjects(this.scene.children,true) };
  }

  selOf(o){ while(o&&!o.userData.sel&&o!==this.scene) o=o.parent; return o&&o.userData.sel?{sel:o.userData.sel,obj:o}:null; }

  _maybeDrag(e){
    if(!this.ready||this.mode!=='orbit') return;
    try{
      const {hits}=this.raycastAt(e.clientX,e.clientY);
      for(const h of hits){
        const f=this.selOf(h.object);
        if(f&&f.sel.type==='item'){
          const fl=this.app.state.floors[f.sel.floor];
          const it=fl&&fl.items.find(v=>v.id===f.sel.id);
          if(!it||it.locked) return;
          this.app.checkpoint();
          this.app.select({type:'item',id:it.id,floor:f.sel.floor},{quiet:true});
          const wy=h.point.y;
          if(it.on) this._drag3d={kind:'shelf',it,fl,floor:f.sel.floor,plane:new this.THREE.Plane(new this.THREE.Vector3(0,1,0),-wy)};
          else if(it.mount){
            const w=fl.walls.find(v=>v.id===it.mount.wallId);
            if(!w) return;
            const L=Math.hypot(w.x2-w.x1,w.z2-w.z1)||1e-6;
            const nx=-(w.z2-w.z1)/L*it.mount.side, nz=(w.x2-w.x1)/L*it.mount.side;
            this._drag3d={kind:'wall',it,fl,floor:f.sel.floor,wall:w,plane:new this.THREE.Plane(new this.THREE.Vector3(nx,0,nz),-(nx*w.x1+nz*w.z1))};
          } else this._drag3d={kind:'floor',it,fl,floor:f.sel.floor,plane:new this.THREE.Plane(new this.THREE.Vector3(0,1,0),-wy)};
          this.controls.enabled=false;
          return;
        }
        if(f&&(f.sel.type==='wall'||f.sel.type==='zone'||f.sel.type==='pool')) return;
      }
    }catch(err){}
  }

  _dragMove(e){
    const d=this._drag3d; if(!d) return;
    try{
      const {rc}=this.raycastAt(e.clientX,e.clientY);
      const pt=new this.THREE.Vector3();
      if(!rc.ray.intersectPlane(d.plane,pt)) return;
      const snap=v=>{ const s=this.app.state.settings.snap||0.25; return Math.round(v/s)*s; };
      if(d.kind==='floor'){
        d.it.x=snap(pt.x); d.it.z=snap(pt.z);
        this.app.afterGeometryChange(true);
      } else if(d.kind==='wall'){
        const L=Math.hypot(d.wall.x2-d.wall.x1,d.wall.z2-d.wall.z1)||1e-6;
        const ux=(d.wall.x2-d.wall.x1)/L, uz=(d.wall.z2-d.wall.z1)/L;
        d.it.mount.along=Math.max(0,Math.min(L,(pt.x-d.wall.x1)*ux+(pt.z-d.wall.z1)*uz));
        const topY=(d.fl.slab?.thick||0.25);
        const wy=pt.y-(this._floorBaseY(d.floor)+topY);
        d.it.mount.y=Math.max(0.2,wy);
        this.app.afterGeometryChange(true);
      } else if(d.kind==='shelf'){
        const p=d.fl.items.find(v=>v.id===d.it.on.parentId);
        if(!p) return;
        const pr=(p.rot||0)*Math.PI/180;
        const lx=pt.x-(p.x||0), lz=pt.z-(p.z||0);
        d.it.on.dx=(lx*Math.cos(pr)+lz*Math.sin(pr));
        d.it.on.dz=(-lx*Math.sin(pr)+lz*Math.cos(pr));
        this.app.afterGeometryChange(true);
      }
      this.app.updateCtxLabel?.('✥ '+d.it.x.toFixed(1)+', '+d.it.z.toFixed(1));
    }catch(err){}
  }

  _floorBaseY(fi){ try{ const st=this.app.state; let y=0; for(let i=0;i<fi;i++) y+=(st.floors[i].wallHeight||2.7)+(st.floors[i].slab?.thick||0.25); return y; }catch(e){ return 0; } }

  _updateGhost(e){
    if(!this.ready) return;
    const pend=this.app.pendingDef;
    const tool=this.app.tool;
    const wantGhost=pend||tool==='zone'||tool==='patio'||tool==='pool'||tool==='paint';
    if(!wantGhost||this.mode!=='orbit'){ this.hideGhost(); return; }
    try{
      const {hits}=this.raycastAt(e.clientX,e.clientY);
      const h=hits[0]; if(!h){ this.hideGhost(); return; }
      const def=pend||{w:tool==='paint'?1:3,d:tool==='paint'?1:3,h:0.1};
      if(!this._ghost){
        this._ghost=new this.THREE.Mesh(new this.THREE.BoxGeometry(1,1,1),
          new this.THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.35,depthWrite:false}));
        this.scene.add(this._ghost);
      }
      const gw=(def.w||1)*(tool==='paint'?(this.app.brushSize||1):1);
      const gd=(def.d||1)*(tool==='paint'?(this.app.brushSize||1):1);
      this._ghost.scale.set(gw,Math.max(0.1,def.h||0.5),gd);
      this._ghost.position.copy(h.point); this._ghost.position.y+=0.1;
      this._ghost.visible=true;
    }catch(err){}
  }

  hideGhost(){ if(this._ghost) this._ghost.visible=false; }

  tap(px,py){
    if(!this.ready) return;
    if(this.app.pendingDef||this.app.tool==='zone'||this.app.tool==='patio'||this.app.tool==='pool'||this.app.tool==='paint'){
      this.app.placeAt3D(px,py);
      return;
    }
    const {hits}=this.raycastAt(px,py);
    for(const h of hits){
      const f=this.selOf(h.object);
      if(f){
        let o=h.object, spec=null;
        while(o&&o!==this.scene){ if(o.userData.ix){ spec=o.userData.ix; break; } o=o.parent; }
        if(spec&&f.sel.type==='item'){
          const fl=this.app.state.floors[f.sel.floor];
          const it=fl&&fl.items.find(v=>v.id===f.sel.id);
          if(it&&!it.locked){ this.app.select(f.sel); this.toggleIx(it,spec.tag); return; }
        }
        this.app.select(f.sel);
        return;
      }
      if(h.object.geometry?.type==='CircleGeometry') break;
    }
    this.app.tap3DEmpty();
  }

  helpers(){
    if(this._H) return this._H;
    const THREE=this.THREE, self=this;
    const T=(n,rx,ry)=>self._tex(self.THREE,n,rx,ry);
    const cache=new Map();
    const fin=(mm,mul=1)=>{ mm.envMapIntensity=(self.envI??1.0)*mul; return mm; };

    // Photorealistic Physical Materials with Micro-Roughness and Clearcoat Sheen
    const mat=(c,r=0.68,m=0.0,clearcoat=0.0)=>{
      const k=c+'|'+r+'|'+m+'|'+clearcoat;
      if(cache.has(k)) return cache.get(k);
      const mm=new THREE.MeshPhysicalMaterial({
        color:new THREE.Color(c),
        roughness:r,
        metalness:m,
        clearcoat:clearcoat,
        clearcoatRoughness:0.12,
        reflectivity:0.5
      });
      fin(mm); cache.set(k,mm); return mm;
    };

    const tmat=(c,texName,rx=1,ry=1,r=0.68,m=0.0)=>{
      const k='t'+c+'|'+texName+'|'+rx+'x'+ry+'|'+r+'|'+m;
      if(cache.has(k)) return cache.get(k);
      const t=T(texName,rx,ry);
      const isStone=texName.includes('marble')||texName.includes('tile')||texName.includes('oak');
      const mm=new THREE.MeshPhysicalMaterial({
        color:new THREE.Color(c),
        roughness:r,
        metalness:m,
        clearcoat:isStone?0.35:0.0,
        clearcoatRoughness:0.1
      });
      if(t){ mm.map=t; mm.bumpMap=t; mm.bumpScale=0.45; }
      fin(mm); cache.set(k,mm); return mm;
    };

    const box=(parent,w,h,d,c,x=0,y=0,z=0)=>{
      const ms=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));
      ms.position.set(x,y,z); ms.castShadow=self.shadows; ms.receiveShadow=true; parent.add(ms); return ms;
    };

    const tbox=(parent,w,h,d,c,texName,rx,ry,x=0,y=0,z=0,rough=0.68,metal=0)=>{
      const ms=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),tmat(c,texName,rx,ry,rough,metal));
      ms.position.set(x,y,z); ms.castShadow=self.shadows; ms.receiveShadow=true; parent.add(ms); return ms;
    };

    const mbox=(parent,w,h,d,c,rough=0.32,metal=0.88,x=0,y=0,z=0)=>{
      const ms=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c,rough,metal));
      ms.position.set(x,y,z); ms.castShadow=self.shadows; ms.receiveShadow=true; parent.add(ms); return ms;
    };

    const cyl=(parent,rt,rb,h,c,x=0,y=0,z=0,seg=18)=>{
      const ms=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat(c));
      ms.position.set(x,y,z); ms.castShadow=self.shadows; ms.receiveShadow=true; parent.add(ms); return ms;
    };

    // Realistic Architectural Glass with Physical IOR and Transmission
    const glass=(parent,w,h,d,x=0,y=0,z=0,op=0.22,c='#eef6fc')=>{
      const ms=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
        fin(new THREE.MeshPhysicalMaterial({
          color:new THREE.Color(c),
          transparent:true,
          opacity:op,
          roughness:0.04,
          metalness:0.08,
          transmission:0.92,
          ior:1.52,
          thickness:0.12
        }), 2.2));
      ms.position.set(x,y,z); parent.add(ms); return ms;
    };

    const piv=(parent,x=0,y=0,z=0)=>{ const gr=new THREE.Group(); gr.position.set(x,y,z); parent.add(gr); return gr; };
    const ix=(node,tag,kind,opts={})=>{ node.userData.ix={tag,kind,...opts}; return node; };

    this._H={mat,tmat,box,tbox,cyl,mbox,glass,piv,ix};
    return this._H;
  }

  disposeGroup(g){
    let keepG=null, keepM=null;
    try{
      keepG=new Set(); keepM=new Set();
      for(const t of this.templateCache.values()) t.traverse(o=>{ if(o.isMesh){ if(o.geometry) keepG.add(o.geometry); const ms=Array.isArray(o.material)?o.material:[o.material]; for(const m of ms) if(m) keepM.add(m); } });
    }catch(e){}
    try{
      g.traverse(o=>{ if(o.isMesh){
        if(o.geometry&&!(keepG&&keepG.has(o.geometry))) o.geometry.dispose();
        const ms=Array.isArray(o.material)?o.material:[o.material];
        for(const m of ms){ if(m&&m.dispose&&!(keepM&&keepM.has(m))) m.dispose(); }
      }});
    }catch(e){}
  }

  clearFloorGroups(){
    for(const k of Object.keys(this.groups)){ const g=this.groups[k]; this.scene.remove(g); this.disposeGroup(g); }
    this.groups={}; this.itemRoots.clear(); this.wallMeshes=[];
    this.ceilMeshes=[]; this.roofMeshes=[];
    this.swayMeshes=[]; this.waterTexs=[]; this._lightCount=0;
    this.ixAnims=[]; this._ixLights=0;
    if(this._ghost){ this.scene.remove(this._ghost); this._ghost=null; }
  }

  rebuildSoon(){
    if(this._rq) return;
    this._rq=requestAnimationFrame(()=>{ this._rq=0; try{ this.rebuild(); }catch(e){} });
  }

  rebuild(){
    if(!this.ready) return;
    const THREE=this.THREE, st=this.app.state;
    this.clearFloorGroups();
    const H=this.helpers();
    const NS='sel';

    for(let fi=0;fi<st.floors.length;fi++){
      const fl=st.floors[fi];
      const isActive=fi===st.activeFloor;
      if(!this.showAll && !isActive) continue;
      const g=new THREE.Group(); g.position.y=floorBaseY(st,fi);

      const s=fl.slab||{w:12,d:10,cx:0,cz:0,thick:0.25};
      const slabT=s.thick||0.25;
      const slab=new THREE.Mesh(new THREE.BoxGeometry(s.w,slabT,s.d),
        H.tmat('#a2a8b0','concrete',Math.max(1,Math.round(s.w/3)),Math.max(1,Math.round(s.d/3)),0.92));
      slab.position.set(s.cx||0, slabT/2, s.cz||0);
      slab.receiveShadow=true; slab.castShadow=this.shadows; slab.userData[NS]={type:'slab',floor:fi};
      g.add(slab);

      const topY=slabT;
      const FIN={wood:['#ffffff','oak',0.55,0],tile:['#ffffff','tile',0.24,0],carpet:['#d8cfc0','carpet',0.96,0],concrete:['#ffffff','concrete',0.88,0]};
      const [fc,ft,fr,fm]=FIN[fl.finish||'wood']||FIN.wood;
      const wear=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.5,s.w-0.02),Math.max(0.5,s.d-0.02)),
        H.tmat(fc,ft,Math.max(1,Math.round(s.w/2.5)),Math.max(1,Math.round(s.d/2.5)),fr,fm));
      wear.rotation.x=-Math.PI/2; wear.position.set(s.cx||0,topY+0.005,s.cz||0);
      wear.receiveShadow=true; g.add(wear);

      for(const w of fl.walls){
        this.buildWall(g, w, fl.openings.filter(o=>o.wallId===w.id), topY, fi, isActive, 1.0);
      }

      for(const z of (fl.zones||[])) this.renderZone(g, z, H, topY, fi);
      for(const p of (fl.pools||[])) this.renderPool(g, p, H, topY, fi);
      this.renderPaints(g, fl, H, topY, slabT);

      for(const it of fl.items){
        const root=new THREE.Group();
        const def0=defById(it.defId)||this.app.customDef(it.customId||it.defId);
        root.position.set(it.x, topY+(def0?.lift||0)+(it.y||0), it.z);
        root.rotation.y=(it.rot||0)*Math.PI/180;
        const sc=it.scale||1; root.scale.set(sc,sc,sc);
        const def=defById(it.defId);

        if(def){
          try{ def.build(root, THREE, H, it); }catch(e){ console.warn('build fail',def.id,e); }
          if(it.color && !def.noTint){
            const pots=[];
            root.traverse(o=>{ if(o.isMesh&&o.userData.pot) pots.push(o); });
            const targets=pots.length?pots:root.children.slice();
            const paint=(o)=>{ if(o.isMesh){ o.material=o.material.clone(); if(o.material.color) o.material.color.set(it.color); } };
            if(pots.length) pots.forEach(paint);
            else root.traverse(paint);
          }
          if(def){
            root.traverse(o=>{ const s=o.userData.ix; if(!s) return;
              const has=!!(it.ui&&(s.tag in it.ui));
              const tgt=has?(it.ui[s.tag]?1:0):((s.kind==='lamp'||s.kind==='flicker')?1:0);
              const e={it,node:o,spec:s,cur:tgt,baseRot:0,basePos:0,light:null,mat:null,I:8,_init:false,
                ph:Math.random()*6.28,baseScale:o.scale.clone()};
              try{
                if(s.kind==='hinge'){ e.baseRot=o.rotation[s.axis||'y']||0; }
                else if(s.kind==='slide'){ e.basePos=o.position[s.axis||'z']||0; }
                else if(s.kind==='lamp'||s.kind==='flicker'){
                  let m2=o.material;
                  if(!m2||!m2.isMeshStandardMaterial){
                    const c0=(m2&&m2.color)?m2.color.clone():new THREE.Color('#ffe9b0');
                    m2=new THREE.MeshStandardMaterial({color:c0,roughness:0.85,emissive:new THREE.Color(s.color||'#ffd9a0'),emissiveIntensity:0.1});
                    o.material=m2;
                  } else { o.material=m2.clone(); o.material.emissive=new THREE.Color(s.color||'#ffd9a0'); o.material.emissiveIntensity=0.1; }
                  e.mat=o.material;
                  if(this._ixLights<14){
                    const L=new THREE.PointLight(new THREE.Color(s.color||'#ffd9a0'),tgt*(s.intensity??9),s.dist??8,1.8);
                    o.add(L); e.light=L; e.I=s.intensity??9; this._ixLights++;
                  }
                }
                else if(s.kind==='screen'){
                  let m2=o.material;
                  if(!m2||!m2.isMeshStandardMaterial){
                    const c0=(m2&&m2.color)?m2.color.clone():new THREE.Color('#14253a');
                    m2=new THREE.MeshStandardMaterial({color:c0,roughness:0.35,emissive:new THREE.Color(s.color||'#9fd0ff'),emissiveIntensity:0.15});
                    o.material=m2;
                  } else { o.material=m2.clone(); o.material.emissive=new THREE.Color(s.color||'#9fd0ff'); o.material.emissiveIntensity=0.15; }
                  e.mat=o.material;
                }
              }catch(err){}
              this.ixAnims.push(e);
            });
          }
        } else {
          const cust=this.app.customById(it.customId||it.defId);
          const tpl=cust?this.templateCache.get('c:'+cust.id):null;
          if(tpl){ const c=tpl.clone(true);
            if(cust&&(cust.sx||cust.sy||cust.sz)) c.scale.set(cust.sx||1,cust.sy||1,cust.sz||1);
            root.add(c); }
          else { H.box(root,0.8,0.8,0.8,'#b48ad9',0,0.4,0); this.app.loadCustomTemplate(cust); }
        }

        root.userData.sel={type:'item',floor:fi,id:it.id};
        root.traverse(o=>{ o.userData.selRoot=root; if(o.isMesh){ o.castShadow=this.shadows; o.receiveShadow=true; } });
        g.add(root);
        if(isActive) this.itemRoots.set(it.id, root);
        if(it.matOverrides && Object.keys(it.matOverrides).length) this.applyItemOverrides(it, fi, root);

        if(this.swayMeshes.length<240) root.traverse(o=>{
          if(o.isMesh&&o.userData.sway!=null) this.swayMeshes.push({m:o,ph:o.userData.sway,base:o.rotation.z});
          if(o.isMesh&&o.userData.water&&o.material?.map&&!this.waterTexs.includes(o.material.map)) this.waterTexs.push(o.material.map);
        });
      }

      // Contact Ambient Occlusion Under Furniture
      {
        const blobT=this._tex(this.THREE,'blob');
        for(const it of fl.items){
          const dd=defById(it.defId)||this.app.customDef(it.customId||it.defId)||{};
          const fw=(dd.w||1)*(it.scale||1), fd=(dd.d||1)*(it.scale||1);
          const bm=new THREE.Mesh(new THREE.PlaneGeometry(fw*1.28+0.3,fd*1.28+0.3),
            new THREE.MeshBasicMaterial({map:blobT,transparent:true,opacity:0.62,depthWrite:false}));
          bm.rotation.x=-Math.PI/2; bm.position.set(it.x,topY+0.012,it.z);
          bm.rotation.z=-(it.rot||0)*Math.PI/180;
          g.add(bm);
        }
      }

      // Ceiling
      {
        const wh=fl.wallHeight||2.7;
        const cm=new THREE.Mesh(new THREE.PlaneGeometry(s.w,s.d), H.mat('#f7f5ed',0.94));
        cm.rotation.x=Math.PI/2; cm.position.set(s.cx||0,topY+wh-0.02,s.cz||0);
        g.add(cm); (this.ceilMeshes=this.ceilMeshes||[]).push(cm);
      }

      // Interior Light Position
      {
        const li=this.interior[fi];
        if(li) li.position.set(s.cx||0, floorBaseY(st,fi)+topY+(fl.wallHeight||2.7)-0.9, s.cz||0);
      }

      if(!isActive && !this.solidGhost){
        g.traverse(o=>{ if(o.isMesh&&o.material&&!o.material.transparent){ o.material=o.material.clone(); o.material.transparent=true; o.material.opacity=0.76; } });
      }
      this.scene.add(g); this.groups[fi]=g;
    }

    // Topmost Roof
    {
      for(let fi=st.floors.length-1;fi>=0;fi--){
        const fl=st.floors[fi];
        if(!fl.walls.length) continue;
        if(fl.roof?.on===false) break;
        const g=this.groups[fi]; if(!g) break;
        const s=fl.slab||{w:12,d:10,cx:0,cz:0};
        const wh=fl.wallHeight||2.7, topY=(s.thick||0.25);
        const ov=0.9, rh=Math.min(s.w,s.d)*0.28+0.6;
        const roof=new THREE.Mesh(new THREE.ConeGeometry(1,1,4,1),
          H.tmat('#ffffff','roof',6,3,0.88));
        roof.rotation.y=Math.PI/4;
        roof.scale.set((s.w/2+ov)*1.42, rh, (s.d/2+ov)*1.42);
        roof.position.set(s.cx||0, topY+wh+rh/2-0.05, s.cz||0);
        roof.castShadow=this.shadows; roof.receiveShadow=true;
        g.add(roof); (this.roofMeshes=this.roofMeshes||[]).push(roof);
        break;
      }
    }
    this.applyVisibility();
    this.highlight();
    this.fitShadow();
  }

  fitShadow(){
    if(!this.ready||!this.sun) return;
    try{
      const st=this.app.state, fl=st.floors[st.activeFloor]||{};
      const s=fl.slab||{w:12,d:10,cx:0,cz:0};
      const R=Math.max(s.w||12,s.d||10)*0.5+4;
      const cx=s.cx||0, cz=s.cz||0;
      const dir=new this.THREE.Vector3().copy(this.sun.position).sub(this.sun.target.position).normalize();
      this.sun.target.position.set(cx,0,cz);
      this.sun.position.set(cx+dir.x*(R*2.2+14), Math.max(7,dir.y*(R*2.2+14)), cz+dir.z*(R*2.2+14));
      const c=this.sun.shadow.camera;
      c.left=-R; c.right=R; c.top=R; c.bottom=-R; c.near=1; c.far=R*5+45;
      c.updateProjectionMatrix();
    }catch(e){}
  }

  renderZone(g, z, H, topY, floorIdx){
    const THREE=this.THREE;
    const zm=(z.mat&&ZONE_MAP[z.mat])||ZONE_MAP.oak||{tex:'oak',base:'#ffffff'};
    const wdt=Math.max(0.2,(z.x1-z.x0)), dpt=Math.max(0.2,(z.z1-z.z0));
    const tile=Math.max(0.4, z.scale||1.2);
    let map=null;
    try{
      const base=this._tex(THREE, zm.tex, Math.max(1,Math.round(wdt/tile)), Math.max(1,Math.round(dpt/tile)));
      map=base.clone(); map.needsUpdate=true;
      map.center.set(0.5,0.5); map.rotation=((z.angle||0)*Math.PI/180);
    }catch(e){}

    const mm=new THREE.MeshPhysicalMaterial({
      color:new THREE.Color(z.color||zm.base||'#ffffff'),
      roughness:zm.kind==='terrain'?0.95:0.58,
      metalness:0,
      clearcoat:zm.kind==='floor'?0.3:0.0,
      clearcoatRoughness:0.12
    });
    if(map){ mm.map=map; mm.bumpMap=map; mm.bumpScale=0.45; }
    mm.envMapIntensity=(this.envI??1.0);

    const m=new THREE.Mesh(new THREE.PlaneGeometry(wdt,dpt), mm);
    m.rotation.x=-Math.PI/2;
    m.position.set((z.x0+z.x1)/2, topY+0.012+((z._i||0)*0.0012), (z.z0+z.z1)/2);
    m.receiveShadow=true;
    m.userData.sel={type:'zone',floor:floorIdx,id:z.id};
    g.add(m);

    const trim=H.mat('#d9d3c5',0.48);
    const cx=(z.x0+z.x1)/2, cz=(z.z0+z.z1)/2;
    for(const [ww,dd,ox,oz] of [[wdt+0.12,0.09,0,-dpt/2],[wdt+0.12,0.09,0,dpt/2],[0.09,dpt,-wdt/2,0],[0.09,dpt,wdt/2,0]]){
      const tm=new THREE.Mesh(new THREE.BoxGeometry(ww,0.024,dd), trim);
      tm.position.set(cx+ox, topY+0.014, cz+oz);
      tm.receiveShadow=true; g.add(tm);
    }
  }

  renderPaints(g, fl, H, topY, slabT){
    const THREE=this.THREE;
    for(const p of (fl.paints||[])){
      const zm=(p.mat&&ZONE_MAP[p.mat])||ZONE_MAP.grass||{tex:'grass',base:'#ffffff'};
      let map=null;
      try{ map=this._tex(THREE, zm.tex, 3, 3); }catch(e){}
      const mm=new THREE.MeshStandardMaterial({color:new THREE.Color(p.color||zm.base||'#ffffff'), roughness:0.95});
      if(map) mm.map=map;
      mm.envMapIntensity=(this.envI??0.25);
      mm.transparent=true; mm.opacity=0.92;
      const s=fl.slab||{w:12,d:10,cx:0,cz:0};
      const inside=p.x>s.cx-s.w/2&&p.x<s.cx+s.w/2&&p.z>s.cz-s.d/2&&p.z<s.cz+s.d/2;
      const m=new THREE.Mesh(new THREE.CircleGeometry(Math.max(0.2,p.r||1), 22), mm);
      m.rotation.x=-Math.PI/2;
      m.position.set(p.x, inside?topY+0.011:-slabT+0.05, p.z);
      m.receiveShadow=true;
      g.add(m);
    }
  }

  renderPool(g, p, H, topY, floorIdx){
    const THREE=this.THREE;
    const W=p.shape==='square'?Math.min(p.w,p.d):p.w, D=p.shape==='square'?Math.min(p.w,p.d):p.d;
    const rot=(p.rot||0)*Math.PI/180;
    const grp=new THREE.Group();
    grp.position.set(p.x, topY, p.z); grp.rotation.y=rot;
    const above=p.shape==='above';
    const rimH=above?0.85:0.42, waterY=rimH-0.16;
    const copingC=p.coping||'#e8e2d4';
    const wcol=(p.water&&POOL_WATER_MAP[p.water]&&POOL_WATER_MAP[p.water].base)||'#2f9fd8';
    let waterMap=null;
    try{ waterMap=this._tex(THREE,'water',Math.max(1,Math.round(W/2)),Math.max(1,Math.round(D/2))); }catch(e){}
    if(waterMap&&!this.waterTexs.includes(waterMap)) this.waterTexs.push(waterMap);
    const oval=p.shape==='oval', kidney=p.shape==='kidney';

    const mkWater=(sx,sz,ox,oz)=>{
      const wm=new THREE.MeshPhysicalMaterial({
        color:new THREE.Color(wcol),
        roughness:0.08,
        metalness:0.05,
        transmission:0.75,
        ior:1.333,
        transparent:true,
        opacity:0.9
      });
      if(waterMap){ wm.map=waterMap; }
      wm.envMapIntensity=1.2;
      let m;
      if(oval||kidney){ m=new THREE.Mesh(new THREE.CircleGeometry(0.5,28), wm); m.scale.set(sx,sz,1); m.rotation.x=-Math.PI/2; }
      else { m=new THREE.Mesh(new THREE.PlaneGeometry(sx,sz), wm); m.rotation.x=-Math.PI/2; }
      m.position.set(ox,waterY,oz); grp.add(m);

      const liner=new THREE.Mesh(oval||kidney?new THREE.CircleGeometry(0.5,28):new THREE.PlaneGeometry(sx,sz),
        new THREE.MeshStandardMaterial({color:new THREE.Color('#123a5a'), roughness:0.85}));
      if(oval||kidney){ liner.scale.set(sx,sz,1); liner.rotation.x=-Math.PI/2; }
      else liner.rotation.x=-Math.PI/2;
      liner.position.set(ox,0.03,oz); grp.add(liner);
      return {sx,sz,ox,oz};
    };

    const spans=kidney?[{sx:W*0.62,sz:D,ox:-W*0.2,oz:0},{sx:W*0.62,sz:D*0.9,ox:W*0.2,oz:D*0.05}]:[{sx:W,sz:D,ox:0,oz:0}];
    for(const sp of spans) mkWater(sp.sx,sp.sz,sp.ox,sp.oz);

    const wallM=H.tmat('#b9c4cc','tile',Math.max(1,Math.round(W)),1,0.35);
    const copM=H.mat(copingC,0.55);

    if(!oval&&!kidney){
      for(const [ww,dd,ox,oz] of [[W+0.5,0.25,0,-D/2-0.125],[W+0.5,0.25,0,D/2+0.125],[0.25,D, -W/2-0.125,0],[0.25,D,W/2+0.125,0]]){
        const wl=new THREE.Mesh(new THREE.BoxGeometry(ww,rimH,dd), wallM);
        wl.position.set(ox,rimH/2,oz); wl.castShadow=this.shadows; wl.receiveShadow=true; grp.add(wl);
        const cp=new THREE.Mesh(new THREE.BoxGeometry(ww+(dd>ww?0.14:0),0.07,dd+(ww>dd?0.14:0)), copM);
        cp.position.set(ox,rimH+0.035,oz); cp.castShadow=this.shadows; grp.add(cp);
      }
      const dk=new THREE.Mesh(new THREE.BoxGeometry(W+2.2,0.06,D+2.2), H.tmat('#c9c2b2','patio_stone',3,3,0.85));
      dk.position.set(0,0.03,0); dk.receiveShadow=true; grp.add(dk);
    } else {
      for(const sp of spans){
        const ring=new THREE.Mesh(new THREE.TorusGeometry(0.5,0.09,10,40), copM);
        ring.rotation.x=Math.PI/2; ring.scale.set(sp.sx+0.18,sp.sz+0.18,1);
        ring.position.set(sp.ox,rimH,sp.oz); ring.castShadow=this.shadows; grp.add(ring);
        const wl=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,rimH,28,1,true), wallM);
        wl.scale.set(sp.sx+0.1,1,sp.sz+0.1); wl.position.set(sp.ox,rimH/2,sp.oz); grp.add(wl);
      }
      const dk=new THREE.Mesh(new THREE.CylinderGeometry(Math.max(W,D)/2+1.1,Math.max(W,D)/2+1.1,0.06,28),
        H.tmat('#c9c2b2','patio_stone',3,3,0.85));
      dk.position.set(0,0.03,0); dk.receiveShadow=true; grp.add(dk);
    }

    if(p.shape==='infinity'){
      const spill=new THREE.Mesh(new THREE.BoxGeometry(W*0.9,0.5,0.3),
        new THREE.MeshPhysicalMaterial({color:new THREE.Color(wcol),roughness:0.08,transmission:0.8,transparent:true,opacity:0.88}));
      spill.position.set(0,rimH-0.35,D/2+0.3); grp.add(spill);
    }
    if(p.steps!==false){
      for(let i=0;i<3;i++){
        const st=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.12,0.4), copM);
        st.position.set(-W/2+0.7, waterY-0.05-i*0.14, 0); st.receiveShadow=true; grp.add(st);
      }
    }
    if(p.ladder!==false){
      for(const s of [-0.3,0.3]){
        const rail=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.9,10), H.mbox(grp,0.06,0.06,0.06,'#d0d4dc',0.2,0.95).material);
        rail.position.set(W/2-0.4,rimH+0.1,s); grp.add(rail);
      }
      for(let i=0;i<3;i++){
        const rung=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.6,10), H.mbox(grp,0.04,0.04,0.04,'#d0d4dc',0.2,0.95).material);
        rung.rotation.x=Math.PI/2; rung.position.set(W/2-0.4,rimH-0.1-i*0.2,0); grp.add(rung);
      }
    }
    if(p.board){
      const bd=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.06,2.2), H.mat('#276a88',0.5));
      bd.position.set(0,rimH+0.55,-D/2-0.7); bd.castShadow=this.shadows; grp.add(bd);
      const ful=new THREE.Mesh(new THREE.BoxGeometry(0.56,0.5,0.3), H.mat('#323742',0.4,0.7));
      ful.position.set(0,rimH+0.25,-D/2-0.2); grp.add(ful);
    }
    if(p.lights){
      const stripM=new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.5,W*0.7),0.04,0.06),
        new THREE.MeshBasicMaterial({color:0xa3eaff}));
      stripM.position.set(0,waterY-0.06,-D/2+0.1); grp.add(stripM);
      if(this._lightCount<5){
        this._lightCount++;
        const pl=new THREE.PointLight(0x73dcff,7,Math.max(W,D)+3,1.8);
        pl.position.set(p.x,topY+waterY+0.3,p.z);
        g.add(pl);
      }
    }
    if(p.fountain){
      const jet=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.12,0.7,12),
        new THREE.MeshPhysicalMaterial({color:0xbfe8ff,transparent:true,opacity:0.75,roughness:0.08,transmission:0.8}));
      jet.position.set(0,waterY+0.35,0); grp.add(jet);
      const crown=new THREE.Mesh(new THREE.SphereGeometry(0.16,12,10),
        new THREE.MeshPhysicalMaterial({color:0xd8f2ff,transparent:true,opacity:0.65,roughness:0.08,transmission:0.8}));
      crown.position.set(0,waterY+0.75,0); grp.add(crown);
    }
    if(p.cover){
      const cv=new THREE.Mesh(!oval&&!kidney?new THREE.PlaneGeometry(W,D):new THREE.CircleGeometry(0.5,24),
        new THREE.MeshStandardMaterial({color:0x807357,roughness:0.92}));
      if(oval||kidney){ cv.scale.set(W, D, 1); }
      cv.rotation.x=-Math.PI/2; cv.position.set(0,rimH+0.02,0); grp.add(cv);
    }
    grp.traverse(o=>{ if(o.isMesh) o.userData.sel={type:'pool',floor:floorIdx,id:p.id}; });
    g.add(grp);
  }

  buildWall(g, w, openings, baseY, floorIdx, isActive, dim){
    const THREE=this.THREE, H=this.helpers();
    const dx=w.x2-w.x1, dz=w.z2-w.z1;
    const L=Math.hypot(dx,dz); if(L<1e-6) return;
    const ux=dx/L, uz=dz/L;
    const t=w.t||0.15, h=w.h||2.7;
    const ang=-Math.atan2(dz,dx);
    const finMat=(f,fb)=>{
      const F=(f&&f.tex&&FINISH_MAP[f.tex])||null;
      return H.tmat((f&&f.color)||(F&&F.base)||fb||w.color||'#e8e4da', (F&&F.tex)||'wallpaint', Math.max(2,Math.round(L/1.5)), 1, 0.92);
    };
    const wallMat=finMat(w.finish);
    const split=w.split&&w.split.h>0.15&&w.split.h<(h-0.15)?w.split:null;
    const botMat=split?finMat(split.bottom):wallMat;
    const topMat=split?finMat(split.top):wallMat;
    const trimMat=H.mat('#f7f4ec',0.52);
    const nx=-uz, nz=ux;
    const at=(offAlong,side,y)=>[w.x1+ux*offAlong+nx*side, baseY+y, w.z1+uz*offAlong+nz*side];

    const mk=(len,hSeg,tSeg,offAlong,yC,material)=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(len,hSeg,tSeg), material||wallMat);
      const px=w.x1+ux*offAlong, pz=w.z1+uz*offAlong;
      m.position.set(px, baseY+yC, pz);
      m.rotation.y=ang;
      m.castShadow=this.shadows; m.receiveShadow=true;
      m.userData.sel={type:'wall',floor:floorIdx,id:w.id};
      g.add(m); this.wallMeshes.push(m);
      return m;
    };

    const strip=(len2,yC,hgt,dep,offAlong,material)=>{
      for(const s of [1,-1]){
        const m=new THREE.Mesh(new THREE.BoxGeometry(len2,hgt,dep), material||trimMat);
        const [px,py,pz]=at(offAlong, s*(t/2+dep/2-0.008), yC);
        m.position.set(px,py,pz); m.rotation.y=ang;
        m.castShadow=this.shadows; m.receiveShadow=true; g.add(m);
      }
    };

    const ops=[...openings].sort((a,b)=>a.at-b.at);
    let edges=[0];
    for(const o of ops){
      const c=o.at*L, hw=o.w/2;
      edges.push(Math.max(0,c-hw), Math.min(L,c+hw));
    }
    edges.push(L);
    edges=[...new Set(edges.map(v=>+v.toFixed(4)))].sort((a,b)=>a-b);

    const inOpening=(a,b)=>{
      const mid=(a+b)/2;
      for(const o of ops){ const c=o.at*L,hw=o.w/2; if(mid>c-hw-1e-6&&mid<c+hw+1e-6) return o; }
      return null;
    };

    for(let i=0;i<edges.length-1;i++){
      const a=edges[i], b=edges[i+1]; if(b-a<1e-4) continue;
      const o=inOpening(a,b);
      const segFull=(len,hh,tt,off,yc,mat)=>mk(len,hh,tt,off,yc,mat);
      if(!o){
        if(!split){ segFull(b-a, h, t, (a+b)/2, h/2, wallMat); }
        else {
          const sh=split.h;
          segFull(b-a, sh, t, (a+b)/2, sh/2, botMat);
          segFull(b-a, h-sh, t, (a+b)/2, sh+(h-sh)/2, topMat);
          strip(b-a, sh, 0.09, 0.05, (a+b)/2);
        }
        strip(b-a, 0.055, 0.11, 0.025, (a+b)/2); strip(b-a, h-0.05, 0.1, 0.045, (a+b)/2);
      }
      else {
        const sill=o.sill||0, oh=o.h||2;
        if(sill>0.01) mk(b-a, sill, t, (a+b)/2, sill/2, split&&sill<=split.h?botMat:wallMat);
        const top=sill+oh;
        if(top<h-0.01){ mk(b-a, h-top, t, (a+b)/2, top+(h-top)/2, split&&top>=split.h?topMat:wallMat); strip(b-a, h-0.05, 0.1, 0.045, (a+b)/2); }

        const mid=(a+b)/2;
        const px=w.x1+ux*mid, pz=w.z1+uz*mid;
        const frameMat=H.mat('#f4f1e8',0.48);
        if(o.kind==='door'){
          for(const e of [a+0.035,b-0.035]){
            const jm=new THREE.Mesh(new THREE.BoxGeometry(0.07,oh,t+0.07),frameMat);
            const jx=w.x1+ux*e, jz=w.z1+uz*e;
            jm.position.set(jx,baseY+sill+oh/2,jz); jm.rotation.y=ang; jm.castShadow=this.shadows; g.add(jm);
          }
          const hd=new THREE.Mesh(new THREE.BoxGeometry((b-a)+0.1,0.09,t+0.09),frameMat);
          hd.position.set(px,baseY+sill+oh+0.02,pz); hd.rotation.y=ang; hd.castShadow=this.shadows; g.add(hd);

          const doorG=new THREE.Group();
          const slabP=new THREE.Mesh(new THREE.BoxGeometry((b-a)*0.94,oh*0.985,0.045),
            H.tmat(o.color||'#8a5a33','oak',1,1,0.55));
          slabP.castShadow=this.shadows; doorG.add(slabP);
          for(const py of [-oh*0.22,oh*0.22]){
            const inset=new THREE.Mesh(new THREE.BoxGeometry((b-a)*0.62,oh*0.3,0.02),H.mat('#6e4525',0.55));
            inset.position.set(0,py,0.02); doorG.add(inset);
            const inset2=inset.clone(); inset2.position.z=-0.02; doorG.add(inset2);
          }
          const knob=new THREE.Mesh(new THREE.SphereGeometry(0.035,12,10),H.mat('#d8b25a',0.25,0.95));
          knob.position.set((b-a)*0.32,0,0.05); doorG.add(knob);
          doorG.position.set(px,baseY+sill+oh/2,pz); doorG.rotation.y=ang+0.5;
          doorG.traverse(m2=>{ m2.userData.sel={type:'opening',floor:floorIdx,id:o.id}; });
          g.add(doorG);
        } else if(o.kind==='window'){
          const fw2=(b-a), fdep=t+0.1;
          for(const e of [a+0.03,b-0.03]){
            const jm=new THREE.Mesh(new THREE.BoxGeometry(0.06,oh,fdep),frameMat);
            jm.position.set(w.x1+ux*e,baseY+sill+oh/2,w.z1+uz*e); jm.rotation.y=ang; g.add(jm);
          }
          const hd=new THREE.Mesh(new THREE.BoxGeometry(fw2+0.08,0.07,fdep),frameMat);
          hd.position.set(px,baseY+sill+oh+0.01,pz); hd.rotation.y=ang; hd.castShadow=this.shadows; g.add(hd);
          const gl=H.glass(g,fw2*0.94,oh*0.92,0.02,0,0,0,0.22,'#cfe4ff');
          gl.position.set(px,baseY+sill+oh/2,pz); gl.rotation.y=ang;
          gl.userData.sel={type:'opening',floor:floorIdx,id:o.id};

          const mv=new THREE.Mesh(new THREE.BoxGeometry(0.025,oh*0.92,0.035),frameMat);
          mv.position.copy(gl.position); mv.rotation.y=ang; g.add(mv);
          const mh=new THREE.Mesh(new THREE.BoxGeometry(fw2*0.94,0.025,0.035),frameMat);
          mh.position.copy(gl.position); mh.rotation.y=ang; g.add(mh);
          const sillM=new THREE.Mesh(new THREE.BoxGeometry(fw2+0.14,0.06,t+0.16),frameMat);
          sillM.position.set(px,baseY+sill-0.03,pz); sillM.rotation.y=ang; sillM.castShadow=this.shadows; g.add(sillM);
          const apron=new THREE.Mesh(new THREE.BoxGeometry(fw2*0.7,0.09,0.03),frameMat);
          const [apx,apy,apz]=at(mid,t/2+0.02,sill-0.1);
          apron.position.set(apx,apy,apz); apron.rotation.y=ang; g.add(apron);
        } else {
          for(const e of [a+0.03,b-0.03]){
            const jm=new THREE.Mesh(new THREE.BoxGeometry(0.06,oh,t+0.06),frameMat);
            jm.position.set(w.x1+ux*e,baseY+sill+oh/2,w.z1+uz*e); jm.rotation.y=ang; g.add(jm);
          }
          const hd=new THREE.Mesh(new THREE.BoxGeometry((b-a)+0.08,0.08,t+0.08),frameMat);
          hd.position.set(px,baseY+sill+oh+0.01,pz); hd.rotation.y=ang; hd.castShadow=this.shadows; g.add(hd);
        }
      }
    }
  }

  highlight(){
    if(!this.ready) return;
    const THREE=this.THREE;
    if(this._hl){ this.scene.remove(this._hl); this._hl.geometry?.dispose?.(); this._hl=null; }
    const sel=this.app.sel; if(!sel) return;
    let obj=null;
    if(sel.type==='item') obj=this.itemRoots.get(sel.id);
    else {
      this.scene.traverse(o=>{ if(!obj && o.userData.sel && o.userData.sel.type===sel.type && o.userData.sel.id===sel.id) obj=o; });
    }
    if(!obj) return;
    const box=new THREE.Box3().setFromObject(obj);
    const size=new THREE.Vector3(); box.getSize(size);
    const ctr=new THREE.Vector3(); box.getCenter(ctr);
    const geo=new THREE.BoxGeometry(Math.max(0.2,size.x+0.15),Math.max(0.2,size.y+0.15),Math.max(0.2,size.z+0.15));
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({color:0xffffff}));
    edges.position.copy(ctr);
    this.scene.add(edges); this._hl=edges;
  }

  screenshot(){
    if(!this.ready) return null;
    this.renderer.render(this.scene,this.camera);
    return this.cv.toDataURL('image/png');
  }

  toggleIx(it,tag){
    if(!it||it.locked) return false;
    this.app.pushUndo();
    it.ui=it.ui||{};
    // flip the *effective* state: an untouched lamp/flicker burns by default,
    // so the first tap must snuff it (set 0), not redundantly set 1.
    let cur;
    if(tag in it.ui) cur=it.ui[tag]?1:0;
    else {
      // def-level ix entries only carry tag+label; the live anim holds the kind
      const a=(this.ixAnims||[]).find(v=>v.it===it&&v.spec.tag===tag);
      const kind=a?a.spec.kind:'screen';
      cur=(kind==='lamp'||kind==='flicker')?1:0;
    }
    it.ui[tag]=cur?0:1;
    this.blip(it.ui[tag]?660:440);
    this.app.view2d?.request();
    this.app.live();
    return true;
  }

  blip(f=600){
    try{
      this._ac=this._ac||new (window.AudioContext||window.webkitAudioContext)();
      const a=this._ac; if(a.state==='suspended') a.resume();
      const o=a.createOscillator(), g=a.createGain();
      o.type='sine'; o.frequency.value=f;
      g.gain.setValueAtTime(0.06,a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001,a.currentTime+0.12);
      o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime+0.13);
    }catch(e){}
  }

  loop(){
    if(!this.ready) return;
    let last=performance.now(), frames=0, t0=performance.now();
    const tick=()=>{
      if(!this.renderer) return;
      const now=performance.now(); const dt=Math.min(0.05,(now-last)/1000); last=now;
      frames++; if(now-t0>800){
        this.fps=Math.round(frames*1000/(now-t0)); frames=0; t0=now;
        const el=document.querySelector('#fpsChip'); if(el) el.textContent=this.fps+' fps';
        try{ this.autoTick(); }catch(e){}
      }
      if(this.mode==='orbit'){ this.controls.update(); }
      else { this.stepWalk(dt); }

      try{
        const t=now/1000;
        for(const tx of this.waterTexs){ tx.offset.x=(t*0.03)%1; tx.offset.y=(Math.sin(t*0.5)*0.05); }
        for(const s of this.swayMeshes){ s.m.rotation.z=s.base+Math.sin(t*1.4+s.ph)*0.035; }
        for(const a of this.ixAnims){
          const has=!!(a.it.ui&&(a.spec.tag in a.it.ui));
          const tgt=has?(a.it.ui[a.spec.tag]?1:0):((a.spec.kind==='lamp'||a.spec.kind==='flicker')?1:0);
          if(a.spec.kind==='spin'){ if(tgt>0.5) a.node.rotation.y+=dt*7; continue; }
          if(a.spec.kind==='flicker'){
            // candle flame: smooth on/off + continuous flame-noise flicker while burning
            a.cur+=(tgt-a.cur)*Math.min(1,dt*7);
            if(Math.abs(a.cur-tgt)<0.01) a.cur=tgt;
            if(a.cur<0.01&&tgt===0&&a._init) continue; // snuffed out — stay dark
            const n=Math.sin(t*11+a.ph)*0.5+Math.sin(t*23.7+a.ph*1.7)*0.3+Math.sin(t*5.3+a.ph*0.6)*0.2;
            const fl=0.8+0.2*n;
            if(a.light) a.light.intensity=a.cur*a.I*fl;
            if(a.mat) a.mat.emissiveIntensity=0.05+a.cur*(1.8+1.1*n);
            const bs=a.baseScale||{x:1,y:1,z:1}, s=Math.max(0.001,a.cur)*(1+0.06*n);
            a.node.scale.set(bs.x*s,bs.y*Math.max(0.001,a.cur)*(1+0.12*n),bs.z*s);
            a._init=true; continue;
          }
          if(a.cur===tgt&&a._init) continue;
          a.cur+=(tgt-a.cur)*Math.min(1,dt*7);
          if(Math.abs(a.cur-tgt)<0.01) a.cur=tgt;
          if(a.spec.kind==='hinge') a.node.rotation[a.spec.axis||'y']=a.baseRot+a.cur*(a.spec.angle??1.5);
          else if(a.spec.kind==='slide') a.node.position[a.spec.axis||'z']=a.basePos+a.cur*(a.spec.dist??0.25);
          else if(a.spec.kind==='lamp'){ if(a.light) a.light.intensity=a.cur*a.I; if(a.mat) a.mat.emissiveIntensity=0.08+a.cur*2.2; }
          else if(a.spec.kind==='screen'){ if(a.mat) a.mat.emissiveIntensity=0.08+a.cur*2.6; }
          a._init=true;
        }
      }catch(e){}

      this.renderer.render(this.scene,this.camera);
      requestAnimationFrame(tick);
    };
    tick();
  }

  autoTick(){
    const s=this.app.state.settings, order=['performance','balanced','high','ultra'];
    this._highT=this._highT||0;
    if(s.autoQuality===false){
      if(this.effQ!==s.quality){ this.effQ=s.quality; this.applyGraphics(); this.rebuildSoon(); }
      const st=document.querySelector('#fpsNow'); if(st) st.textContent=this.fps+' fps • '+s.quality;
      return;
    }
    let lvl=order.indexOf(this.effQ||s.quality); if(lvl<0) lvl=1;
    const userLvl=Math.max(0,order.indexOf(s.quality));
    if((this.fps||60)<27&&lvl>0){
      this.effQ=order[lvl-1]; this._highT=0;
      this.applyGraphics(); this.rebuildSoon();
    } else if((this.fps||0)>57&&lvl<userLvl){
      if(++this._highT>=3){ this.effQ=order[lvl+1]; this._highT=0; this.applyGraphics(); this.rebuildSoon(); }
    } else this._highT=0;
    const st=document.querySelector('#fpsNow');
    if(st) st.textContent=this.fps+' fps • '+(this.effQ||s.quality)+(this.effQ!==s.quality?' (auto)':'');
  }

  stepWalk(dt){
    const s=3.2*dt;
    const k=this.walk.keys, j=this.walk.joy;
    let f=0,r=0;
    if(k.has('w')||k.has('arrowup'))f+=1; if(k.has('s')||k.has('arrowdown'))f-=1;
    if(k.has('a')||k.has('arrowleft'))r-=1; if(k.has('d')||k.has('arrowright'))r+=1;
    f+= -j.y; r+= j.x;
    const yaw=this.walk.yaw;
    const fx=-Math.sin(yaw), fz=-Math.cos(yaw);
    const rx=Math.cos(yaw), rz=-Math.sin(yaw);
    this.camera.position.x+=(fx*f+rx*r)*s;
    this.camera.position.z+=(fz*f+rz*r)*s;

    const st=this.app.state; if(st){
      const fl=st.floors[st.activeFloor]; const sl=fl.slab||{w:12,d:10,cx:0,cz:0};
      const m=14;
      this.camera.position.x=Math.max((sl.cx||0)-m,Math.min((sl.cx||0)+m,this.camera.position.x));
      this.camera.position.z=Math.max((sl.cz||0)-m,Math.min((sl.cz||0)+m,this.camera.position.z));
      const gy=floorTopY(st,st.activeFloor)+this.walk.eye;
      this.camera.position.y+= (gy-this.camera.position.y)*Math.min(1,dt*6);
    }
    this.applyWalkCam();
  }
  findObject3D(id){ return this.itemRoots.get(id)||null; }
  applyItemOverrides(item, floorIdx, obj) {
    if (!this.ready) return;
    obj = obj || this.findObject3D(item.id);
    if (!obj) return;
    const ovs = item.matOverrides || {};
    const THREE = this.THREE;

    obj.traverse(child => {
      if (!child.isMesh) return;
      const conf = ovs[child.name] || ovs['__all__'];
      if (!conf) return;

      if (!child._origMaterial) child._origMaterial = child.material;
      if (child.material === child._origMaterial) {
        child.material = child._origMaterial.clone();
      }
      const mat = child.material;

      if (conf.color) mat.color.set(conf.color);
      if (conf.roughness !== undefined) mat.roughness = conf.roughness;
      if (conf.metalness !== undefined) mat.metalness = conf.metalness;
      if (conf.clearcoat !== undefined) mat.clearcoat = conf.clearcoat;
      if (conf.transmission !== undefined) {
        mat.transmission = conf.transmission;
        mat.transparent = true;
      }

      if (conf.textureUrl) {
        if (!child._loadedTex || child._loadedTexUrl !== conf.textureUrl) {
          const loader = new THREE.TextureLoader();
          loader.load(conf.textureUrl, (tex) => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(conf.repeatX || 2, conf.repeatY || 2);
            tex.rotation = conf.rotation || 0;
            mat.map = tex;
            mat.needsUpdate = true;
            child._loadedTex = tex;
            child._loadedTexUrl = conf.textureUrl;
          });
        } else {
          child._loadedTex.repeat.set(conf.repeatX || 2, conf.repeatY || 2);
          child._loadedTex.rotation = conf.rotation || 0;
          mat.needsUpdate = true;
        }
      } else if (!conf.textureUrl && mat.map) {
        mat.map = null;
        mat.needsUpdate = true;
      }

      mat.needsUpdate = true;
    });
  }
}