// HomeCraft store: floors -> infinity, walls, openings, items. Autosave to localStorage.
export const LS_KEY = 'homecraft3d.save.v2';
export const LS_CUSTOM = 'homecraft3d.custom.v2';
export const LS_PROJ = 'homecraft3d.projects.v1';
export const LS_CUR = 'homecraft3d.current.v1';
const projKey=id=>'homecraft3d.house.'+id;

export function uid(p='id'){ return p+'_'+Math.random().toString(36).slice(2,9); }

export function defaultFloor(name, idx){
  return {
    id: uid('f'), name: name || (idx===0?'Ground Floor':`Floor ${idx+1}`),
    wallHeight: 2.7,
    slab: { w: 12, d: 10, cx: 0, cz: 0, thick: 0.25 },
    walls: [], openings: [], items: [], zones: [], pools: [], paints: [], rooms: []
  };
}
// Make any loaded/imported/older state safe for the renderers + tools:
// every floor gets all entity arrays, a slab, and a clamped activeFloor.
export function normalizeState(st){
  if(!st || typeof st!=='object') return null;
  if(!Array.isArray(st.floors) || !st.floors.length) return null;
  st.settings = st.settings && typeof st.settings==='object' ? st.settings : {};
  for(const fl of st.floors){
    if(!fl || typeof fl!=='object') continue;
    if(!Array.isArray(fl.walls)) fl.walls=[];
    if(!Array.isArray(fl.openings)) fl.openings=[];
    if(!Array.isArray(fl.items)) fl.items=[];
    if(!Array.isArray(fl.zones)) fl.zones=[];
    if(!Array.isArray(fl.pools)) fl.pools=[];
    if(!Array.isArray(fl.paints)) fl.paints=[];
    if(!Array.isArray(fl.rooms)) fl.rooms=[];
    if(!fl.slab || typeof fl.slab!=='object') fl.slab={w:12,d:10,cx:0,cz:0,thick:0.25};
    if(typeof fl.wallHeight!=='number' || !isFinite(fl.wallHeight)) fl.wallHeight=2.7;
  }
  if(typeof st.activeFloor!=='number' || !(st.activeFloor>=0) || st.activeFloor>=st.floors.length) st.activeFloor=0;
  return st;
}

