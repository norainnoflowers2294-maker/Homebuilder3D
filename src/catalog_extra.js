// Extra catalog: wall decor, shelving, small decor, plants, lighting, patio structures, landscaping.
// Builders use the same (g,T,H) signature as src/catalog.js (H = view3d helpers: box,tbox,mbox,cyl,glass,mat,tmat).
// Extra def fields: wallMount+mountH | shelves[{y,w,d,dx,dz}] | shelfable | stack | noTop | noTint
function pot(m){ m.userData.pot=true; return m; }
function sway(m,ph){ m.userData.sway=ph||Math.random()*6.28; return m; }
function glowAt(g,T,x,y,z,c,s){
  const m=new T.Mesh(new T.SphereGeometry(s||0.05,10,8), new T.MeshBasicMaterial({color:c||0xffe9b0}));
  m.position.set(x,y,z); g.add(m); return m;
}

const D=(id,cat,name,icon,w,d,h,build,extra={})=>({id,cat,name,icon,w,d,h,build,...extra});
const WM=h=>({wallMount:true,mountH:h==null?1.6:h});
const SH={shelfable:true};

// Shelf slots for EXISTING defs (local coords: y from base, w lateral, d depth, dx/dz slot center).
// (implicit top surface is added automatically for anything not in NOTOP)
export const SHELVES={
  bookshelf:[{y:0.42,w:1.05,d:0.3},{y:0.9,w:1.05,d:0.3},{y:1.38,w:1.05,d:0.3},{y:1.86,w:1.05,d:0.3}],
  pantry_shelf:[{y:0.33,w:1.05,d:0.4},{y:0.88,w:1.05,d:0.4},{y:1.43,w:1.05,d:0.4},{y:1.98,w:1.05,d:0.4}],
  tvstand:[{y:0.45,w:0.55,d:0.38,dx:-0.42},{y:0.45,w:0.55,d:0.38,dx:0.42}],
  sideboard:[{y:0.89,w:1.45,d:0.42}],
  shelfie:[{y:1.3,w:0.68,d:0.36},{y:1.54,w:0.68,d:0.36},{y:1.78,w:0.68,d:0.36}],
  wine_rack:[{y:1.82,w:0.9,d:0.28}],
  cabinet:[{y:0.86,w:1.85,d:0.55}],
  island:[{y:0.93,w:1.75,d:0.85}],
  sink:[{y:0.85,w:1.05,d:0.5}],
  dresser:[{y:0.87,w:1.3,d:0.42}],
  nightstand:[{y:0.55,w:0.38,d:0.32}],
  desk:[{y:0.75,w:1.05,d:0.45}],
  coffee:[{y:0.41,w:1.05,d:0.45},{y:0.15,w:0.95,d:0.35}],
  dining_rect:[{y:0.76,w:1.75,d:0.8}],
  dining_round:[{y:0.75,w:0.95,d:0.95}],
  bed_single:[{y:0.62,w:0.8,d:1.4,dz:0.2}],
  bed_double:[{y:0.62,w:1.3,d:1.4,dz:0.2}],
  bed_king:[{y:0.62,w:1.7,d:1.4,dz:0.2}],
  vanity:[{y:0.82,w:1.05,d:0.4}],
  freezer:[{y:0.88,w:1.0,d:0.5}],
  bar_counter:[{y:1.07,w:2.05,d:0.55}],
  fireplace:[{y:1.37,w:1.25,d:0.45}],
  bench:[{y:0.46,w:1.6,d:0.35}],
  freezer2:[], // placeholder guard
};

// defs that never offer the implicit top surface (rugs, hanging lights, outdoor ground cover, etc.)
export const NOTOP=new Set(['rug_round','rug_rect','pendant','chandelier','curtains','stairs_straight',
  'fence','tree','pool','car','lamp_post','dart','arcade','grill','patio_set','bush','planter',
  'toilet','bathtub','shower','bath_sink','wardrobe','fridge','stove','dishwasher','microwave',
  'chair','bar_stool','beer_tap','minibar','cue_rack','poker','pool_table','pantry_cab','jar_set']);

export function shelfSlots(def){
  const out=[];
  if(def.shelves) for(const s of def.shelves) out.push({y:s.y,w:s.w||def.w*0.9,d:s.d||def.d*0.9,dx:s.dx||0,dz:s.dz||0});
  else if(!NOTOP.has(def.id)) out.push({y:def.h,w:def.w*0.92,d:def.d*0.92,dx:0,dz:0,top:true});
  return out;
}