export function demoState(){
  const f = defaultFloor('Ground Floor', 0);
  // 10 x 7 house centered
  const x0=-5, x1=5, z0=-3.5, z1=3.5;
  const t=0.15, h=2.7;
  const w1={id:uid('w'),x1:x0,z1:z0,x2:x1,z2:z0,h,t,color:'#e8e4da'};
  const w2={id:uid('w'),x1:x1,z1:z0,x2:x1,z2:z1,h,t,color:'#e8e4da'};
  const w3={id:uid('w'),x1:x1,z1:z1,x2:x0,z2:z1,h,t,color:'#e8e4da'};
  const w4={id:uid('w'),x1:x0,z1:z1,x2:x0,z2:z0,h,t,color:'#e8e4da'};
  const mid={id:uid('w'),x1:1.5,z1:z0,x2:1.5,z2:z1,h,t,color:'#dfd9cc'};
  f.walls=[w1,w2,w3,w4,mid];
  f.slab={w:12,d:10,cx:0,cz:0,thick:0.25};
  f.openings=[
    {id:uid('o'),wallId:w1.id,at:0.5,w:1.0,h:2.1,sill:0,kind:'door',color:'#8a5a33'},
    {id:uid('o'),wallId:w2.id,at:0.35,w:1.4,h:1.1,sill:0.9,kind:'window',color:'#9fc7ff'},
    {id:uid('o'),wallId:w3.id,at:0.5,w:1.6,h:1.1,sill:0.9,kind:'window',color:'#9fc7ff'},
    {id:uid('o'),wallId:mid.id,at:0.5,w:0.9,h:2.0,sill:0,kind:'door',color:'#8a5a33'},
  ];
  f.items=[
    {id:uid('i'),defId:'sofa3',x:-2.2,z:1.4,rot:180,scale:1},
    {id:uid('i'),defId:'coffee',x:-2.2,z:-0.2,rot:0,scale:1},
    {id:uid('i'),defId:'tvstand',x:-2.2,z:-2.6,rot:0,scale:1},
    {id:uid('i'),defId:'dining_rect',x:-2.6,z:-0.2+0,rot:0,scale:1},
    {id:uid('i'),defId:'bed_double',x:3.2,z:1.8,rot:180,scale:1},
    {id:uid('i'),defId:'fridge',x:3.8,z:-2.6,rot:180,scale:1},
    {id:uid('i'),defId:'stove',x:2.6,z:-2.6,rot:180,scale:1},
    {id:uid('i'),defId:'toilet',x:3.2,z:0.2,rot:180,scale:1},
    {id:uid('i'),defId:'tree',x:-7.5,z:4.5,rot:0,scale:1},
    {id:uid('i'),defId:'patio_set',x:0,z:5.2,rot:0,scale:1},
  ];
  // fix dining pos to living side
  f.items.find(i=>i.defId==='dining_rect').x=-2.4; f.items.find(i=>i.defId==='dining_rect').z=-0.1;
  const f2 = defaultFloor('First Floor',1);
  f2.slab={w:12,d:10,cx:0,cz:0,thick:0.25};
  const b0={id:uid('w'),x1:x0,z1:z0,x2:x1,z2:z0,h,t,color:'#e8e4da'};
  const b1={id:uid('w'),x1:x1,z1:z0,x2:x1,z2:z1,h,t,color:'#e8e4da'};
  const b2={id:uid('w'),x1:x1,z1:z1,x2:x0,z2:z1,h,t,color:'#e8e4da'};
  const b3={id:uid('w'),x1:x0,z1:z1,x2:x0,z2:z0,h,t,color:'#e8e4da'};
  f2.walls=[b0,b1,b2,b3];
  f2.openings=[{id:uid('o'),wallId:b1.id,at:0.5,w:1.4,h:1.1,sill:0.9,kind:'window',color:'#9fc7ff'}];
  f2.items=[
    {id:uid('i'),defId:'bed_king',x:-2,z:0,rot:0,scale:1},
    {id:uid('i'),defId:'wardrobe',x:2.5,z:-2.8,rot:0,scale:1},
    {id:uid('i'),defId:'pool_table',x:-1.5,z:0.5,rot:0,scale:1},
  ];
  return {
    version:2, floors:[f,f2], activeFloor:0,
    settings:{ snap:0.25, gridSize:30, wallThickness:0.15, wallHeightDefault:2.7, showAll3D:true, shadows:false }
  };
}

export function blankState(){
  // Start with an open building plot: no walls, doors, windows, or furniture.
  // Keep a broad, plain ground slab so the user can build from a clean field.
  const f = defaultFloor('Ground Floor',0);
  f.slab = { w:20, d:20, cx:0, cz:0, thick:0.25 };
  return { version:2, floors:[f], activeFloor:0,
    settings:{ snap:0.25, gridSize:30, wallThickness:0.15, wallHeightDefault:2.7, showAll3D:true, shadows:false } };
}

export function floorBaseY(state, idx){
  let y=0;
  for(let i=0;i<idx;i++){ y += (state.floors[i].wallHeight||2.7) + (state.floors[i].slab?.thick||0.25); }
  return y;
}export function floorTopY(state, idx){
  return floorBaseY(state,idx) + (state.floors[idx].slab?.thick||0.25);
}
// Vertical distance from the top of floor `idx` to the top of the floor above.
// Used to auto-size stairs so they land on the next floor. Top floor (no floor
// above) assumes a future floor with the same wall height + a standard slab.
export function nextFloorRise(state, idx){
  const cur=state.floors[idx]; if(!cur) return 2.95;
  if(state.floors[idx+1]) return +((floorTopY(state,idx+1)-floorTopY(state,idx)).toFixed(2));
  return +(((cur.wallHeight||2.7)+0.25).toFixed(2));
}

export function saveState(state){
  try{
    const slim={...state};
    localStorage.setItem(LS_KEY, JSON.stringify(slim));
    try{
      const pid=getCurrentPid();
      if(pid){ localStorage.setItem(projKey(pid), JSON.stringify(slim)); touchProject(pid); }
    }catch(e){}
  }catch(e){ console.warn('save fail',e); }
}
// ---------- multi-project library (house states per project; custom models stay global) ----------
export function listProjectsMeta(){
  try{
    const m=JSON.parse(localStorage.getItem(LS_PROJ)||'null');
    if(m&&m.order&&m.meta) return m;
  }catch(e){}
  return null;
}
export function saveProjectsMeta(m){ try{ localStorage.setItem(LS_PROJ,JSON.stringify(m)); }catch(e){} }
export function getCurrentPid(){ try{ return localStorage.getItem(LS_CUR)||null; }catch(e){ return null; } }
export function setCurrentPid(id){ try{ localStorage.setItem(LS_CUR,id); }catch(e){} }
export function ensureProjects(fallbackState){
  let m=listProjectsMeta();
  if(m&&m.order.length&&m.meta[m.current]) return m;
  // migrate legacy single save into the first project
  let legacy=null;
  try{ const s=localStorage.getItem(LS_KEY); if(s){ const st=JSON.parse(s); if(st&&st.floors&&st.floors.length) legacy=st; } }catch(e){}
  const base=legacy||fallbackState||null;
  const id=uid('p');
  m={current:id,order:[id],meta:{}};
  m.meta[id]={name:'My House',updatedAt:Date.now()};
  saveProjectsMeta(m); setCurrentPid(id);
  if(base){ try{ localStorage.setItem(projKey(id),JSON.stringify(base)); }catch(e){} }
  return m;
}
export function loadProjectState(id){
  try{
    const s=localStorage.getItem(projKey(id));
    if(!s) return null;
    const st=JSON.parse(s);
    if(!st.floors||!st.floors.length) return null;
    return normalizeState(st);
  }catch(e){ return null; }
}
export function touchProject(id){
  try{
    const m=listProjectsMeta(); if(!m||!m.meta[id]) return;
    m.meta[id].updatedAt=Date.now(); saveProjectsMeta(m);
  }catch(e){}
}
export function createProject(name,baseState){
  const m=listProjectsMeta()||{current:null,order:[],meta:{}};
  const id=uid('p');
  m.order.push(id); m.meta[id]={name:(name||'House '+(m.order.length)).slice(0,40),updatedAt:Date.now()};
  m.current=id;
  saveProjectsMeta(m); setCurrentPid(id);
  if(baseState){ try{ localStorage.setItem(projKey(id),JSON.stringify(baseState)); }catch(e){} }
  return id;
}
export function renameProject(id,name){
  const m=listProjectsMeta(); if(!m||!m.meta[id]) return false;
  m.meta[id].name=(name||'House').slice(0,40); m.meta[id].updatedAt=Date.now();
  saveProjectsMeta(m); return true;
}
export function duplicateProject(id){
  const m=listProjectsMeta(); if(!m||!m.meta[id]) return null;
  const st=loadProjectState(id)||null;
  const nid=uid('p');
  m.order.push(nid);
  m.meta[nid]={name:(m.meta[id].name+' copy').slice(0,40),updatedAt:Date.now()};
  saveProjectsMeta(m);
  if(st){ try{ localStorage.setItem(projKey(nid),JSON.stringify(st)); }catch(e){} }
  return nid;
}
export function deleteProject(id){
  const m=listProjectsMeta(); if(!m||!m.meta[id]) return false;
  if(m.order.length<=1) return false; // keep at least one house
  m.order=m.order.filter(x=>x!==id); delete m.meta[id];
  try{ localStorage.removeItem(projKey(id)); }catch(e){}
  if(m.current===id){ m.current=m.order[0]; setCurrentPid(m.current); }
  saveProjectsMeta(m); return true;
}
export function currentProjectState(fallbackState){
  ensureProjects(fallbackState);
  const pid=getCurrentPid();
  return {pid, state:loadProjectState(pid)||fallbackState};
}
export function loadState(){
  try{
    const s=localStorage.getItem(LS_KEY);
    if(!s) return null;
    const st=JSON.parse(s);
    if(!st.floors||!st.floors.length) return null;
    return normalizeState(st);
  }catch(e){ return null; }
}
export function loadCustom(){
  try{ return JSON.parse(localStorage.getItem(LS_CUSTOM)||'[]'); }catch(e){ return []; }
}export function saveCustom(list){
  try{ localStorage.setItem(LS_CUSTOM, JSON.stringify(list)); }catch(e){ console.warn('custom save fail - too big?', e); }
}