export const EXTRA=(()=>{ const L=[];
  // ================= WALL DECOR =================
  const frame=(w,h,art)=> (g,T,H)=>{
    H.tbox(g,w,h,0.05,'#3a2c1c','darkwood',1,1,0,h/2,0);
    H.box(g,w-0.1,h-0.1,0.055,'#f2eee4',0,h/2,0);
    H.tbox(g,w-0.16,h-0.16,0.06,art,'fabric',1,1,0,h/2,0);
  };
  L.push(D('frame_s','walldecor','Mini frame','🖼️',0.32,0.07,0.42,frame(0.32,0.42,'#7c9fd1'),{...WM(1.6)}));
  L.push(D('frame_m','walldecor','Wall art M','🖼️',0.62,0.08,0.82,frame(0.62,0.82,'#9dc98f'),{...WM(1.6)}));
  L.push(D('frame_l','walldecor','Canvas XL','🖼️',1.15,0.09,0.85,(g,T,H)=>{
    H.tbox(g,1.15,0.85,0.06,'#e8e2d4','fabric',2,1,0,0.43,0);
    H.tbox(g,0.95,0.65,0.07,'#b48ad9','fabric',1,1,-0.05,0.43,0);
    H.box(g,0.3,0.4,0.075,'#e8c05a',0.25,0.5,0);
  },{...WM(1.6)}));
  L.push(D('gallery','walldecor','Gallery wall','🖼️',1.7,0.1,1.05,(g,T,H)=>{
    const f=(x,y,w,h,c)=>{ H.box(g,w,h,0.05,'#2b2b30',x,y,0); H.box(g,w-0.07,h-0.07,0.055,c,x,y,0); };
    f(-0.55,0.62,0.5,0.62,'#7c9fd1'); f(0.05,0.66,0.62,0.5,'#e8a05a');
    f(0.62,0.6,0.4,0.5,'#9dc98f'); f(-0.3,0.18,0.55,0.34,'#d96a6a'); f(0.45,0.2,0.5,0.3,'#e8c05a');
  },{...WM(1.6)}));
  L.push(D('mirror_round','walldecor','Round mirror','🪞',0.62,0.07,0.62,(g,T,H)=>{
    const rim=new T.Mesh(new T.TorusGeometry(0.29,0.03,10,28),H.mat('#c9a227',0.35,0.85));
    rim.position.set(0,0.31,0); rim.castShadow=true; g.add(rim);
    H.glass(g,0.54,0.54,0.03,0,0.31,0,0.85,'#d8ecff');
  },{...WM(1.6)}));
  L.push(D('mirror_rect','walldecor','Mirror tall','🪞',0.7,0.07,1.4,(g,T,H)=>{
    H.tbox(g,0.7,1.4,0.05,'#3a3f4d','darkwood',1,1,0,0.7,0);
    H.glass(g,0.6,1.28,0.055,0,0.7,0,0.85,'#d8ecff');
  },{...WM(1.6)}));
  L.push(D('clock_wall','walldecor','Wall clock','🕐',0.42,0.07,0.42,(g,T,H)=>{
    H.cyl(g,0.2,0.2,0.05,'#2b2f38',0,0.21,0,24).rotation.x=Math.PI/2;
    H.cyl(g,0.17,0.17,0.055,'#f4f1ea',0,0.21,0,24).rotation.x=Math.PI/2;
    for(let i=0;i<12;i++){ const a=i/12*Math.PI*2;
      H.box(g,0.02,0.035,0.06,'#2b2f38',Math.cos(a)*0.14,0.21+Math.sin(a)*0.14,0); }
    H.box(g,0.015,0.1,0.065,'#b8352f',0,0.24,0).rotation.z=-0.5;
    H.box(g,0.015,0.14,0.065,'#2b2f38',0.03,0.22,0).rotation.z=-1.2;
  },{...WM(1.8)}));
  L.push(D('shelf_float','walldecor','Floating shelf','📏',1.2,0.26,0.07,(g,T,H)=>{
    H.tbox(g,1.2,0.06,0.26,'#ffffff','oak',2,1,0,0.03,0);
    H.box(g,1.1,0.03,0.03,'#3a3f4d',0,0.005,-0.1);
  },{...WM(1.7),shelves:[{y:0.06,w:1.1,d:0.22}]}));
  L.push(D('tv_wall','walldecor','Wall TV','📺',1.45,0.1,0.85,(g,T,H)=>{
    H.box(g,1.45,0.85,0.07,'#0a0c12',0,0.43,0);
    const s=H.box(g,1.32,0.72,0.075,'#18293d',0,0.43,0);
    s.material=new T.MeshBasicMaterial({color:0x18293d});
    H.box(g,0.3,0.2,0.04,'#2b2f38',0,0.1,-0.02);
    glowAt(g,T,0.6,0.12,0.045,0x37d67a,0.02);
  },{...WM(1.45)}));
  L.push(D('sconce','walldecor','Wall sconce','🕯️',0.2,0.16,0.34,(g,T,H)=>{
    H.mbox(g,0.08,0.22,0.06,'#8a7a4d',0.35,0.85,0,0.17,-0.04);
    H.cyl(g,0.07,0.09,0.1,'#f5e6c4',0,0.28,0.02,12);
    glowAt(g,T,0,0.32,0.02,0xffe9b0,0.045);
  },{...WM(1.9)}));
  L.push(D('sign_wood','walldecor','Wood sign','🪧',0.95,0.06,0.42,(g,T,H)=>{
    H.tbox(g,0.95,0.4,0.05,'#ffffff','oak',2,1,0,0.21,0);
    H.box(g,0.8,0.24,0.06,'#3a4a63',0,0.21,0);
    H.box(g,0.6,0.05,0.065,'#f2ead8',0,0.21,0);
  },{...WM(1.7)}));
  L.push(D('wallcab','walldecor','Wall cabinet','🗄️',1.05,0.36,0.72,(g,T,H)=>{
    H.tbox(g,1.05,0.72,0.34,'#ffffff','whitewood',2,1,0,0.36,0);
    H.box(g,0.47,0.6,0.02,'#e8e2d4',-0.25,0.36,0.18);
    H.box(g,0.47,0.6,0.02,'#e8e2d4',0.25,0.36,0.18);
    H.mbox(g,0.03,0.12,0.03,'#8a94a5',0.4,0.8,-0.06,0.36,0.2);
    H.mbox(g,0.03,0.12,0.03,'#8a94a5',0.4,0.8,0.06,0.36,0.2);
  },{...WM(1.65),noTop:true}));
  L.push(D('tapestry','walldecor','Tapestry','🧵',1.25,0.05,1.55,(g,T,H)=>{
    H.mbox(g,1.35,0.035,0.035,'#5b4a35',0.6,0.2,0,1.52,0);
    H.tbox(g,1.2,1.45,0.03,'#b48ad9','curtain',2,2,0,0.78,0);
    H.tbox(g,1.2,0.18,0.035,'#8a5f9c','fabric',2,1,0,0.1,0);
  },{...WM(1.6),noTint:true}));
  L.push(D('panel3d_set','walldecor','Deco panels','◻️',1.5,0.07,0.75,(g,T,H)=>{
    for(let i=0;i<3;i++) H.tbox(g,0.46,0.71,0.06,'#ffffff','panel3d',1,1,-0.5+i*0.5,0.375,0);
  },{...WM(1.6)}));
  L.push(D('string_lights','lighting','String lights','✨',1.8,0.1,0.4,(g,T,H)=>{
    H.cyl(g,0.012,0.012,1.7,'#222',0,0.2,0,6).rotation.z=Math.PI/2;
    for(let i=0;i<7;i++){ const x=-0.75+i*0.25;
      H.cyl(g,0.008,0.008,0.12,'#222',x,0.14,0,6);
      glowAt(g,T,x,0.06,0,0xffd9a0,0.035); }
  },{...WM(2.2),noTint:true}));

  // ================= SHELVING =================
  const shelfUnit=(w,h,d,levels,glassDoors)=> (g,T,H)=>{
    H.tbox(g,w,h,0.06,'#8a5f9c','darkwood',1,1,0,h/2,-d/2+0.03);
    for(const x of [-w/2+0.03,w/2-0.03]) H.tbox(g,0.06,h,d,'#ffffff','walnut',1,1,x,h/2,0);
    H.tbox(g,w,0.06,d,'#ffffff','walnut',1,1,0,h-0.03,0);
    H.box(g,w,0.09,d,'#3a2a1a',0,0.045,0);
    for(let s=0;s<levels;s++){ const y=0.28+s*((h-0.45)/(levels-0.4));
      H.tbox(g,w-0.1,0.045,d-0.06,'#ffffff','walnut',1,1,0,y,0); }
    if(glassDoors){ H.glass(g,w/2-0.08,h-0.4,0.02,-(w/4),h/2+0.1,d/2,0.3,'#d8ecff');
      H.glass(g,w/2-0.08,h-0.4,0.02,(w/4),h/2+0.1,d/2,0.3,'#d8ecff'); }
  };
  L.push(D('bookcase_tall','shelving','Tall bookcase','📚',1.3,0.42,2.05,shelfUnit(1.3,2.05,0.42,5),
    {shelves:[0.32,0.71,1.1,1.49,1.88].map(y=>({y,w:1.15,d:0.34}))}));
  L.push(D('cube_shelf','shelving','Cube shelf','🗄️',1.25,0.42,1.25,(g,T,H)=>{
    H.tbox(g,1.25,1.25,0.05,'#c9ccd4','whitewood',1,1,0,0.625,-0.185);
    for(const x of [-0.6,0.6]) H.box(g,0.05,1.25,0.42,'#e8e2d4',x,0.625,0);
    for(const y of [0.025,0.62,1.225]) H.box(g,1.25,0.05,0.42,'#e8e2d4',0,y,0);
    H.box(g,0.05,1.2,0.4,'#d8d2c4',0,0.62,0);
  },{shelves:[{y:0.05,w:0.55,d:0.36,dx:-0.3},{y:0.05,w:0.55,d:0.36,dx:0.3},{y:0.65,w:0.55,d:0.36,dx:-0.3},{y:0.65,w:0.55,d:0.36,dx:0.3}]}));
  L.push(D('tv_unit','shelving','Media unit','📺',1.9,0.46,0.62,(g,T,H)=>{
    H.tbox(g,1.9,0.5,0.44,'#ffffff','darkwood',2,1,0,0.3,0);
    H.tbox(g,1.96,0.05,0.5,'#ffffff','walnut',2,1,0,0.575,0);
    H.box(g,0.6,0.36,0.02,'#171a21',-0.45,0.3,0.23); H.box(g,0.6,0.36,0.02,'#171a21',0.45,0.3,0.23);
    H.glass(g,0.5,0.36,0.02,0,0.3,0.23,0.6,'#3a2a20');
    for(const x of [-0.85,0.85]) H.box(g,0.08,0.1,0.4,'#2b1f13',x,0.05,0);
  },{shelves:[{y:0.6,w:0.8,d:0.4,dx:-0.45},{y:0.6,w:0.8,d:0.4,dx:0.45},{y:0.6,w:0.4,d:0.4,dx:0}]}));
  L.push(D('kitchen_shelf','shelving','Kitchen shelf','🍳',1.4,0.3,0.75,(g,T,H)=>{
    for(const y of [0.02,0.4]){
      H.tbox(g,1.4,0.045,0.3,'#ffffff','oak',2,1,0,y,0);
      H.mbox(g,0.04,0.3,0.04,'#3a3f4d',0.4,0.8,-0.6,y+0.16,-0.1);
      H.mbox(g,0.04,0.3,0.04,'#3a3f4d',0.4,0.8,0.6,y+0.16,-0.1);
    }
  },{...WM(1.5),shelves:[{y:0.045,w:1.3,d:0.26},{y:0.425,w:1.3,d:0.26}]}));
  L.push(D('bath_shelf','shelving','Bath shelf','🧻',0.85,0.26,0.6,(g,T,H)=>{
    for(const y of [0.02,0.32]){
      H.tbox(g,0.85,0.04,0.26,'#ffffff','whitewood',1,1,0,y,0);
      H.mbox(g,0.035,0.24,0.035,'#c9ccd4',0.3,0.9,-0.36,y+0.12,-0.08);
      H.mbox(g,0.035,0.24,0.035,'#c9ccd4',0.3,0.9,0.36,y+0.12,-0.08);
    }
  },{...WM(1.6),shelves:[{y:0.04,w:0.78,d:0.22},{y:0.34,w:0.78,d:0.22}]}));
  L.push(D('display_cab','shelving','Display cabinet','💎',1.05,0.46,1.95,shelfUnit(1.05,1.95,0.46,3,true),
    {shelves:[{y:0.5,w:0.9,d:0.36},{y:1.0,w:0.9,d:0.36},{y:1.5,w:0.9,d:0.36}]}));

  // ================= SMALL DECOR (shelfable) =================
  L.push(D('books_set','decor','Book stack','📚',0.38,0.28,0.3,(g,T,H)=>{
    const cols=['#b8352f','#27436b','#1f6e52','#c9992e','#5a4a7a'];
    for(let i=0;i<4;i++) H.tbox(g,0.36-i*0.03,0.06,0.26,cols[i],'fabric',1,1,(i%2)*0.02-0.01,0.05+i*0.065,0);
    H.box(g,0.05,0.26,0.2,'#e8a05a',0.12,0.18,0).rotation.z=0.35;
  },{...SH,stack:0.3}));
  L.push(D('frame_mini','decor','Photo frame','🖼️',0.22,0.12,0.28,(g,T,H)=>{
    H.box(g,0.2,0.26,0.03,'#3a2c1c',0,0.14,0).rotation.x=-0.12;
    H.box(g,0.16,0.2,0.035,'#7c9fd1',0,0.14,0.002).rotation.x=-0.12;
    H.box(g,0.2,0.03,0.1,'#3a2c1c',0,0.015,-0.03);
  },{...SH}));
  L.push(D('vase','decor','Vase','🏺',0.26,0.26,0.42,(g,T,H)=>{
    H.cyl(g,0.09,0.13,0.3,'#7c9fc4',0,0.15,0,14);
    H.cyl(g,0.05,0.07,0.1,'#7c9fc4',0,0.34,0,12);
    sway(H.cyl(g,0.02,0.02,0.25,'#4d9a47',0.03,0.45,0,6));
  },{...SH}));
  L.push(D('candle','decor','Candle','🕯️',0.13,0.13,0.22,(g,T,H)=>{
    H.cyl(g,0.055,0.06,0.14,'#f2ead8',0,0.07,0,12);
    H.cyl(g,0.07,0.075,0.02,'#8a7a4d',0,0.01,0,12);
    H.cyl(g,0.006,0.006,0.03,'#2b2118',0,0.155,0,6); // wick
    const fl=new T.Mesh(new T.SphereGeometry(0.022,10,8),new T.MeshBasicMaterial({color:0xffc46b}));
    fl.scale.set(1,1.7,1); fl.position.set(0,0.20,0); g.add(fl);
    H.ix(fl,'burn','flicker',{color:'#ffb84d',intensity:3.5,dist:4});
  },{...SH,noTint:true,ix:[{tag:'burn',label:'Flame'}]}));
  L.push(D('bowl','decor','Deco bowl','🥣',0.32,0.32,0.14,(g,T,H)=>{
    H.cyl(g,0.15,0.09,0.12,'#c96a5a',0,0.06,0,16);
    H.cyl(g,0.13,0.13,0.03,'#e8a05a',0,0.12,0,16);
  },{...SH,stack:0.12}));
  L.push(D('basket','decor','Basket','🧺',0.42,0.32,0.3,(g,T,H)=>{
    H.cyl(g,0.19,0.15,0.26,'#a97e4f',0,0.13,0,12);
    H.cyl(g,0.2,0.2,0.04,'#8a6238',0,0.27,0,12);
  },{...SH}));
  L.push(D('clock_mini','decor','Table clock','⏰',0.22,0.1,0.24,(g,T,H)=>{
    H.box(g,0.2,0.2,0.08,'#2b2f38',0,0.12,0);
    H.cyl(g,0.07,0.07,0.09,'#f4f1ea',0,0.13,0,16).rotation.x=Math.PI/2;
    H.box(g,0.012,0.05,0.095,'#b8352f',0,0.15,0).rotation.z=-0.6;
  },{...SH}));
  L.push(D('lamp_mini','decor','Table lamp','💡',0.26,0.26,0.5,(g,T,H)=>{
    H.cyl(g,0.1,0.12,0.03,'#2b2f38',0,0.015,0,12);
    H.cyl(g,0.02,0.02,0.3,'#8a7a4d',0,0.17,0,8);
    const sh=new T.Mesh(new T.CylinderGeometry(0.1,0.13,0.15,14,1,true),
      new T.MeshStandardMaterial({color:new T.Color('#f5e6c4'),roughness:0.9,side:T.DoubleSide,emissive:new T.Color('#ffdf9e'),emissiveIntensity:0.4}));
    sh.position.set(0,0.38,0); g.add(sh);
    glowAt(g,T,0,0.36,0,0xfff2cc,0.04);
  },{...SH,noTint:true}));
  L.push(D('figurine','decor','Figurine','🗿',0.16,0.16,0.34,(g,T,H)=>{
    H.cyl(g,0.07,0.09,0.04,'#3a3f4d',0,0.02,0,10);
    H.cyl(g,0.045,0.06,0.2,'#e8e2d4',0,0.14,0,10);
    const hd=new T.Mesh(new T.SphereGeometry(0.05,12,10),H.mat('#e8e2d4',0.7));
    hd.position.set(0,0.28,0); hd.castShadow=true; g.add(hd);
  },{...SH}));
  L.push(D('perfume','decor','Perfume set','🌸',0.24,0.14,0.2,(g,T,H)=>{
    H.box(g,0.24,0.03,0.14,'#8a5f9c',0,0.015,0);
    const cols=['#e8a0b4','#9fd0e8','#e8c05a'];
    for(let i=0;i<3;i++){ H.glass(g,0.05,0.12-0.02*i,0.05,-0.07+i*0.07,0.09,0,0.7,cols[i]);
      H.box(g,0.02,0.03,0.02,'#c9a227',-0.07+i*0.07,0.16-0.01*i,0); }
  },{...SH}));
  L.push(D('keepsake','decor','Keepsake box','🎁',0.32,0.24,0.18,(g,T,H)=>{
    H.tbox(g,0.32,0.14,0.24,'#27436b','fabric',1,1,0,0.07,0);
    H.tbox(g,0.34,0.05,0.26,'#1f3556','fabric',1,1,0,0.155,0);
    H.box(g,0.05,0.06,0.27,'#c9a227',0,0.15,0);
  },{...SH,stack:0.18}));
  L.push(D('succulent_mini','decor','Mini succulent','🪴',0.18,0.18,0.2,(g,T,H)=>{
    pot(H.cyl(g,0.07,0.055,0.09,'#f2f0ea',0,0.045,0,10));
    for(let i=0;i<6;i++){ const a=i/6*Math.PI*2;
      const lf=H.cyl(g,0.02,0.035,0.09,'#5a9e6f',Math.cos(a)*0.035,0.12,Math.sin(a)*0.035,6);
      lf.rotation.z=Math.cos(a)*0.5; lf.rotation.x=-Math.sin(a)*0.5; }
  },{...SH,noTint:true}));

  // ================= PLANTS =================
  const potted=(potC,potR,foliage)=> (g,T,H)=>{
    pot(H.cyl(g,potR,potR*0.78,potR*1.1,'#f2f0ea',0,potR*0.55,0,14));
    pot(H.cyl(g,potR*1.05,potR*1.05,0.05,'#e0dcd2',0,potR*1.1,0,14));
    H.cyl(g,potR*0.9,potR*0.9,0.04,'#4a3524',0,potR*1.12,0,14);
    foliage(g,T,H,potR*1.15);
    void potC;
  };
  const leafBall=(c)=> (g,T,H,y,r)=>{ const m=new T.Mesh(new T.SphereGeometry(r,12,10),H.mat(c,0.95));
    m.position.set(0,y,0); m.castShadow=true; sway(m); g.add(m); };
  L.push(D('monstera','plants','Monstera','🪴',0.7,0.7,1.1,potted(0,0.2,(g,T,H,y)=>{
    H.cyl(g,0.03,0.04,0.7,'#3a6e3a',0,y+0.3,0,8);
    for(let i=0;i<7;i++){ const a=i/7*Math.PI*2+0.4;
      const lf=new T.Mesh(new T.SphereGeometry(0.16,10,8),H.mat('#2e7d46',0.9));
      lf.scale.set(1,0.15,0.7); lf.position.set(Math.cos(a)*0.22,y+0.55+((i%3)*0.09),Math.sin(a)*0.22);
      lf.rotation.y=-a; lf.castShadow=true; sway(lf,i); g.add(lf); }
  }),{noTint:true}));
  L.push(D('fiddle','plants','Fiddle-leaf fig','🌳',0.65,0.65,1.7,potted(0,0.19,(g,T,H,y)=>{
    H.cyl(g,0.035,0.05,1.2,'#5b3d24',0,y+0.55,0,8);
    for(let i=0;i<9;i++){ const a=i*2.4, yy=y+0.7+(i/9)*0.75;
      const lf=new T.Mesh(new T.SphereGeometry(0.13,10,8),H.mat('#3e7d3a',0.9));
      lf.scale.set(0.7,1,0.25); lf.position.set(Math.cos(a)*0.16,yy,Math.sin(a)*0.16);
      lf.rotation.y=-a; lf.castShadow=true; sway(lf,i); g.add(lf); }
  }),{noTint:true}));
  L.push(D('snakeplant','plants','Snake plant','🌿',0.45,0.45,0.95,potted(0,0.16,(g,T,H,y)=>{
    for(let i=0;i<9;i++){ const a=i/9*Math.PI*2, hgt=0.4+((i*37)%30)/100;
      const lf=H.cyl(g,0.035,0.05,hgt,'#3f7d44',Math.cos(a)*0.07,y+hgt/2,Math.sin(a)*0.07,7);
      lf.rotation.z=Math.cos(a)*0.12; lf.rotation.x=-Math.sin(a)*0.12;
      H.box(g,0.02,hgt*0.7,0.012,'#c9d66a',Math.cos(a)*0.07,y+hgt/2,Math.sin(a)*0.07+0.035); }
  }),{noTint:true}));
  L.push(D('pothos','plants','Pothos','🌱',0.4,0.4,0.5,potted(0,0.13,(g,T,H,y)=>{
    for(let i=0;i<8;i++){ const a=i/8*Math.PI*2;
      const vx=Math.cos(a), vz=Math.sin(a);
      for(let k=0;k<3;k++){
        const lf=new T.Mesh(new T.SphereGeometry(0.055,8,7),H.mat(k%2?'#4d9a47':'#7dc98f',0.9));
        lf.position.set(vx*(0.05+k*0.09),y+0.12-k*0.09,vz*(0.05+k*0.09));
        lf.castShadow=true; sway(lf,i+k); g.add(lf); } }
  }),{...SH,noTint:true}));
  L.push(D('palm','plants','Parlor palm','🌴',0.9,0.9,1.5,potted(0,0.22,(g,T,H,y)=>{
    for(let s=0;s<3;s++) H.cyl(g,0.03,0.04,0.8+s*0.2,'#5b3d24',(s-1)*0.08,y+0.4,(s%2)*0.06-0.03,7);
    for(let i=0;i<9;i++){ const a=i/9*Math.PI*2;
      const fr=new T.Mesh(new T.BoxGeometry(0.09,0.02,0.65),H.mat('#3e8d46',0.9));
      fr.position.set(Math.cos(a)*0.3,y+0.95+((i%2)*0.08),Math.sin(a)*0.3);
      fr.rotation.y=-a+0.2; fr.rotation.x=0.35; fr.castShadow=true; sway(fr,i); g.add(fr); }
  }),{noTint:true}));
  L.push(D('fern','plants','Fern','🌿',0.55,0.55,0.5,potted(0,0.15,(g,T,H,y)=>{
    for(let i=0;i<10;i++){ const a=i/10*Math.PI*2;
      const fr=new T.Mesh(new T.BoxGeometry(0.1,0.02,0.42),H.mat('#4d9a47',0.95));
      fr.position.set(Math.cos(a)*0.16,y+0.22,Math.sin(a)*0.16);
      fr.rotation.y=-a; fr.rotation.x=-0.5; fr.castShadow=true; sway(fr,i); g.add(fr); }
  }),{...SH,noTint:true}));
  L.push(D('peacelily','plants','Peace lily','🪷',0.5,0.5,0.7,potted(0,0.16,(g,T,H,y)=>{
    for(let i=0;i<7;i++){ const a=i/7*Math.PI*2;
      const lf=new T.Mesh(new T.SphereGeometry(0.11,9,7),H.mat('#2e7d46',0.9));
      lf.scale.set(0.6,1.1,0.3); lf.position.set(Math.cos(a)*0.1,y+0.3,Math.sin(a)*0.1);
      lf.rotation.y=-a; lf.castShadow=true; sway(lf,i); g.add(lf); }
    for(let i=0;i<3;i++){ H.cyl(g,0.012,0.012,0.3,'#3a6e3a',(i-1)*0.08,y+0.35,(i%2)*0.06,6);
      const bl=new T.Mesh(new T.SphereGeometry(0.045,8,7),H.mat('#f4f1ea',0.8));
      bl.scale.set(0.6,1.2,0.4); bl.position.set((i-1)*0.08,y+0.52,(i%2)*0.06); g.add(bl); }
  }),{noTint:true}));
  L.push(D('succulent','plants','Succulent','🪴',0.22,0.22,0.24,(g,T,H)=>{
    pot(H.cyl(g,0.085,0.07,0.1,'#f2f0ea',0,0.05,0,10));
    for(let ring=0;ring<2;ring++) for(let i=0;i<7;i++){ const a=i/7*Math.PI*2+ring*0.4;
      const lf=H.cyl(g,0.02,0.032,0.09-ring*0.02,'#5a9e6f',Math.cos(a)*(0.03+ring*0.03),0.13+ring*0.05,Math.sin(a)*(0.03+ring*0.03),6);
      lf.rotation.z=Math.cos(a)*0.6; lf.rotation.x=-Math.sin(a)*0.6; }
  },{...SH,noTint:true}));
  L.push(D('cactus','plants','Cactus','🌵',0.25,0.25,0.5,(g,T,H)=>{
    pot(H.cyl(g,0.09,0.075,0.12,'#e2725b',0,0.06,0,10));
    H.cyl(g,0.06,0.07,0.3,'#3e8d46',0,0.27,0,10);
    const arm=H.cyl(g,0.04,0.045,0.14,'#3e8d46',0.09,0.28,0,8); arm.rotation.z=-0.5;
    H.cyl(g,0.04,0.04,0.08,'#3e8d46',0.13,0.35,0,8);
  },{...SH,noTint:true}));
  L.push(D('hangplant','plants','Hanging plant','🪴',0.35,0.35,0.7,(g,T,H)=>{
    H.cyl(g,0.02,0.02,0.2,'#3a2c1c',0,0.6,0,6);
    pot(H.cyl(g,0.13,0.1,0.18,'#f2f0ea',0,0.4,0,12));
    for(let i=0;i<8;i++){ const a=i/8*Math.PI*2;
      const vx=Math.cos(a), vz=Math.sin(a);
      for(let k=0;k<3;k++){
        const lf=new T.Mesh(new T.SphereGeometry(0.05,8,7),H.mat(k%2?'#4d9a47':'#7dc98f',0.9));
        lf.position.set(vx*(0.04+k*0.07),0.32-k*0.11,vz*(0.04+k*0.07));
        sway(lf,i+k); g.add(lf); } }
  },{...WM(2.0),noTint:true}));
  // outdoor plants (ground)
  const groundMound=(g,T,H,c,r)=>{ const m=new T.Mesh(new T.SphereGeometry(r,12,10),H.mat(c,0.95));
    m.position.set(0,r*0.55,0); m.scale.y=0.7; m.castShadow=true; m.receiveShadow=true; g.add(m); return m; };
  L.push(D('tree_oak','plants','Oak tree','🌳',2.2,2.2,3.4,(g,T,H)=>{
    H.cyl(g,0.16,0.24,1.4,'#5b3d24',0,0.7,0,9);
    H.cyl(g,0.08,0.1,0.9,'#5b3d24',0.3,1.5,0.1,7).rotation.z=-0.4;
    sway(groundMound(g,T,H,'#3e7d3a',1.15)).position.y=1.9;
    const c2=sway(new T.Mesh(new T.SphereGeometry(0.8,12,10),H.mat('#4d9a47',0.95)));
    c2.position.set(0.6,1.5,0.3); c2.castShadow=true; g.add(c2);
    H.cyl(g,1.0,1.0,0.08,'#4a3524',0,0.04,0,16);
  },{noTop:true,noTint:true}));
  L.push(D('bush_round','plants','Round bush','🌳',0.9,0.9,0.8,(g,T,H)=>{
    sway(groundMound(g,T,H,'#4d9a47',0.45)).position.y=0.42;
    H.cyl(g,0.4,0.4,0.08,'#4a3524',0,0.04,0,12);
  },{noTop:true,noTint:true}));
  L.push(D('hedge','plants','Hedge 2m','🌿',2.0,0.6,1.1,(g,T,H)=>{
    H.tbox(g,2.0,0.9,0.55,'#2e7d46','grass',3,1,0,0.55,0);
    H.tbox(g,2.0,0.08,0.6,'#3e8d46','grass',3,1,0,1.02,0);
    H.box(g,2.0,0.1,0.6,'#4a3524',0,0.05,0);
  },{noTop:true,noTint:true}));
  L.push(D('flowerbed','plants','Flower bed','🌸',1.3,0.7,0.5,(g,T,H)=>{
    H.box(g,1.3,0.25,0.7,'#5b3d24',0,0.125,0);
    H.box(g,1.2,0.06,0.6,'#3a2a1a',0,0.27,0);
    const cols=['#d96a8a','#e8c05a','#f2f0ea','#b48ad9','#e2725b'];
    for(let i=0;i<10;i++){
      const x=-0.5+(i%5)*0.25, z=(i<5?-0.15:0.15);
      H.cyl(g,0.015,0.015,0.18,'#3a6e3a',x,0.36,z,6);
      const bl=new T.Mesh(new T.SphereGeometry(0.05,8,7),H.mat(cols[i%5],0.8));
      bl.position.set(x,0.47,z); bl.castShadow=true; g.add(bl); }
  },{noTop:true,noTint:true}));
  L.push(D('grass_orn','plants','Pampas grass','🌾',0.7,0.7,1.2,(g,T,H)=>{
    H.cyl(g,0.25,0.2,0.15,'#4a3524',0,0.075,0,10);
    for(let i=0;i<12;i++){ const a=i/12*Math.PI*2;
      const st=H.cyl(g,0.012,0.012,0.9,'#7a8a4a',Math.cos(a)*0.1,0.55,Math.sin(a)*0.1,5);
      st.rotation.z=Math.cos(a)*0.18; st.rotation.x=-Math.sin(a)*0.18;
      const pl=new T.Mesh(new T.SphereGeometry(0.06,7,6),H.mat('#d8cfc0',0.95));
      pl.scale.set(0.7,1.8,0.7); pl.position.set(Math.cos(a)*0.18,1.0,Math.sin(a)*0.18);
      sway(pl,i); g.add(pl); }
  },{noTop:true,noTint:true}));
  L.push(D('vine','plants','Climbing vine','🍃',1.2,0.12,1.8,(g,T,H)=>{
    for(let i=0;i<5;i++){ const x=-0.5+i*0.25;
      H.cyl(g,0.015,0.015,1.7,'#3a5a2e',x,0.9,0,5);
      for(let k=0;k<5;k++){
        const lf=new T.Mesh(new T.SphereGeometry(0.07,7,6),H.mat(k%2?'#3e7d3a':'#5aa85e',0.9));
        lf.scale.set(1,0.7,0.4); lf.position.set(x+((k%2)*0.08-0.04),0.3+k*0.3,0.03);
        sway(lf,i+k); g.add(lf); } }
  },{...WM(1.2),noTop:true,noTint:true}));
  L.push(D('shrub_flower','plants','Flowering shrub','🌺',0.8,0.8,0.9,(g,T,H)=>{
    H.cyl(g,0.08,0.1,0.3,'#5b3d24',0,0.15,0,7);
    sway(groundMound(g,T,H,'#3f8f3a',0.4)).position.y=0.5;
    for(let i=0;i<8;i++){ const a=i/8*Math.PI*2;
      const bl=new T.Mesh(new T.SphereGeometry(0.05,8,7),H.mat(['#d96a8a','#f2f0ea','#e8c05a'][i%3],0.8));
      bl.position.set(Math.cos(a)*0.32,0.55+((i%3)*0.07),Math.sin(a)*0.32); g.add(bl); }
  },{noTop:true,noTint:true}));

  // ================= PATIO STRUCTURES =================
  L.push(D('pergola','patios','Pergola','🏛️',3.0,3.0,2.6,(g,T,H)=>{
    for(const [x,z] of [[-1.4,-1.4],[1.4,-1.4],[-1.4,1.4],[1.4,1.4]])
      H.tbox(g,0.16,2.5,0.16,'#ffffff','woodpanel',1,1,x,1.25,z);
    for(const z of [-1.4,1.4]) H.tbox(g,3.0,0.18,0.14,'#ffffff','woodpanel',2,1,0,2.5,z);
    for(let i=0;i<7;i++) H.tbox(g,0.12,0.1,3.1,'#ffffff','woodpanel',1,1,-1.35+i*0.45,2.62,0);
  },{noTop:true}));
  L.push(D('gazebo','patios','Gazebo','⛩️',3.0,3.0,2.9,(g,T,H)=>{
    for(let i=0;i<6;i++){ const a=i/6*Math.PI*2;
      H.cyl(g,0.09,0.11,2.2,'#f2eee4',Math.cos(a)*1.3,1.1,Math.sin(a)*1.3,8); }
    H.cyl(g,0.2,1.9,1.0,'#8a5a3e',0,2.6,0,6);
    H.cyl(g,0.02,0.16,0.5,'#5b3d24',0,3.25,0,6);
    H.cyl(g,1.45,1.45,0.08,'#e8e0cc',0,0.04,0,6);
    H.box(g,2.2,0.08,0.5,'#7a5c3e',0,0.5,-0.9);
  },{noTop:true}));
  L.push(D('outdoor_kitchen','patios','Outdoor kitchen','🍖',2.4,0.7,1.0,(g,T,H)=>{
    H.tbox(g,2.4,0.8,0.65,'#8f8a80','stone',2,1,0,0.4,0);
    H.tbox(g,2.5,0.06,0.75,'#3a3f4d','concrete',2,1,0,0.83,0);
    H.box(g,0.7,0.1,0.5,'#111',-0.6,0.87,0);
    for(let i=0;i<3;i++) H.cyl(g,0.09,0.09,0.03,'#333',-0.8+i*0.2,0.93,0,10);
    H.mbox(g,0.04,0.25,0.04,'#c9ccd4',0.3,0.9,0.5,1.0,-0.1,0.98,-0.05);
    H.box(g,0.5,0.3,0.02,'#171a21',0.5,0.5,0.34);
  },{shelves:[{y:0.86,w:1.0,d:0.6,dx:-0.1}]}));
  L.push(D('firepit','patios','Fire pit','🔥',1.0,1.0,0.55,(g,T,H)=>{
    H.cyl(g,0.48,0.52,0.4,'#7d7870',0,0.2,0,14);
    H.cyl(g,0.4,0.4,0.1,'#2b2320',0,0.36,0,14);
    for(let i=0;i<4;i++){ const a=i/4*Math.PI*2+0.4;
      const lg=H.cyl(g,0.05,0.05,0.4,'#3a2a1a',Math.cos(a)*0.12,0.42,Math.sin(a)*0.12,7);
      lg.rotation.z=Math.PI/2.3; lg.rotation.y=-a; }
    glowAt(g,T,0,0.5,0,0xff7a2a,0.12);
    const fl=new T.Mesh(new T.ConeGeometry(0.14,0.3,10),new T.MeshBasicMaterial({color:0xffa53d,transparent:true,opacity:0.9}));
    fl.position.set(0,0.6,0); g.add(fl);
  },{noTop:true,noTint:true}));
  L.push(D('fireplace_out','patios','Outdoor fireplace','🔥',1.4,0.7,2.0,(g,T,H)=>{
    H.tbox(g,1.4,2.0,0.65,'#8f8a80','stone',2,2,0,1.0,0);
    H.box(g,0.9,0.7,0.15,'#1a1110',0,0.5,0.28);
    const f=H.box(g,0.7,0.4,0.1,'#ff7a2a',0,0.4,0.32); f.material=new T.MeshBasicMaterial({color:0xff7a2a});
    H.box(g,1.5,0.1,0.75,'#5a544c',0,2.02,0);
    H.cyl(g,0.25,0.25,0.5,'#5a544c',0,2.3,0,10);
  },{noTop:true}));
  L.push(D('privacy_screen','patios','Privacy screen','🪟',2.0,0.1,1.8,(g,T,H)=>{
    for(let i=0;i<10;i++) H.tbox(g,0.16,1.7,0.07,'#ffffff','woodpanel',1,1,-0.9+i*0.2,0.9,0);
    for(const x of [-0.95,0.95]) H.box(g,0.1,1.8,0.12,'#3a2a1a',x,0.9,0);
  },{noTop:true}));
  L.push(D('fence_gate','patios','Garden gate','🚪',1.2,0.14,1.1,(g,T,H)=>{
    for(const x of [-0.55,0.55]) H.box(g,0.12,1.1,0.14,'#e8e0cc',x,0.55,0);
    for(let i=0;i<5;i++) H.box(g,0.14,0.95,0.05,'#d8cfc0',-0.4+i*0.2,0.5,0);
    H.mbox(g,0.05,0.05,0.08,'#3a3f4d',0.4,0.8,0.35,0.6,0);
  },{noTop:true}));

  // ================= OUTDOOR FURNITURE =================
  L.push(D('dining_out','outdoor','Outdoor dining','🍽️',1.8,1.0,0.76,(g,T,H)=>{
    H.tbox(g,1.8,0.06,1.0,'#ffffff','deck',2,1,0,0.72,0);
    for(const [x,z] of [[-0.8,-0.42],[0.8,-0.42],[-0.8,0.42],[0.8,0.42]])
      H.mbox(g,0.07,0.7,0.07,'#3a3f4d',0.4,0.8,x,0.36,z);
    for(const [x,z,r] of [[-0.5,-0.85,0],[0.3,-0.85,0],[-0.1,0.85,180],[0.6,0.85,180]]){
      H.box(g,0.45,0.05,0.45,'#2b6e8a',x,0.45,z);
      H.box(g,0.45,0.55,0.06,'#2b6e8a',x,0.75,z+(r===0?-0.22:0.22)); }
  },{shelves:[{y:0.75,w:1.6,d:0.85}]}));
  L.push(D('sofa_out','outdoor','Outdoor sofa','🛋️',2.0,0.9,0.85,(g,T,H)=>{
    H.tbox(g,2.0,0.3,0.85,'#3a5a6e','fabric',2,1,0,0.3,0);
    H.tbox(g,2.0,0.6,0.22,'#3a5a6e','fabric',2,1,0,0.65,-0.32);
    for(let i=0;i<3;i++) H.tbox(g,0.58,0.15,0.6,'#7fb8c9','fabric',1,1,-0.63+i*0.63,0.52,0.05);
    for(const [x,z] of [[-0.9,-0.35],[0.9,-0.35],[-0.9,0.35],[0.9,0.35]]) H.mbox(g,0.06,0.14,0.06,'#2b2f38',0.5,0.7,x,0.07,z);
  },{noTop:true}));
  L.push(D('lounger','outdoor','Pool lounger','😎',0.7,1.9,0.8,(g,T,H)=>{
    H.tbox(g,0.65,0.12,1.85,'#e8e2d4','fabric',1,2,0,0.32,0);
    const bk=H.tbox(g,0.65,0.12,0.7,'#e8e2d4','fabric',1,1,0,0.55,-0.75); bk.rotation.x=-0.5;
    for(const [x,z] of [[-0.28,-0.8],[0.28,-0.8],[-0.28,0.8],[0.28,0.8]]) H.box(g,0.06,0.26,0.06,'#5b4a35',x,0.13,z);
  },{noTop:true}));
  L.push(D('rug_out','outdoor','Outdoor rug','🟧',2.0,1.5,0.035,(g,T,H)=>{
    H.tbox(g,2.0,0.025,1.5,'#3a6e8a','fabric',4,3,0,0.015,0);
    H.tbox(g,1.7,0.028,1.2,'#7fb8c9','fabric',3,2,0,0.016,0);
  },{noTop:true}));
  L.push(D('deck_box','outdoor','Deck box','📦',1.2,0.6,0.6,(g,T,H)=>{
    H.tbox(g,1.2,0.5,0.58,'#5a6e7e','fabric',2,1,0,0.28,0);
    H.tbox(g,1.24,0.08,0.62,'#4a5d6c','fabric',2,1,0,0.56,0);
  },{noTop:true}));
  L.push(D('umbrella','outdoor','Patio umbrella','⛱️',1.6,1.6,2.4,(g,T,H)=>{
    H.cyl(g,0.5,0.55,0.08,'#5b4a35',0,0.04,0,4);
    H.cyl(g,0.04,0.04,2.2,'#8a7a63',0,1.15,0,8);
    H.cyl(g,0.05,1.15,0.45,'#d96a6a',0,2.15,0,8);
  },{noTop:true}));
  L.push(D('lantern_out','lighting','Stone lantern','🏮',0.32,0.32,0.7,(g,T,H)=>{
    H.cyl(g,0.13,0.16,0.1,'#7d7870',0,0.05,0,8);
    H.cyl(g,0.05,0.05,0.35,'#7d7870',0,0.27,0,8);
    H.box(g,0.24,0.22,0.24,'#5a544c',0,0.5,0);
    glowAt(g,T,0,0.5,0,0xffe9b0,0.06);
    H.cyl(g,0.16,0.1,0.06,'#5a544c',0,0.64,0,8);
  },{noTop:true,noTint:true}));
  L.push(D('path_light','lighting','Path light','💡',0.22,0.22,0.55,(g,T,H)=>{
    H.cyl(g,0.03,0.03,0.45,'#2b3446',0,0.225,0,8);
    H.cyl(g,0.09,0.11,0.08,'#2b3446',0,0.48,0,10);
    glowAt(g,T,0,0.43,0,0xfff2cc,0.045);
  },{noTop:true,noTint:true}));
  L.push(D('lantern_table','lighting','Table lantern','🏮',0.22,0.22,0.34,(g,T,H)=>{
    H.cyl(g,0.09,0.11,0.03,'#3a2c1c',0,0.015,0,10);
    H.glass(g,0.16,0.2,0.16,0,0.15,0,0.5,'#ffd9a0');
    for(const x of [-0.07,0.07]) H.cyl(g,0.012,0.012,0.26,'#3a2c1c',x,0.15,0,6);
    H.box(g,0.2,0.03,0.2,'#3a2c1c',0,0.3,0);
    glowAt(g,T,0,0.15,0,0xffb84d,0.04);
  },{...SH,noTint:true}));

  // ================= LANDSCAPING =================
  L.push(D('rocks','land','Rock cluster','🪨',0.9,0.7,0.5,(g,T,H)=>{
    const cols=['#8f8a80','#7d7870','#a09a8e'];
    [[0,0.2,0.32],[-0.25,0.12,0.22],[0.28,0.1,0.18],[0.05,0.08,0.14]].forEach(([x,y,r],i)=>{
      const m=new T.Mesh(new T.DodecahedronGeometry(r,0),H.mat(cols[i%3],0.95));
      m.position.set(x,y,0); m.castShadow=true; m.receiveShadow=true; g.add(m); });
  },{noTop:true,noTint:true}));
  L.push(D('garden_bed','land','Raised bed','🌱',1.4,0.8,0.4,(g,T,H)=>{
    H.tbox(g,1.4,0.32,0.8,'#ffffff','woodpanel',2,1,0,0.16,0);
    H.box(g,1.3,0.08,0.7,'#3a2a1a',0,0.3,0);
    for(let i=0;i<6;i++){ const x=-0.5+(i%3)*0.5, z=(i<3?-0.18:0.18);
      H.cyl(g,0.012,0.012,0.2,'#3a6e3a',x,0.4,z,5);
      const lf=new T.Mesh(new T.SphereGeometry(0.06,7,6),H.mat('#4d9a47',0.9));
      lf.position.set(x,0.52,z); sway(lf,i); g.add(lf); }
  },{noTop:true,noTint:true}));
  L.push(D('fountain','land','Garden fountain','⛲',1.1,1.1,1.1,(g,T,H)=>{
    H.cyl(g,0.5,0.55,0.35,'#a09a8e',0,0.175,0,16);
    H.cyl(g,0.42,0.42,0.1,'#2f9fd8',0,0.33,0,16);
    const w=H.cyl(g,0.42,0.42,0.03,'#7cc8e8',0,0.38,0,16);
    w.material=new T.MeshStandardMaterial({color:0x7cc8e8,roughness:0.15,metalness:0.1,transparent:true,opacity:0.9});
    w.userData.water=1;
    H.cyl(g,0.07,0.09,0.6,'#a09a8e',0,0.6,0,10);
    H.cyl(g,0.25,0.2,0.12,'#a09a8e',0,0.92,0,12);
    glowAt(g,T,0,1.0,0,0x9fd8ff,0.05);
  },{noTop:true,noTint:true}));
  return L;
})();

// Tool-card presets for material/shape tabs (rendered by app.js)
export const TOOL_CARDS={
  flooring:['oak','oak_light','walnut','herring','chevron','laminate','vinyl','ceramic','porcelain',
    'marble_f','granite','terrazzo','concrete_f','carpet','carpet_luxe','pattern_tile','checker','stone_f'],
  pools:['rect','square','oval','kidney','plunge','infinity','above'],
  patios:['patio_conc','patio_stone','patio_paver','deck_wood','deck_comp'],
  land:['grass','turf','grassdry','mulch','gravel','dirt','sand'],
};
export const POOL_SHAPES=[
  {id:'rect', name:'Rectangular', icon:'rectangle-horizontal'},
  {id:'square', name:'Square', icon:'square'},
  {id:'oval', name:'Oval', icon:'egg'},
  {id:'kidney', name:'Kidney', icon:'circle-dot'},
  {id:'plunge', name:'Plunge', icon:'bath'},
  {id:'infinity', name:'Infinity', icon:'droplets'},
  {id:'above', name:'Above-ground', icon:'box'},
];