// ---------- decor upgrade: wall/shelf attachment geometry (pure helpers) ----------
export function wallLen(w){ return Math.hypot(w.x2-w.x1, w.z2-w.z1); }
export function wallFrame(w){
  const L=wallLen(w)||1e-6;
  const ux=(w.x2-w.x1)/L, uz=(w.z2-w.z1)/L;
  return { L, ux, uz, nx:-uz, nz:ux };
}
export function projectOnWall(w,x,z){
  const {L,ux,uz,nx,nz}=wallFrame(w);
  const dx=x-w.x1, dz=z-w.z1;
  return { along:Math.max(0,Math.min(L,dx*ux+dz*uz)), side:(dx*nx+dz*nz)>=0?1:-1 };
}
export function wallPoint(w,along,side,off){
  const {ux,uz,nx,nz}=wallFrame(w);
  return { x:w.x1+ux*along+nx*side*off, z:w.z1+uz*along+nz*side*off };
}
function raySeg(px,pz,dx,dz,ax,az,bx,bz){
  const ex=bx-ax, ez=bz-az;
  const den=dx*ez-dz*ex;
  if(Math.abs(den)<1e-9) return -1;
  const t=((ax-px)*ez-(az-pz)*ex)/den;
  const s=((ax-px)*dz-(az-pz)*dx)/den;
  return (t>0&&s>=0&&s<=1)?t:-1;
}
// smallest enclosing "room" rect around a point: cast 4 axis rays at wall segments (else slab)
export function roomRectAt(fl,x,z,slab){
  let x0=-1e9,x1=1e9,z0=-1e9,z1=1e9;
  const dirs=[[1,0,'x1'],[-1,0,'x0'],[0,1,'z1'],[0,-1,'z0']];
  for(const [dx,dz,key] of dirs){
    let best=1e9;
    for(const w of (fl.walls||[])){
      const t=raySeg(x,z,dx,dz,w.x1,w.z1,w.x2,w.z2);
      if(t>0&&t<best) best=t;
    }
    if(best>1e8&&slab){
      if(key==='x1') best=(slab.cx+slab.w/2)-x;
      if(key==='x0') best=x-(slab.cx-slab.w/2);
      if(key==='z1') best=(slab.cz+slab.d/2)-z;
      if(key==='z0') best=z-(slab.cz-slab.d/2);
    }
    if(best<1e8){
      if(key==='x1') x1=x+best; if(key==='x0') x0=x-best;
      if(key==='z1') z1=z+best; if(key==='z0') z0=z-best;
    }
  }
  if(x0>x1||z0>z1) return null;
  return {x0,x1,z0,z1};
}
export function wallsInRect(fl,rect,pad=0.35){
  return (fl.walls||[]).filter(w=>{
    const mx=(w.x1+w.x2)/2, mz=(w.z1+w.z2)/2;
    return mx>rect.x0-pad&&mx<rect.x1+pad&&mz>rect.z0-pad&&mz<rect.z1+pad;
  });
}
// Resolve cached x/z/rot/y for wall-mounted + shelf-child items. Call after any wall/item change.
export function resolveAttachments(fl,defOf){
  if(!fl||!fl.items) return;
  const byId=new Map(fl.items.map(i=>[i.id,i]));
  // drop dangling attachments (keep floor pose)
  for(const it of fl.items){
    if(it.mount && !byId.get(it.mount.wallId) && !fl.walls.find(w=>w.id===it.mount.wallId)) delete it.mount;
    if(it.on){
      const p=byId.get(it.on.parentId);
      if(!p||p.on) delete it.on;
    }
  }
  // wall-mounted first
  for(const it of fl.items){
    if(!it.mount) continue;
    const w=fl.walls.find(v=>v.id===it.mount.wallId);
    const def=defOf(it)||{w:0.5,d:0.1,h:0.5};
    if(!w){ delete it.mount; continue; }
    const {L,ux,uz,nx,nz}=wallFrame(w);
    const sc=it.scale||1;
    const hw=(def.w*sc)/2;
    const maxAlong=Math.max(hw+0.03, L-hw-0.03);
    it.mount.along=Math.max(hw+0.03, Math.min(maxAlong, it.mount.along==null?L/2:it.mount.along));
    const wh=w.h||2.7, ih=def.h*sc;
    it.mount.y=Math.max(ih/2+0.03, Math.min(wh-0.05, it.mount.y==null?1.6:it.mount.y));
    if(!it.mount.side) it.mount.side=1;
    const off=(w.t||0.15)/2 + (def.d*sc)/2 - 0.015;
    const p=wallPoint(w,it.mount.along,it.mount.side,off);
    it.x=+p.x.toFixed(3); it.z=+p.z.toFixed(3);
    it.rot=+((Math.atan2(nx*it.mount.side,nz*it.mount.side)*180/Math.PI).toFixed(1));
    it.y=+(it.mount.y-ih/2).toFixed(3);
  }
  // shelf children (parents resolved above / floor items as-is)
  for(const it of fl.items){
    if(!it.on) continue;
    const p=byId.get(it.on.parentId);
    if(!p){ delete it.on; continue; }
    const pdef=defOf(p)||{w:1,d:1,h:1};
    const slots=(pdef.shelves&&pdef.shelves.length?pdef.shelves:[{y:pdef.h,w:pdef.w*0.92,d:pdef.d*0.92,dx:0,dz:0}]);
    const s=slots[Math.max(0,Math.min(slots.length-1,it.on.shelf||0))];
    it.on.shelf=slots.indexOf(s);
    const sc=it.scale||1;
    const maxDx=Math.max(0,(s.w-(defOf(it)?.w||0.3)*sc)/2);
    const maxDz=Math.max(0,(s.d-(defOf(it)?.d||0.3)*sc)/2);
    it.on.dx=Math.max(-maxDx,Math.min(maxDx,it.on.dx||0));
    it.on.dz=Math.max(-maxDz,Math.min(maxDz,it.on.dz||0));
    const pr=(p.rot||0)*Math.PI/180;
    const lx=(s.dx||0)+it.on.dx, lz=(s.dz||0)+it.on.dz;
    it.x=+((p.x||0)+lx*Math.cos(pr)-lz*Math.sin(pr)).toFixed(3);
    it.z=+((p.z||0)+lx*Math.sin(pr)+lz*Math.cos(pr)).toFixed(3);
    it.rot=(((p.rot||0)+(it.on.rel||0))%360+360)%360;
    it.y=+(((p.y||0)+(pdef.lift||0)+s.y+(it.on.top||0))).toFixed(3);
  }
}
// stacking: top offset for a child given already-placed siblings on the same shelf
export function shelfStackTop(fl,parentId,shelf,dx,dz,def,scale,ignoreId){
  let top=0, blocked=false;
  const cw=(def.w||0.3)*(scale||1), cd=(def.d||0.3)*(scale||1);
  for(const o of fl.items){
    if(o.id===ignoreId||!o.on||o.on.parentId!==parentId||o.on.shelf!==shelf) continue;
    const od=o._defCache||{w:0.3,d:0.3,h:0.3};
    const ow=(od.w||0.3)*(o.scale||1), oh=(od.h||0.3)*(o.scale||1);
    if(Math.abs((o.on.dx||0)-dx)<(cw+ow)/2*0.75 && Math.abs((o.on.dz||0)-dz)<(cd+ow)/2*0.75){
      if(od.stack) top=Math.max(top,(o.on.top||0)+od.stack*(o.scale||1));
      else blocked=true;
    }
  }
  return {top,blocked};
}
