// Procedural low-poly catalog. Every def works in 2D (footprint w×d + icon) and 3D (build()).
// build(g, THREE, H) — g is Group with base y=0, centered, facing -Z? We use facing +Z for doors/front.
import { EXTRA, SHELVES, NOTOP } from './catalog_extra.js';
export const CATEGORIES = [
  { id:'structure', name:'Structure', icon:'brick-wall' },
  { id:'walldecor', name:'Wall Decor', icon:'image' },
  { id:'flooring', name:'Flooring', icon:'layers' },
  { id:'shelving', name:'Shelving', icon:'library' },
  { id:'decor', name:'Decor', icon:'sparkles' },
  { id:'plants', name:'Plants', icon:'sprout' },
  { id:'lighting', name:'Lighting', icon:'lamp' },
  { id:'kitchen', name:'Kitchen', icon:'cooking-pot' },
  { id:'dining', name:'Dining', icon:'utensils' },
  { id:'pantry', name:'Pantry', icon:'package' },
  { id:'bedroom', name:'Bedroom', icon:'bed-double' },
  { id:'bath', name:'Bath', icon:'bath' },
  { id:'living', name:'Sofas & sectionals', icon:'sofa' },
  { id:'chairs', name:'Sitting chairs', icon:'armchair' },
  { id:'glam', name:'Glam', icon:'gem' },
  { id:'billiard', name:'Billiard', icon:'circle-dot' },
  { id:'bar', name:'Bar', icon:'martini' },
  { id:'pools', name:'Pools', icon:'waves' },
  { id:'patios', name:'Patios', icon:'tent' },
  { id:'land', name:'Landscaping', icon:'tree-pine' },
  { id:'outdoor', name:'Outdoor', icon:'sun' },
  { id:'custom', name:'My Models', icon:'package' },
];

function H3(THREE){
  const cache=new Map();
  function mat(c, rough=0.85, metal=0.0){
    const k=c+'|'+rough+'|'+metal;
    if(cache.has(k)) return cache.get(k);
    const m=new THREE.MeshStandardMaterial({color:new THREE.Color(c), roughness:rough, metalness:metal});
    cache.set(k,m); return m;
  }
  function box(parent,w,h,d,c,x=0,y=0,z=0,ry=0){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(c));
    m.position.set(x,y,z); m.rotation.y=ry; m.castShadow=true; m.receiveShadow=true;
    parent.add(m); return m;
  }
  function cyl(parent,rt,rb,h,c,x=0,y=0,z=0,seg=14){
    const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), mat(c));
    m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true;
    parent.add(m); return m;
  }
  function glass(parent,w,h,d,x=0,y=0,z=0,op=0.35,c='#bcd8ff'){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
      new THREE.MeshStandardMaterial({color:new THREE.Color(c),transparent:true,opacity:op,roughness:0.15,metalness:0.1}));
    m.position.set(x,y,z); parent.add(m); return m;
  }
  return {mat,box,cyl,glass};
}

const D=(id,cat,name,icon,w,d,h,build,extra={})=>({id,cat,name,icon,w,d,h,build,...extra});

// NOTE: keep builders small + robust (no external assets).
export function buildCatalog(){
  const L=[];
  // ---------- STRUCTURE ----------
  L.push(D('stairs_straight','structure','Stairs','🪜',1.1,3.2,3.0,(g,T,H,it)=>{
    // Auto-sized: it.rise (set on placement / floor changes) is the height to climb.
    // Steps always fill the 1.1 x 3.2 footprint; riser count follows the rise.
    const rise=Math.max(1.2,Math.min(6,+it?.rise||3.0));
    const n=Math.max(2,Math.min(30,Math.round(rise/0.175)));
    const riser=rise/n, tread=Math.max(0.16,Math.min(0.32,3.2/n)), run=tread*n;
    const z0=-run/2;
    for(let i=0;i<n;i++) H.box(g,1.1,riser,Math.max(0.05,tread*1.04),'#c9b896',0,riser*(i+0.5),z0+tread*(i+0.5));
    const ang=Math.atan2(rise,run), len=Math.hypot(rise,run);
    for(const sx of [-0.58,0.58]){
      const s=H.box(g,0.06,0.3,len,'#6b5b45',sx,rise/2-0.15,z0+run/2);
      s.rotation.x=-ang;
    }
  }));
  L.push(D('railing','structure','Railing 2m','🚧',2.0,0.08,1.0,(g,T,H)=>{
    H.box(g,2.0,0.06,0.06,'#3a4456',0,0.95,0);
    for(let i=-4;i<=4;i++) H.box(g,0.05,0.95,0.05,'#3a4456',i*0.22,0.48,0);
    H.box(g,2.0,0.05,0.1,'#3a4456',0,0.03,0);
  }));
  L.push(D('column','structure','Column','🏛️',0.4,0.4,2.7,(g,T,H)=>{
    H.box(g,0.5,0.12,0.5,'#d8d2c4',0,0.06,0); H.box(g,0.28,2.4,0.28,'#efe9db',0,1.35,0); H.box(g,0.5,0.12,0.5,'#d8d2c4',0,2.6,0);
  }));
  L.push(D('fireplace','structure','Fireplace','🔥',1.4,0.6,1.3,(g,T,H)=>{
    H.box(g,1.4,1.3,0.6,'#7a6a5e',0,0.65,0); H.box(g,0.9,0.6,0.15,'#1a1110',0,0.45,0.24);
    H.box(g,1.5,0.08,0.7,'#4a3d33',0,1.33,0);
    const f=H.box(g,0.7,0.35,0.1,'#ff7a2a',0,0.35,0.28); f.material=new T.MeshBasicMaterial({color:0xff7a2a});
    H.ix(f,'fire','flicker',{color:'#ff7a2a',intensity:10,dist:7});
  },{ix:[{tag:'fire',label:'Fire'}]}));
  L.push(D('rug_round','structure','Rug round','⭕',1.8,1.8,0.03,(g,T,H)=>{
    const m=new T.Mesh(new T.CylinderGeometry(0.9,0.9,0.03,24),H.mat('#7c8fc9')); m.position.y=0.015; m.receiveShadow=true; g.add(m);
  }));

  // ---------- KITCHEN ----------
  L.push(D('cabinet','kitchen','Counter','🧊',2.0,0.65,0.92,(g,T,H)=>{
    H.tbox(g,2.0,0.72,0.58,'#ffffff','whitewood',2,1,0,0.42,0); // body
    H.box(g,1.9,0.09,0.5,'#3a3f4d',0,0.045,0.02); // toe-kick
    H.tbox(g,2.06,0.05,0.68,'#ffffff','marble',2,1,0,0.83,0); // stone top
    for(const sx of [-0.5,0.5]){
      const pv=H.piv(g,sx<0?-0.93:0.93,0.45,0.30); // hinge at outer edge
      H.box(pv,0.86,0.6,0.02,'#e8e2d4',sx<0?0.43:-0.43,0,0); // door front
      H.mbox(pv,0.3,0.03,0.03,'#c9ccd4',0.3,0.9,sx<0?0.62:-0.62,0.23,0.02); // bar pull
      H.ix(pv,'door','hinge',{axis:'y',angle:sx<0?1.85:-1.85});
    }
    H.glass(g,0.7,0.03,0.4,0,0.86,0,0.85,'#cfd8e6'); // sink basin
    H.mbox(g,0.04,0.28,0.04,'#c9ccd4',0.25,0.95,-0.15,0.98,-0.18); // faucet
    const sp=H.mbox(g,0.04,0.04,0.24,'#c9ccd4',0.25,0.95,-0.15,1.1,-0.08); void sp;
  },{ix:[{tag:'door',label:'Doors'}]}));
  L.push(D('fridge','kitchen','Fridge','❄️',0.8,0.75,1.9,(g,T,H)=>{
    H.mbox(g,0.8,1.9,0.72,'#dfe6ef',0.32,0.85,0,0.95,0); // steel body
    for(const sx of [-1,1]){
      const pv=H.piv(g,sx*0.39,1.0,0.365); // french doors
      H.mbox(pv,0.37,1.7,0.03,'#dfe6ef',0.32,0.85,-sx*0.195,0,0);
      H.mbox(pv,0.035,0.7,0.045,'#e8ecf2',0.25,0.9,-sx*0.05,0,0.03); // handle
      if(sx<0) H.box(pv,0.2,0.3,0.02,'#2b3446',0.19,0.35,0.025); // dispenser
      H.ix(pv,'door','hinge',{axis:'y',angle:sx<0?1.8:-1.8});
    }
  },{ix:[{tag:'door',label:'Doors'}]}));
  L.push(D('stove','kitchen','Stove','🔥',0.8,0.7,0.9,(g,T,H)=>{
    H.mbox(g,0.8,0.85,0.68,'#2b2f38',0.5,0.6,0,0.43,0);
    H.box(g,0.8,0.05,0.68,'#0c0e12',0,0.88,0); // glass top
    for(const [x,z] of [[-0.2,-0.15],[0.2,-0.15],[-0.2,0.15],[0.2,0.15]]) H.cyl(g,0.11,0.11,0.025,'#1a1d22',x,0.91,z);
    const ov=H.piv(g,0,0.15,0.34); // oven door drops down
    H.glass(ov,0.6,0.4,0.02,0,0.3,0,0.7,'#3a2a20'); // oven window
    H.mbox(ov,0.7,0.04,0.03,'#c9ccd4',0.3,0.9,0,0.63,0.01); // handle
    H.ix(ov,'door','hinge',{axis:'x',angle:1.1});
    for(let i=0;i<4;i++){ const k=H.cyl(g,0.025,0.025,0.03,'#c9ccd4',-0.24+i*0.16,0.86,0.34,8); k.rotation.x=Math.PI/2; }
  },{ix:[{tag:'door',label:'Oven'}]}));
  L.push(D('sink','kitchen','Sink','🚰',1.2,0.65,0.9,(g,T,H)=>{
    H.tbox(g,1.2,0.72,0.6,'#ffffff','whitewood',1,1,0,0.42,0);
    H.tbox(g,1.24,0.05,0.66,'#ffffff','marble',1,1,0,0.82,0);
    H.glass(g,0.6,0.12,0.4,-0.15,0.8,0,0.85,'#8fb6d9');
    H.mbox(g,0.04,0.28,0.04,'#c9ccd4',0.25,0.95,-0.15,0.98,-0.2);
    const dw=H.piv(g,0.08,0.42,0.31); // under-sink door
    H.box(dw,0.44,0.55,0.02,'#e8e2d4',0.22,0,0);
    H.ix(dw,'door','hinge',{axis:'y',angle:1.8});
  },{ix:[{tag:'door',label:'Door'}]}));
  L.push(D('island','kitchen','Island','🏝️',1.8,0.9,0.94,(g,T,H)=>{
    H.tbox(g,1.7,0.8,0.85,'#ffffff','whitewood',2,1,0,0.44,0);
    H.tbox(g,1.95,0.06,1.02,'#ffffff','marble',2,1,0,0.9,0); // waterfall top
    for(const sx of [-0.42,0.42]){
      const pv=H.piv(g,sx<0?-0.79:0.79,0.42,0.44);
      H.box(pv,0.7,0.55,0.02,'#e8e2d4',sx<0?0.37:-0.37,0,0);
      H.mbox(pv,0.24,0.03,0.03,'#c9ccd4',0.3,0.9,sx<0?0.55:-0.55,0.2,0.02);
      H.ix(pv,'door','hinge',{axis:'y',angle:sx<0?1.85:-1.85});
    }
  },{ix:[{tag:'door',label:'Doors'}]}));
  L.push(D('microwave','kitchen','Microwave','📻',0.6,0.4,0.35,(g,T,H)=>{
    H.box(g,0.6,0.35,0.4,'#22262f',0,0.85,0);
    const dw=H.piv(g,-0.29,0.85,0.2); // door on left hinge
    H.box(dw,0.58,0.33,0.02,'#22262f',0.29,0,0);
    H.glass(dw,0.4,0.22,0.025,0.29,0,0.005,0.7,'#3a4a63');
    H.ix(dw,'door','hinge',{axis:'y',angle:1.9});
    H.box(g,0.6,0.68,0.4,'#d7dde8',0,0.34,0);
  }, {lift:0,ix:[{tag:'door',label:'Door'}]}));
  L.push(D('dishwasher','kitchen','Dishwasher','🍽️',0.65,0.65,0.85,(g,T,H)=>{
    H.box(g,0.65,0.85,0.62,'#cfd6e2',0,0.43,0);
    const dw=H.piv(g,0,0.06,0.31); // front drops down
    H.box(dw,0.5,0.72,0.03,'#8b96ab',0,0.38,0);
    H.box(dw,0.44,0.04,0.28,'#aeb7c9',0,0.55,0.1); // rack hint
    H.ix(dw,'door','hinge',{axis:'x',angle:1.05});
  },{ix:[{tag:'door',label:'Door'}]}));

  // ---------- DINING ----------
  L.push(D('dining_rect','dining','Table 6-seat','🍽️',1.9,1.0,0.76,(g,T,H)=>{
    H.tbox(g,1.9,0.07,1.0,'#ffffff','walnut',2,1,0,0.72,0); // top
    H.tbox(g,1.7,0.08,0.8,'#ffffff','darkwood',1,1,0,0.64,0); // apron
    for(const [x,z] of [[-0.85,-0.42],[0.85,-0.42],[-0.85,0.42],[0.85,0.42]]) H.tbox(g,0.09,0.68,0.09,'#ffffff','darkwood',1,1,x,0.34,z);
    for(const [x,z,r] of [[-0.6,-0.85,0],[0,-0.85,0],[0.6,-0.85,0],[-0.6,0.85,180],[0,0.85,180],[0.6,0.85,180]]){
      H.tbox(g,0.42,0.05,0.42,'#e9e2d4','fabric',1,1,x,0.45,z);
      H.tbox(g,0.42,0.52,0.07,'#e9e2d4','fabric',1,1,x,0.72,z+(r===0?-0.2:0.2));
    }
    H.tbox(g,0.5,0.02,0.3,'#ffffff','marble',1,1,-0.3,0.77,0); // runner board
  }));
  L.push(D('dining_round','dining','Round table','⭕',1.2,1.2,0.76,(g,T,H)=>{
    const top=new T.Mesh(new T.CylinderGeometry(0.6,0.6,0.06,26),H.tmat?H.tmat('#ffffff','walnut',2,2,0.6):H.mat('#7a5233',0.6));
    top.position.set(0,0.72,0); top.castShadow=true; top.receiveShadow=true; g.add(top);
    H.cyl(g,0.08,0.12,0.68,'#4a3220',0,0.36,0);
    const disc=new T.Mesh(new T.CylinderGeometry(0.35,0.4,0.05,20),H.mat('#3a2a1a',0.7)); disc.position.set(0,0.03,0); g.add(disc);
    for(let i=0;i<4;i++){ const a=i*Math.PI/2+0.78; H.tbox(g,0.4,0.05,0.4,'#e9e2d4','fabric',1,1,Math.cos(a)*0.95,0.45,Math.sin(a)*0.95); }
  }));
  L.push(D('chair','chairs','Dining chair','🪑',0.45,0.45,0.9,(g,T,H)=>{
    H.box(g,0.44,0.05,0.44,'#8a5f3c',0,0.45,0); H.box(g,0.44,0.5,0.05,'#8a5f3c',0,0.7,-0.2);
    for(const [x,z] of [[-0.19,-0.19],[0.19,-0.19],[-0.19,0.19],[0.19,0.19]]) H.box(g,0.05,0.45,0.05,'#5b3d24',x,0.22,z);
  },{sub:'Dining chairs'}));
  L.push(D('sideboard','dining','Sideboard','🗄️',1.6,0.5,0.85,(g,T,H)=>{
    H.box(g,1.6,0.8,0.48,'#6e4f30',0,0.45,0); H.box(g,1.62,0.04,0.5,'#3f2d1a',0,0.87,0);
    for(const sx of [-0.38,0.38]){
      const pv=H.piv(g,sx<0?-0.76:0.76,0.45,0.245);
      H.box(pv,0.72,0.66,0.02,'#7d5c38',sx<0?0.38:-0.38,0,0);
      H.mbox(pv,0.16,0.025,0.025,'#c9ccd4',0.3,0.9,sx<0?0.6:-0.6,0.1,0.02);
      H.ix(pv,'door','hinge',{axis:'y',angle:sx<0?1.85:-1.85});
    }
  },{ix:[{tag:'door',label:'Doors'}]}));
  L.push(D('pendant','dining','Pendant light','💡',0.4,0.4,1.4,(g,T,H)=>{
    H.cyl(g,0.02,0.02,0.9,'#222',0,1.9,0); H.cyl(g,0.2,0.28,0.3,'#ffb84d',0,1.35,0);
    const b=H.box(g,0.1,0.1,0.1,'#ffe9b0',0,1.22,0); b.material=new T.MeshBasicMaterial({color:0xffe9b0});
    H.ix(b,'light','lamp',{color:'#ffd9a0',intensity:6,dist:6});
  },{ix:[{tag:'light',label:'Light'}]}));

  // ---------- PANTRY ----------
  L.push(D('pantry_shelf','pantry','Shelf rack','🫙',1.2,0.45,2.0,(g,T,H)=>{
    for(const x of [-0.55,0.55]) for(const z of [-0.18,0.18]) H.box(g,0.05,2.0,0.05,'#5b6b84',x,1.0,z);
    for(let s=0;s<4;s++){ H.box(g,1.15,0.05,0.45,'#aeb9cc',0,0.3+s*0.55,0);
      for(let j=0;j<4;j++) H.box(g,0.16,0.22+s*0.02,0.16,['#d9a441','#8fb6d9','#9dc98f','#d97b7b'][ (s+j)%4 ],-0.4+j*0.27,0.45+s*0.55,0); }
  }));
  L.push(D('pantry_cab','pantry','Pantry cabinet','🚪',1.0,0.6,2.1,(g,T,H)=>{
    H.box(g,1.0,2.1,0.58,'#e5d9c2',0,1.05,0);
    for(const sx of [-0.23,0.23]){
      const pv=H.piv(g,sx<0?-0.47:0.47,1.05,0.3);
      H.box(pv,0.44,1.8,0.02,'#efe4cd',sx<0?0.24:-0.24,0,0);
      H.mbox(pv,0.06,0.06,0.04,'#5b4a35',0.6,0.2,sx<0?0.36:-0.36,0,0.02);
      H.ix(pv,'door','hinge',{axis:'y',angle:sx<0?1.85:-1.85});
    }
  },{ix:[{tag:'door',label:'Doors'}]}));
  L.push(D('freezer','pantry','Chest freezer','🧊',1.1,0.6,0.85,(g,T,H)=>{
    H.box(g,1.1,0.8,0.6,'#eef2f7',0,0.42,0);
    const ld=H.piv(g,0,0.85,-0.3); // lid opens back
    H.box(ld,1.12,0.06,0.62,'#9aa7bd',0,0.03,0.31);
    H.ix(ld,'door','hinge',{axis:'x',angle:-1.5});
  },{ix:[{tag:'door',label:'Lid'}]}));
  L.push(D('jar_set','pantry','Jars set','🫙',0.6,0.35,0.35,(g,T,H)=>{
    H.box(g,0.6,0.05,0.35,'#8a6a45',0,0.5,0); H.box(g,0.6,0.5,0.32,'#6e5638',0,0.25,0);
    for(let i=0;i<3;i++) H.cyl(g,0.09,0.09,0.22,['#e8c87a','#c9e29b','#e29bb0'][i],-0.18+i*0.18,0.68,0,10);
  }));

  // ---------- BEDROOM ----------
  const bed=(w,duvet)=> (g,T,H)=>{
    // walnut frame + tall tufted headboard
    H.tbox(g,w,0.26,2.1,'#ffffff','walnut',2,1,0,0.24,0);
    H.tbox(g,w,1.15,0.14,'#ffffff','walnut',2,1,0,0.62,-1.08);
    for(let c=0;c<3;c++){
      H.tbox(g,w/3-0.06,0.95,0.05,'#e9e2d4','fabric',1,1,-w/2+(c+0.5)*w/3,0.6,-0.99);
    }
    // mattress + bedding
    H.tbox(g,w-0.12,0.2,1.95,'#ffffff','fabric',2,2,0,0.47,0.02);
    H.tbox(g,w-0.1,0.12,1.15,duvet,'fabric',2,2,0,0.55,0.42); // duvet
    H.tbox(g,w-0.1,0.05,0.35,'#d96a6a','fabric',2,1,0,0.52,1.0+0); // throw
    for(const sx of [-1,1]){
      const pil=H.box(g,w/2-0.25,0.13,0.4,'#f7f5ef',sx*(w/4-0.02),0.6,-0.68);
      pil.rotation.x=-0.18;
    }
  };
  L.push(D('bed_single','bedroom','Single bed','🛏️',1.0,2.2,1.2,bed(1.0,'#9dc98f')));
  L.push(D('bed_double','bedroom','Double bed','🛏️',1.6,2.2,1.2,bed(1.6,'#7c9fd1')));
  L.push(D('bed_king','bedroom','King bed','🛏️',2.0,2.2,1.2,bed(2.0,'#b48ad9')));
  L.push(D('nightstand','bedroom','Nightstand','🌙',0.5,0.45,0.62,(g,T,H)=>{
    H.tbox(g,0.5,0.45,0.42,'#ffffff','walnut',1,1,0,0.28,0);
    H.tbox(g,0.54,0.04,0.46,'#ffffff','marble',1,1,0,0.53,0); // stone top
    const dw=H.piv(g,0,0.36,0.21); // drawer slides out
    H.box(dw,0.38,0.14,0.2,'#3f2d1a',0,0,-0.06); // drawer box (sits inside)
    H.box(dw,0.38,0.14,0.02,'#5a4632',0,0,0.05); // front panel
    H.mbox(dw,0.16,0.025,0.025,'#c9ccd4',0.3,0.9,0,0,0.07); // pull
    H.ix(dw,'drawer','slide',{axis:'z',dist:0.24});
    const sh=new T.Mesh(new T.CylinderGeometry(0.13,0.17,0.2,14),H.mat('#ffdf9e',0.9));
    sh.position.set(0,0.66,0); g.add(sh); H.ix(sh,'light','lamp',{color:'#ffd9a0',intensity:5,dist:5});
    H.mbox(g,0.03,0.1,0.03,'#3a3f4d',0.5,0.6,0,0.56,0);
  },{ix:[{tag:'drawer',label:'Drawer'},{tag:'light',label:'Lamp'}]}));
  L.push(D('wardrobe','bedroom','Wardrobe','🚪',1.6,0.65,2.15,(g,T,H)=>{
    H.tbox(g,1.6,2.0,0.6,'#ffffff','walnut',2,1,0,1.05,0);
    H.tbox(g,1.66,0.08,0.66,'#ffffff','darkwood',1,1,0,2.08,0); // crown
    H.box(g,1.54,0.06,0.64,'#3a2a1a',0,0.05,0); // plinth
    for(const sx of [-1,1]){
      const pv=H.piv(g,sx*0.77,1.05,0.305);
      H.box(pv,0.72,1.7,0.015,'#6e4f30',-sx*0.37,0,0); // door inset
      H.mbox(pv,0.03,0.28,0.03,'#c9ccd4',0.3,0.9,-sx*0.13,0,0.025); // pull
      H.ix(pv,'door','hinge',{axis:'y',angle:sx<0?1.8:-1.8});
    }
  },{ix:[{tag:'door',label:'Doors'}]}));
  L.push(D('dresser','bedroom','Dresser','🗄️',1.4,0.5,0.92,(g,T,H)=>{
    H.tbox(g,1.4,0.78,0.48,'#ffffff','walnut',2,1,0,0.42,0);
    H.tbox(g,1.46,0.05,0.52,'#ffffff','marble',2,1,0,0.84,0);
    for(let r=0;r<2;r++) for(let c=0;c<3;c++){
      const dw=H.piv(g,-0.45+c*0.45,0.3+r*0.32,0.24);
      H.box(dw,0.38,0.28,0.2,'#6e4f30',0,0,-0.06);
      H.box(dw,0.38,0.28,0.02,'#7d5c38',0,0,0.005);
      H.mbox(dw,0.1,0.025,0.025,'#c9ccd4',0.3,0.9,0,0,0.025);
      H.ix(dw,'drawer'+r+'_'+c,'slide',{axis:'z',dist:0.22});
    }
  },{ix:[{tag:'drawer0_0',label:'Drawers'}]}));
  L.push(D('desk','bedroom','Desk','💻',1.2,0.6,0.75,(g,T,H)=>{
    H.box(g,1.2,0.05,0.6,'#7a5c3e',0,0.72,0);
    for(const [x,z] of [[-0.55,-0.25],[0.55,-0.25],[-0.55,0.25],[0.55,0.25]]) H.box(g,0.06,0.7,0.06,'#3f2d1a',x,0.36,z);
    H.box(g,0.5,0.32,0.03,'#111',0,0.95,-0.15);
    const scr=H.box(g,0.46,0.28,0.032,'#1c2f4a',0,0.95,-0.148);
    H.ix(scr,'screen','screen',{color:'#9fd0ff'});
    H.box(g,0.4,0.03,0.15,'#222',0,0.76,0.05);
  },{ix:[{tag:'screen',label:'Screen'}]}));

  // ---------- BATH ----------
  L.push(D('toilet','bath','Toilet','🚽',0.65,0.7,0.82,(g,T,H)=>{
    const porc='#f7fafc';
    H.tbox(g,0.45,0.68,0.2,porc,'marble',1,1,0,0.44,-0.22); // tank
    H.mbox(g,0.12,0.03,0.05,'#c9ccd4',0.25,0.95,0,0.84,-0.22); // flush
    H.tbox(g,0.5,0.36,0.55,porc,'marble',1,1,0,0.24,0.05); // bowl
    H.cyl(g,0.22,0.24,0.1,porc,0,0.47,0.05,18); // seat
    H.cyl(g,0.18,0.18,0.03,'#e8eef4',0,0.5,0.05,18);
    const ld=H.piv(g,0,0.52,-0.14); // lid lifts from the back
    H.cyl(ld,0.21,0.21,0.03,porc,0,0.02,0.2,18);
    H.ix(ld,'lid','hinge',{axis:'x',angle:-1.9});
  },{ix:[{tag:'lid',label:'Lid'}]}));
  L.push(D('bath_sink','bath','Bath sink','🚰',0.65,0.55,0.88,(g,T,H)=>{
    H.tbox(g,0.55,0.72,0.45,'#ffffff','whitewood',1,1,0,0.38,0); // vanity
    H.box(g,0.45,0.5,0.02,'#e8e2d4',0,0.35,0.235);
    H.mbox(g,0.2,0.025,0.025,'#c9ccd4',0.3,0.9,0,0.55,0.25);
    H.tbox(g,0.6,0.05,0.5,'#ffffff','marble',1,1,0,0.76,0); // top
    H.cyl(g,0.26,0.2,0.13,'#ffffff',0,0.85,0,18);
    H.mbox(g,0.035,0.22,0.035,'#c9ccd4',0.2,1.0,0,0.95,-0.15); // faucet
    const sp=H.mbox(g,0.035,0.035,0.18,'#c9ccd4',0.2,1.0,0,1.04,-0.07); void sp;
  }));
  L.push(D('bathtub','bath','Bathtub','🛁',1.7,0.8,0.62,(g,T,H)=>{
    H.tbox(g,1.7,0.5,0.8,'#ffffff','marble',2,1,0,0.28,0); // apron
    H.box(g,1.56,0.06,0.66,'#e8f1f7',0,0.5,0); // rim
    H.glass(g,1.44,0.12,0.54,0,0.44,0,0.85,'#7fc4e8'); // water
    H.mbox(g,0.05,0.25,0.05,'#c9ccd4',0.2,1.0,0.6,0.62,-0.28); // filler
    H.box(g,0.5,0.35,0.06,'#e8f1f7',-0.45,0.68,-0.28); // headrest
  }));
  L.push(D('shower','bath','Shower','🚿',1.0,1.0,2.2,(g,T,H)=>{
    H.box(g,1.0,0.08,1.0,'#dfe6ef',0,0.04,0);
    for(const [x,z] of [[-0.48,-0.48],[0.48,-0.48]]) H.box(g,0.06,2.1,0.06,'#9aa7bd',x,1.05,z);
    H.glass(g,1.0,1.9,0.04,0,1.05,-0.48,0.25,'#bcd8ff'); H.glass(g,0.04,1.9,1.0,-0.48,1.05,0,0.25,'#bcd8ff');
    H.cyl(g,0.12,0.12,0.03,'#7a8aa0',0,2.0,-0.3); H.cyl(g,0.02,0.02,0.4,'#7a8aa0',0,1.85,-0.3);
  }));
  L.push(D('mirror','bath','Mirror','🪞',0.8,0.06,0.9,(g,T,H)=>{
    H.box(g,0.8,0.9,0.05,'#8a96ab',0,1.4,-0.25); H.glass(g,0.68,0.78,0.02,0,1.4,-0.22,0.9,'#d8ecff');
  }));
  L.push(D('towel','bath','Towel rack','🧻',0.7,0.15,1.2,(g,T,H)=>{
    H.box(g,0.06,1.1,0.06,'#9aa7bd',-0.3,0.7,0); H.box(g,0.06,1.1,0.06,'#9aa7bd',0.3,0.7,0);
    H.box(g,0.6,0.06,0.06,'#9aa7bd',0,1.2,0); H.box(g,0.5,0.6,0.04,'#7c9fd1',0,0.85,0);
  }));

  // ---------- LIVING ----------
  const sofaSet=(base,accent)=> (g,T,H)=>{
    // tapered wood legs
    for(const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
      const wdt=base.w/2-0.12, dpt=0.32;
      const leg=new T.Mesh(new T.CylinderGeometry(0.03,0.045,0.12,8),H.mat('#3a2a1a',0.6));
      leg.position.set(x*wdt,0.06,z*dpt); leg.castShadow=true; g.add(leg);
    }
    const W=base.w;
    // body shell in upholstery color
    H.tbox(g,W,0.34,0.9,base.c,'fabric',3,1,0,0.3,0);
    H.tbox(g,W,0.62,0.24,base.c,'fabric',3,1,0,0.66,-0.34); // back
    H.tbox(g,0.24,0.3,0.9,base.c,'fabric',1,1,-W/2+0.12,0.55,0); // arms
    H.tbox(g,0.24,0.3,0.9,base.c,'fabric',1,1,W/2-0.12,0.55,0);
    // seat + back cushions
    for(let i=0;i<base.n;i++){
      const cx=(i-(base.n-1)/2)*( (W-0.5)/base.n );
      const cw=(W-0.5)/base.n-0.04;
      H.tbox(g,cw,0.17,0.58,base.seat,'fabric',1,1,cx,0.55,0.08);
      const bk=H.tbox(g,cw,0.42,0.15,base.seat,'fabric',1,1,cx,0.72,-0.26);
      bk.rotation.x=-0.12;
    }
    // throw pillows
    const p1=H.box(g,0.34,0.34,0.12,accent,-W/4,0.72,-0.12); p1.rotation.z=0.3; p1.rotation.x=-0.15;
    const p2=H.box(g,0.34,0.34,0.12,'#f2ead8',W/4,0.72,-0.12); p2.rotation.z=-0.28; p2.rotation.x=-0.15;
  };
  const sofaCfg={w:2.1,n:3,c:'#5a7ab0',seat:'#6f8fc4'};
  L.push(D('sofa3','living','Sofa 3-seat','🛋️',2.1,0.9,0.9,sofaSet(sofaCfg,'#d96a6a'),{sub:'Sofas'}));
  const loveCfg={w:1.5,n:2,c:'#7a9e7e',seat:'#93b897'};
  L.push(D('sofa2','living','Loveseat','🛋️',1.5,0.9,0.9,sofaSet(loveCfg,'#e8c87a'),{sub:'Loveseats'}));
  L.push(D('armchair','chairs','Wing chair','🪑',0.9,0.9,1.15,(g,T,H)=>{
    const c='#b0714f', seat='#c98a63';
    for(const [x,z] of [[-0.36,-0.32],[0.36,-0.32],[-0.36,0.32],[0.36,0.32]]){
      const leg=new T.Mesh(new T.CylinderGeometry(0.03,0.045,0.14,8),H.mat('#3a2a1a',0.6));
      leg.position.set(x,0.07,z); leg.castShadow=true; g.add(leg);
    }
    H.tbox(g,0.9,0.34,0.85,c,'fabric',2,1,0,0.31,0);
    H.tbox(g,0.86,0.85,0.22,c,'fabric',2,1,0,0.75,-0.32); // tall back
    for(const sx of [-1,1]){
      const wing=H.tbox(g,0.16,0.7,0.3,c,'fabric',1,1,sx*0.4,0.8,-0.2);
      wing.rotation.y=-sx*0.3;
      const roll=new T.Mesh(new T.CylinderGeometry(0.13,0.13,0.6,12),H.mat(c,0.95));
      roll.rotation.x=Math.PI/2; roll.position.set(sx*0.38,0.62,0.02); roll.castShadow=true; g.add(roll);
    }
    H.tbox(g,0.6,0.15,0.55,seat,'fabric',1,1,0,0.55,0.05); // seat cushion
  },{sub:'Sitting chairs'}));
  L.push(D('coffee','living','Coffee table','☕',1.2,0.6,0.44,(g,T,H)=>{
    H.tbox(g,1.2,0.06,0.6,'#ffffff','walnut',2,1,0,0.38,0);
    H.tbox(g,1.1,0.05,0.5,'#ffffff','darkwood',1,1,0,0.12,0); // lower shelf
    for(const [x,z] of [[-0.55,-0.25],[0.55,-0.25],[-0.55,0.25],[0.55,0.25]]) H.tbox(g,0.07,0.36,0.07,'#ffffff','darkwood',1,1,x,0.18,z);
    H.tbox(g,0.32,0.04,0.24,'#9fc7e8','fabric',1,1,-0.25,0.43,0); // books
    H.tbox(g,0.28,0.03,0.2,'#d96a6a','fabric',1,1,-0.25,0.465,0);
    H.cyl(g,0.09,0.11,0.1,'#e8e2d4',0.3,0.46,0.05,14); // vase
  }));
  L.push(D('tvstand','living','TV + stand','📺',1.6,0.5,1.05,(g,T,H)=>{
    H.tbox(g,1.6,0.42,0.45,'#ffffff','darkwood',2,1,0,0.24,0);
    for(const sx of [-0.35,0.35]){
      const pv=H.piv(g,sx<0?-0.68:0.68,0.24,0.23);
      H.box(pv,0.62,0.3,0.02,'#171a21',sx<0?0.33:-0.33,0,0);
      H.mbox(pv,0.2,0.03,0.03,'#c9ccd4',0.3,0.9,sx<0?0.5:-0.5,0.08,0.02);
      H.ix(pv,'cabinet','hinge',{axis:'y',angle:sx<0?1.8:-1.8});
    }
    H.mbox(g,0.24,0.1,0.2,'#111318',0.5,0.6,0,0.5,-0.08); // neck
    H.tbox(g,1.44,0.84,0.06,'#0a0c12','fabric',1,1,0,1.0,-0.08); // panel
    const s=H.box(g,1.32,0.72,0.075,'#2a4a6b',0,1.0,-0.045); s.material=new T.MeshBasicMaterial({color:0x18293d});
    H.ix(s,'screen','screen',{color:'#86c5ff'});
    void s;
  },{ix:[{tag:'cabinet',label:'Cabinet'},{tag:'screen',label:'TV'}]}));
  L.push(D('bookshelf','living','Bookshelf','📚',1.2,0.4,2.0,(g,T,H)=>{
    H.box(g,1.2,2.0,0.36,'#6e4f30',0,1.0,0);
    for(let s=0;s<4;s++){ H.box(g,1.1,0.04,0.32,'#4a3520',0,0.4+s*0.48,0);
      for(let b=0;b<6;b++) H.box(g,0.08,0.32,0.22,['#d96a6a','#7c9fd1','#9dc98f','#e8c87a','#b48ad9','#e29b6a'][ (s*6+b)%6 ],-0.45+b*0.18,0.6+s*0.48,0); }
  }));
  L.push(D('floorlamp','living','Floor lamp','🪔',0.45,0.45,1.65,(g,T,H)=>{
    H.mbox(g,0.36,0.04,0.36,'#2b2f38',0.4,0.8,0,0.02,0);
    H.mbox(g,0.03,0.03,1.5,'#8a7a4d',0.35,0.85,0,0.78,0); // brass stem
    const sh=new T.Mesh(new T.CylinderGeometry(0.2,0.27,0.32,16,1,true),
      new T.MeshStandardMaterial({color:new T.Color('#f5e6c4'),roughness:0.9,side:T.DoubleSide,emissive:new T.Color('#ffdf9e'),emissiveIntensity:0.35}));
    sh.position.set(0,1.56,0); g.add(sh);
    H.ix(sh,'light','lamp',{color:'#ffdf9e',intensity:7,dist:7});
    const bulb=new T.Mesh(new T.SphereGeometry(0.05,10,8),new T.MeshBasicMaterial({color:0xfff2cc}));
    bulb.position.set(0,1.5,0); g.add(bulb);
    H.ix(bulb,'light','screen',{color:'#fff2cc'});
  },{ix:[{tag:'light',label:'Lamp'}]}));
  // ---------- NEW: realistic depth pieces ----------
  L.push(D('sectional','living','Sectional sofa','🛋️',2.6,1.7,0.9,(g,T,H)=>{
    const c='#6f6f7d', seat='#84848f';
    const legM=H.mat('#3a2a1a',0.6);
    for(const [x,z] of [[-1.2,-0.7],[1.2,-0.7],[-1.2,0.7],[1.2,-0.7],[1.2,0.7],[-1.2,0.7],[0.4,0.7]]){
      const leg=new T.Mesh(new T.CylinderGeometry(0.03,0.045,0.12,8),legM);
      leg.position.set(x,0.06,z); leg.castShadow=true; g.add(leg);
    }
    // main run (left) + chaise return (right front)
    H.tbox(g,2.0,0.34,0.9,c,'fabric',3,1,-0.3,0.3,0);
    H.tbox(g,2.0,0.62,0.24,c,'fabric',3,1,-0.3,0.66,-0.34);
    H.tbox(g,0.24,0.3,0.9,c,'fabric',1,1,-1.28,0.55,0);
    H.tbox(g,0.9,0.34,1.5,c,'fabric',1,2,0.85,0.3,0.3); // chaise
    H.tbox(g,0.24,0.5,1.5,c,'fabric',1,2,1.28,0.5,0.3); // chaise outer back
    for(let i=0;i<3;i++) H.tbox(g,0.58,0.17,0.58,seat,'fabric',1,1,-1.0+i*0.63,0.55,0.06);
    H.tbox(g,0.8,0.17,1.1,seat,'fabric',1,1,0.85,0.55,0.3); // chaise pad
    const acc=H.box(g,0.36,0.36,0.13,'#d96a6a',-0.85,0.75,-0.15); acc.rotation.z=0.25; acc.rotation.x=-0.12;
    const acc2=H.box(g,0.36,0.36,0.13,'#e8c87a',0.45,0.75,-0.15); acc2.rotation.z=-0.22; acc2.rotation.x=-0.12;
  },{sub:'Sofas'}));
  const couchCfg={w:2.3,n:3,c:'#4a5d6c',seat:'#6e8a9e'};
  L.push(D('couch','living','Couch 3-seat','🛋️',2.3,0.95,0.92,sofaSet(couchCfg,'#e8c05a'),{sub:'Couches'}));
  const couchLoveCfg={w:1.6,n:2,c:'#6c5a7e',seat:'#8e7aa0'};
  L.push(D('couch_love','living','Couch loveseat','🛋️',1.6,0.95,0.92,sofaSet(couchLoveCfg,'#7fb8c9'),{sub:'Couches'}));
  L.push(D('recliner','living','Recliner','🛋️',0.95,1.35,1.05,(g,T,H)=>{
    const c='#7a5a6e', seat='#a07a92';
    for(const [x,z] of [[-0.38,-0.4],[0.38,-0.4],[-0.38,0.4],[0.38,0.4]]){
      const leg=new T.Mesh(new T.CylinderGeometry(0.035,0.05,0.14,8),H.mat('#3a2a1a',0.6));
      leg.position.set(x,0.07,z); leg.castShadow=true; g.add(leg);
    }
    H.tbox(g,0.95,0.34,0.85,c,'fabric',2,1,0,0.31,-0.1);
    const bk=H.tbox(g,0.9,0.85,0.24,c,'fabric',2,1,0,0.72,-0.5); bk.rotation.x=0.22;
    H.tbox(g,0.24,0.32,0.85,c,'fabric',1,1,-0.42,0.55,-0.1);
    H.tbox(g,0.24,0.32,0.85,c,'fabric',1,1,0.42,0.55,-0.1);
    H.tbox(g,0.62,0.16,0.55,seat,'fabric',1,1,0,0.55,-0.05);
    H.tbox(g,0.6,0.12,0.55,seat,'fabric',1,1,0,0.42,0.55); // extended footrest
    H.box(g,0.5,0.1,0.08,'#3a2a1a',0,0.32,0.35);
    const pl=H.box(g,0.5,0.3,0.1,'#e8c05a',-0.25,0.75,-0.42); pl.rotation.z=0.25;
  },{sub:'Recliners'}));
  L.push(D('sitting_chair','chairs','Accent chair','🪑',0.65,0.65,0.92,(g,T,H)=>{
    const c='#3e6e8a', seat='#7fb8c9';
    for(const [x,z] of [[-0.26,-0.26],[0.26,-0.26],[-0.26,0.26],[0.26,0.26]]){
      const leg=new T.Mesh(new T.CylinderGeometry(0.025,0.04,0.42,8),H.mat('#3a2a1a',0.6));
      leg.position.set(x,0.21,z); leg.castShadow=true; g.add(leg);
    }
    H.tbox(g,0.62,0.14,0.6,c,'fabric',1,1,0,0.48,0);
    H.tbox(g,0.62,0.55,0.16,c,'fabric',1,1,0,0.75,-0.26);
    H.tbox(g,0.5,0.12,0.48,seat,'fabric',1,1,0,0.58,0.02);
    H.tbox(g,0.1,0.3,0.5,c,'fabric',1,1,-0.3,0.62,0);
    H.tbox(g,0.1,0.3,0.5,c,'fabric',1,1,0.3,0.62,0);
  },{sub:'Sitting chairs'}));
  L.push(D('dining_chair2','chairs','Dining chair padded','🪑',0.46,0.46,0.92,(g,T,H)=>{
    for(const [x,z] of [[-0.19,-0.19],[0.19,-0.19],[-0.19,0.19],[0.19,0.19]]) H.box(g,0.05,0.45,0.05,'#3f2d1a',x,0.22,z);
    H.tbox(g,0.44,0.08,0.44,'#b0413e','fabric',1,1,0,0.47,0);
    H.tbox(g,0.44,0.5,0.07,'#b0413e','fabric',1,1,0,0.72,-0.2);
    H.box(g,0.4,0.04,0.4,'#7a2f2e',0,0.42,0);
  },{sub:'Dining chairs'}));
  L.push(D('stool_wood','chairs','Wooden stool','🪑',0.42,0.42,0.62,(g,T,H)=>{
    H.cyl(g,0.21,0.21,0.06,'#8a5f3c',0,0.59,0,16);
    for(let i=0;i<4;i++){ const a=i*Math.PI/2+0.78;
      const leg=H.cyl(g,0.025,0.03,0.58,'#5b3d24',Math.cos(a)*0.15,0.29,Math.sin(a)*0.15,8);
      leg.rotation.z=Math.cos(a)*0.18; leg.rotation.x=-Math.sin(a)*0.18;
    }
    H.cyl(g,0.16,0.16,0.03,'#5b3d24',0,0.18,0,12);
  },{sub:'Barstools & stools'}));
  L.push(D('vanity_chair','chairs','Vanity chair','🪑',0.52,0.52,0.82,(g,T,H)=>{
    for(const [x,z] of [[-0.2,-0.2],[0.2,-0.2],[-0.2,0.2],[0.2,0.2]]){
      const leg=new T.Mesh(new T.CylinderGeometry(0.02,0.03,0.44,8),H.mat('#c9a227',0.35,0.85));
      leg.position.set(x,0.22,z); leg.castShadow=true; g.add(leg);
    }
    const seat=new T.Mesh(new T.CylinderGeometry(0.24,0.24,0.12,18),H.mat('#e8a0b4',0.9));
    seat.position.set(0,0.5,0); seat.castShadow=true; g.add(seat);
    const bk=H.tbox(g,0.44,0.32,0.09,'#e8a0b4','fabric',1,1,0,0.72,-0.22);
    void bk;
  },{sub:'Vanity chairs'}));
  L.push(D('rocker','chairs','Rocking chair','🪑',0.62,1.05,1.0,(g,T,H)=>{
    const wood=H.mat('#6e4f30',0.7);
    for(const sx of [-0.26,0.26]){
      const run=H.box(g,0.06,0.05,1.0,'#4a3520',sx,0.035,0);
      const tip=H.box(g,0.06,0.05,0.3,'#4a3520',sx,0.09,0.55); tip.rotation.x=-0.5;
      void run;
      for(const z of [-0.3,0.3]) H.box(g,0.05,0.4,0.05,'#4a3520',sx,0.25,z);
    }
    H.tbox(g,0.56,0.06,0.5,'#8a5f3c','fabric',1,1,0,0.46,0);
    for(let s=0;s<3;s++) H.box(g,0.5,0.09,0.04,'#8a5f3c',0,0.62+s*0.14,-0.24-s*0.02);
    for(const sx of [-0.25,0.25]) H.box(g,0.05,0.5,0.05,'#4a3520',sx,0.7,-0.26);
    H.box(g,0.52,0.06,0.5,'#6e4f30',0,0.78,-0.05);
    void wood;
  },{sub:'Rocking chairs'}));
  L.push(D('chandelier','living','Chandelier','🕯️',0.7,0.7,1.05,(g,T,H)=>{
    const brass=H.mat('#c9a227',0.35,0.85);
    H.mbox(g,0.03,0.03,1.15,'#2b2f38',0.4,0.8,0,2.2,0); // drop rod to ceiling
    const ring=new T.Mesh(new T.TorusGeometry(0.26,0.03,10,28),brass);
    ring.rotation.x=Math.PI/2; ring.position.set(0,1.62,0); ring.castShadow=true; g.add(ring);
    H.cyl(g,0.05,0.08,0.12,'#c9a227',0,1.54,0,10);
    const stem=H.cyl(g,0.03,0.03,0.5,'#2b2f38',0,1.85,0,8);
    H.ix(stem,'light','lamp',{color:'#ffe9b0',intensity:9,dist:8});
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      const cup=new T.Mesh(new T.CylinderGeometry(0.05,0.035,0.07,10),brass);
      cup.position.set(Math.cos(a)*0.28,1.7,Math.sin(a)*0.28); g.add(cup);
      const flame=new T.Mesh(new T.SphereGeometry(0.028,8,8),new T.MeshBasicMaterial({color:0xffe9b0}));
      flame.position.set(Math.cos(a)*0.28,1.77,Math.sin(a)*0.28); g.add(flame);
      H.ix(flame,'light','flicker',{color:'#ffc46b',intensity:2.5,dist:3.5});
    }
  },{ix:[{tag:'light',label:'Chandelier'}]}));
  L.push(D('curtains','bedroom','Curtains','🎀',1.8,0.25,2.2,(g,T,H)=>{
    H.mbox(g,2.0,0.035,0.035,'#8a7a4d',0.35,0.85,0,2.14,0); // rod
    for(const sx of [-1.02,1.02]){ const fin=new T.Mesh(new T.SphereGeometry(0.05,10,8),H.mat('#8a7a4d',0.35,0.85)); fin.position.set(sx,2.14,0); g.add(fin); }
    for(const sx of [-0.72,0.72]){
      const p=H.tbox(g,0.62,2.1,0.12,'#e6d9c8','curtain',2,3,sx,1.05,0);
      void p;
    }
    H.tbox(g,1.0,0.5,0.06,'#f2ead8','curtain',1,1,0,1.85,0.02); // valance
  }));
  L.push(D('vanity','bath','Vanity + mirror','💄',1.2,0.55,2.1,(g,T,H)=>{
    H.tbox(g,1.2,0.72,0.5,'#ffffff','whitewood',2,1,0,0.4,0);
    H.tbox(g,1.26,0.05,0.56,'#ffffff','marble',2,1,0,0.79,0);
    H.cyl(g,0.2,0.16,0.1,'#ffffff',-0.3,0.86,0,16); H.cyl(g,0.2,0.16,0.1,'#ffffff',0.3,0.86,0,16);
    H.mbox(g,0.03,0.16,0.03,'#c9ccd4',0.2,1.0,-0.3,0.95,-0.12);
    H.mbox(g,0.03,0.16,0.03,'#c9ccd4',0.2,1.0,0.3,0.95,-0.12);
    H.tbox(g,1.1,0.9,0.04,'#8a96ab','fabric',1,1,0,1.5,-0.24); // mirror frame
    H.glass(g,0.98,0.78,0.02,0,1.5,-0.21,0.9,'#d8ecff');
    for(const sx of [-1,1]){
      const pv=H.piv(g,sx*0.52,0.36,0.26);
      H.box(pv,0.42,0.5,0.02,'#e8e2d4',-sx*0.23,0,0);
      H.mbox(pv,0.14,0.025,0.025,'#c9ccd4',0.3,0.9,-sx*0.1,0.14,0.02);
      H.ix(pv,'door','hinge',{axis:'y',angle:sx<0?1.8:-1.8});
    }
  },{ix:[{tag:'door',label:'Doors'}]}));
  L.push(D('rug_rect','living','Area rug','🟧',2.4,1.7,0.035,(g,T,H)=>{
    H.tbox(g,2.4,0.025,1.7,'#b0714f','fabric',4,3,0,0.015,0);
    H.tbox(g,2.1,0.028,1.4,'#d8a878','fabric',3,2,0,0.016,0); // inset border
  }));

  // ---------- BILLIARD ----------
  L.push(D('pool_table','billiard','Pool table','🎱',2.5,1.3,0.85,(g,T,H)=>{
    H.box(g,2.5,0.18,1.3,'#5b3a22',0,0.68,0); H.box(g,2.2,0.06,1.0,'#2e7d46',0,0.78,0);
    for(const [x,z] of [[-1.15,-0.55],[1.15,-0.55],[-1.15,0.55],[1.15,0.55],[-0,0.55],[0,-0.55]]) H.cyl(g,0.09,0.09,0.12,'#111',x,0.78,z,10);
    for(const [x,z] of [[-1.1,-0.5],[1.1,-0.5],[-1.1,0.5],[1.1,0.5]]) H.box(g,0.12,0.75,0.12,'#3a2413',x,0.36,z);
    for(let i=0;i<3;i++) H.box(g,0.09,0.09,1.1,'#c9a86a',-0.4+i*0.4,0.82,0,0);
  }));
  L.push(D('poker','billiard','Poker table','🃏',1.4,1.4,0.78,(g,T,H)=>{
    H.cyl(g,0.7,0.7,0.08,'#3a5a3a',0,0.72,0,20); H.cyl(g,0.72,0.72,0.06,'#4a3220',0,0.66,0,20);
    H.cyl(g,0.15,0.2,0.68,'#2b1f13',0,0.34,0,12);
    for(let i=0;i<4;i++){ const a=i*Math.PI/2; H.box(g,0.42,0.05,0.42,'#5b3a22',Math.cos(a)*0.95,0.45,Math.sin(a)*0.95); }
  }));
  L.push(D('dart','billiard','Dartboard','🎯',0.5,0.1,0.6,(g,T,H)=>{
    H.box(g,0.1,1.8,0.1,'#333',0,0.9,-0.15); H.box(g,0.5,0.5,0.08,'#222',0,1.6,-0.1);
    const c=new T.Mesh(new T.CylinderGeometry(0.2,0.2,0.04,20),new T.MeshStandardMaterial({color:0xd93a3a})); c.rotation.x=Math.PI/2; c.position.set(0,1.6,-0.05); g.add(c);
  }));
  L.push(D('arcade','billiard','Arcade','👾',0.7,0.7,1.7,(g,T,H)=>{
    H.box(g,0.7,1.7,0.65,'#2b2f8a',0,0.85,0); H.glass(g,0.5,0.4,0.03,0,1.15,0.3,0.8,'#7ce8ff');
    H.box(g,0.5,0.08,0.3,'#111',0,0.85,0.3);
  }));
  L.push(D('cue_rack','billiard','Cue rack','🎱',0.6,0.3,1.6,(g,T,H)=>{
    H.box(g,0.6,1.5,0.25,'#5b3a22',0,0.75,-0.1);
    for(let i=0;i<3;i++) H.cyl(g,0.02,0.02,1.4,'#c9a86a',-0.2+i*0.2,0.8,0.05,8);
  }));

  // ---------- BAR ----------
  L.push(D('bar_counter','bar','Bar counter','🍸',2.2,0.7,1.1,(g,T,H)=>{
    H.box(g,2.2,1.0,0.65,'#4a3220',0,0.5,0); H.box(g,2.35,0.07,0.8,'#2b1c10',0,1.03,0);
    H.box(g,2.0,0.5,0.02,'#7a5c3e',0,0.55,0.34);
  }));
  L.push(D('bar_stool','chairs','Bar stool','💺',0.4,0.4,0.8,(g,T,H)=>{
    H.cyl(g,0.2,0.2,0.07,'#8a2f2f',0,0.78,0,14); H.cyl(g,0.03,0.03,0.72,'#333',0,0.4,0);
    H.cyl(g,0.22,0.24,0.04,'#333',0,0.03,0,14);
  },{sub:'Barstools & stools'}));
  L.push(D('wine_rack','bar','Wine rack','🍷',1.0,0.35,1.8,(g,T,H)=>{
    H.box(g,1.0,1.8,0.32,'#3a2615',0,0.9,0);
    for(let r=0;r<3;r++) for(let c=0;c<4;c++){ const b=H.cyl(g,0.06,0.06,0.3,'#6e1f2a',-0.36+c*0.24,0.4+r*0.5,0,8); b.rotation.x=Math.PI/2; }
  }));
  L.push(D('beer_tap','bar','Beer taps','🍺',0.8,0.4,0.6,(g,T,H)=>{
    H.box(g,0.8,0.45,0.4,'#3a3f4d',0,0.9,0); H.box(g,0.8,0.08,0.42,'#22262f',0,1.15,0);
    for(let i=-1;i<=1;i++){ H.cyl(g,0.02,0.02,0.3,'#c9c9c9',i*0.22,1.3,0,8); H.box(g,0.06,0.12,0.06,'#8a5a33',i*0.22,1.48,0); }
    H.box(g,0.8,0.68,0.4,'#5b3a22',0,0.34,0);
  }));
  L.push(D('minibar','bar','Mini fridge','🧊',0.6,0.6,0.9,(g,T,H)=>{
    H.box(g,0.6,0.85,0.58,'#22262f',0,0.44,0); H.glass(g,0.45,0.6,0.02,0,0.45,0.3,0.5,'#9fd0e8');
  }));

  // ---------- OUTDOOR ----------
  L.push(D('tree','outdoor','Tree','🌳',1.2,1.2,2.6,(g,T,H)=>{
    H.cyl(g,0.12,0.16,1.0,'#5b3d24',0,0.5,0,8);
    H.cyl(g,0.7,0.5,1.2,'#3e7d3a',0,1.5,0,10); H.cyl(g,0.5,0.35,0.9,'#4d9a47',0,2.2,0,10);
  }));
  L.push(D('bush','outdoor','Bush','🌿',0.8,0.8,0.7,(g,T,H)=>{
    const s=new T.Mesh(new T.SphereGeometry(0.4,12,10),H.mat('#4d9a47')); s.position.y=0.4; s.scale.y=0.8; s.castShadow=true; g.add(s);
  }));
  L.push(D('fence','outdoor','Fence 2m','🚧',2.0,0.12,1.1,(g,T,H)=>{
    for(let i=0;i<=8;i++) H.box(g,0.1,1.0,0.06,'#e8e0cc',-0.9+i*0.225,0.5,0);
    H.box(g,2.0,0.08,0.05,'#c9bfa8',0,0.8,0); H.box(g,2.0,0.08,0.05,'#c9bfa8',0,0.3,0);
  }));
  L.push(D('patio_set','outdoor','Patio + umbrella','⛱️',2.2,2.2,2.4,(g,T,H)=>{
    H.cyl(g,0.6,0.6,0.05,'#7a6a5e',0,0.42,0,4); H.box(g,0.08,0.72,0.08,'#5b4a35',0,0.36,0);
    H.cyl(g,0.04,0.04,2.2,'#8a7a63',0,1.2,0,8); H.cyl(g,1.1,0.05,0.5,'#d96a6a',0,2.2,0,10);
    H.box(g,0.45,0.05,0.45,'#e8e0cc',-0.5,0.45,0.5); H.box(g,0.45,0.05,0.45,'#e8e0cc',0.5,0.45,-0.5);
  }));
  L.push(D('grill','outdoor','BBQ grill','🍖',0.8,0.6,1.0,(g,T,H)=>{
    H.box(g,0.7,0.35,0.5,'#222',0,0.75,0); H.cyl(g,0.35,0.35,0.08,'#111',0,0.95,0,14);
    for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++) H.cyl(g,0.03,0.03,0.7,'#444',i*0.2,0.35,j*0.15,6);
  }));
  L.push(D('planter','outdoor','Planter','🪴',0.6,0.6,0.6,(g,T,H)=>{
    H.box(g,0.6,0.4,0.6,'#8a5a3e',0,0.2,0); H.cyl(g,0.25,0.2,0.35,'#4d9a47',0,0.55,0,8);
  }));
  L.push(D('pool','outdoor','Pool 4×3','🏊',4.0,3.0,0.6,(g,T,H)=>{
    H.box(g,4.0,0.5,3.0,'#9fc7e8',0,0.15,0); H.glass(g,3.7,0.15,2.7,0,0.32,0,0.85,'#3a9fd8');
    H.box(g,4.2,0.1,3.2,'#e8e0cc',0,0.42,0);
    const hole=H.box(g,3.7,0.12,2.7,'#2a7ab5',0,0.42,0); hole.material=new T.MeshStandardMaterial({color:0x2a7ab5,roughness:0.2});
  }));
  L.push(D('bench','outdoor','Bench','🪑',1.8,0.5,0.5,(g,T,H)=>{
    H.box(g,1.8,0.07,0.45,'#7a5c3e',0,0.42,0);
    for(const x of [-0.7,0.7]){ H.box(g,0.07,0.42,0.4,'#3a2a1a',x,0.21,0); }
  }));
  L.push(D('car','outdoor','Car','🚗',4.2,1.9,1.5,(g,T,H)=>{
    H.box(g,4.2,0.5,1.85,'#4a6fa5',0,0.55,0); H.box(g,2.2,0.55,1.7,'#5f88c4',-0.2,1.05,0);
    H.glass(g,2.0,0.4,1.72,-0.2,1.05,0,0.5,'#1a2535');
    for(const [x,z] of [[-1.4,-0.85],[1.4,-0.85],[-1.4,0.85],[1.4,0.85]]){ const w=H.cyl(g,0.34,0.34,0.22,'#111',x,0.34,z,14); w.rotation.x=Math.PI/2; }
  }));
  L.push(D('lamp_post','outdoor','Lamp post','💡',0.4,0.4,2.8,(g,T,H)=>{
    H.cyl(g,0.06,0.09,2.6,'#2b3446',0,1.3,0,8); H.box(g,0.3,0.3,0.3,'#ffe9b0',0,2.7,0);
  }));

  // ---------- GLAM (user-requested pink set) ----------
  L.push(D('bubble_babe','glam','Bubble Babe','🫧',1.1,1.2,2.0,(g,T,H)=>{
    const gold=H.mat('#c9a227',0.35,0.8);
    // base disc + C-curve stand (tube follows a smooth path up and over)
    const base=new T.Mesh(new T.CylinderGeometry(0.35,0.38,0.06,24),gold); base.position.set(0,0.03,-0.38); base.castShadow=true; g.add(base);
    const curve=new T.CatmullRomCurve3([new T.Vector3(0,0.06,-0.38),new T.Vector3(0,0.9,-0.5),new T.Vector3(0,1.7,-0.32),new T.Vector3(0,1.95,-0.02)]);
    const tube=new T.Mesh(new T.TubeGeometry(curve,24,0.035,10),gold); tube.castShadow=true; g.add(tube);
    // hanging chain
    H.cyl(g,0.015,0.015,0.5,'#8a7a2a',0,1.7,0,8);
    // clear acrylic bubble
    const bub=new T.Mesh(new T.SphereGeometry(0.45,26,18),
      new T.MeshStandardMaterial({color:new T.Color('#dfeefc'),transparent:true,opacity:0.28,roughness:0.05,metalness:0}));
    bub.position.set(0,1.0,0); g.add(bub);
    // gold rim ring around the bubble
    const rim=new T.Mesh(new T.TorusGeometry(0.45,0.022,10,44),gold); rim.position.set(0,1.0,0); rim.castShadow=true; g.add(rim);
    // pink cushions inside
    const pink=H.mat('#f9a8cc',0.9);
    const seat=new T.Mesh(new T.BoxGeometry(0.55,0.14,0.42),pink); seat.position.set(0,0.72,0.02); seat.castShadow=true; g.add(seat);
    const back=new T.Mesh(new T.BoxGeometry(0.55,0.5,0.14),pink); back.position.set(0,1.0,-0.26); back.rotation.x=-0.25; back.castShadow=true; g.add(back);
    for(const sx of [-1,1]){ const puff=new T.Mesh(new T.SphereGeometry(0.16,14,12),pink);
      puff.scale.set(1,0.9,1.2); puff.position.set(sx*0.28,0.86,-0.02); puff.castShadow=true; g.add(puff); }
  }));
  L.push(D('pink_passion','glam','Pink Passion','💋',0.75,0.85,1.15,(g,T,H)=>{
    const gloss=H.mat('#ff2e88',0.25), soft=H.mat('#ff6fae',0.5);
    for(const [x,z] of [[-0.3,-0.32],[0.3,-0.32],[-0.3,0.32],[0.3,0.32]])
      { const l=new T.Mesh(new T.CylinderGeometry(0.035,0.05,0.28,10),H.mat('#1c1c22',0.6)); l.position.set(x,0.14,z); l.castShadow=true; g.add(l); }
    const seat=new T.Mesh(new T.BoxGeometry(0.7,0.28,0.62),gloss); seat.position.set(0,0.4,0); seat.castShadow=true; g.add(seat);
    const cush=new T.Mesh(new T.BoxGeometry(0.6,0.1,0.5),soft); cush.position.set(0,0.57,0.02); cush.castShadow=true; g.add(cush);
    const back=new T.Mesh(new T.BoxGeometry(0.7,0.75,0.18),gloss); back.position.set(0,0.85,-0.3); back.rotation.x=0.1; back.castShadow=true; g.add(back);
    for(const sx of [-1,1]){
      const wing=new T.Mesh(new T.BoxGeometry(0.14,0.7,0.5),gloss); wing.position.set(sx*0.4,0.82,-0.12); wing.rotation.y=-sx*0.25; wing.castShadow=true; g.add(wing);
      const arm=new T.Mesh(new T.BoxGeometry(0.14,0.32,0.55),gloss); arm.position.set(sx*0.4,0.62,0.05); arm.castShadow=true; g.add(arm);
    }
  }));
  L.push(D('shelfie','glam','Show-Off Shelfie','✨',2.4,0.5,2.1,(g,T,H)=>{
    const pink=H.mat('#f72585',0.5), dark=H.mat('#20242e',0.7);
    // carcass: back, sides, plinth
    H.box(g,2.4,2.1,0.06,'#d1146b',0,1.05,-0.22);
    for(const x of [-1.17,1.17]) H.box(g,0.06,2.1,0.5,'#f72585',x,1.05,0);
    H.box(g,2.4,0.12,0.5,'#c90f5c',0,0.06,0);
    H.box(g,2.4,0.06,0.52,'#f72585',0,2.08,0);
    for(const x of [-0.4,0.4]) H.box(g,0.05,1.9,0.44,'#f72585',x,1.05,0);
    // left bay: cupboard top + open niche + double doors
    H.box(g,0.72,0.5,0.44,'#f72585',-0.8,1.78,0); H.box(g,0.3,0.03,0.03,'#e8e8ee',-0.8,1.6,0.23);
    H.box(g,0.72,0.06,0.46,'#20242e',-0.8,1.02,0);
    for(const sx of [-1,1]) H.box(g,0.32,0.62,0.03,'#f72585',-0.8+sx*0.17,0.62,0.23);
    H.cyl(g,0.025,0.025,0.03,'#ffffff',-0.88,0.62,0.25,8); H.cyl(g,0.025,0.025,0.03,'#ffffff',-0.72,0.62,0.25,8);
    // middle bay: 3 lit shelves + 4 drawers
    for(let s=0;s<3;s++){ H.box(g,0.75,0.04,0.42,'#f72585',0,1.28+s*0.24,0);
      const led=new T.Mesh(new T.BoxGeometry(0.1,0.02,0.02),new T.MeshBasicMaterial({color:0xffe9b0}));
      led.position.set(0,1.26+s*0.24,0.1); g.add(led); }
    for(let dr=0;dr<4;dr++){ H.box(g,0.75,0.2,0.03,'#ff4d9a',0,0.25+dr*0.23,0.23); H.cyl(g,0.025,0.025,0.03,'#ffffff',0,0.25+dr*0.23,0.25,8); }
    H.box(g,0.75,0.06,0.46,'#20242e',0,1.02,0);
    // right bay: cupboard + open shelf + door + drawers
    H.box(g,0.72,0.5,0.44,'#f72585',0.8,1.78,0);
    for(const sx of [-1,1]){ const hb=new T.Mesh(new T.CylinderGeometry(0.015,0.015,0.22,8),H.mat('#e8e8ee',0.4,0.6)); hb.position.set(0.8+sx*0.12,1.78,0.23); g.add(hb); }
    H.box(g,0.72,0.04,0.42,'#f72585',0.8,1.32,0);
    H.box(g,0.72,0.06,0.46,'#20242e',0.8,1.02,0);
    H.box(g,0.34,0.62,0.03,'#f72585',0.63,0.62,0.23); H.cyl(g,0.025,0.025,0.03,'#ffffff',0.63,0.62,0.25,8);
    for(let dr=0;dr<3;dr++){ H.box(g,0.34,0.19,0.03,'#ff4d9a',0.97,0.42+dr*0.21,0.23);
      const hb=new T.Mesh(new T.BoxGeometry(0.16,0.02,0.02),H.mat('#e8e8ee',0.4,0.6)); hb.position.set(0.97,0.42+dr*0.21,0.25); g.add(hb); }
    void dark;
  }));
  L.push(D('snuggle_heart','glam','Snuggle Heart','💗',1.5,1.35,0.75,(g,T,H)=>{
    const fur=H.mat('#ff7ab8',1.0);
    const lobe=(x,y,z,sx,sy,sz)=>{ const m=new T.Mesh(new T.SphereGeometry(0.45,20,16),fur);
      m.scale.set(sx,sy,sz); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; g.add(m); };
    lobe(-0.33,0.38,-0.12,1.0,0.78,0.95); // left heart lobe
    lobe(0.33,0.38,-0.12,1.0,0.78,0.95);  // right heart lobe
    lobe(0,0.3,0.28,1.15,0.62,0.9);       // front snuggle dip surround
    const seat=new T.Mesh(new T.SphereGeometry(0.34,18,14),H.mat('#ff9cc8',1.0));
    seat.scale.set(1.1,0.35,1.0); seat.position.set(0,0.42,0.12); seat.receiveShadow=true; g.add(seat);
  }));
  L.push(D('puffy_pop','glam','Puffy Pop','🎈',0.95,0.95,0.8,(g,T,H)=>{
    const vinyl=H.mat('#ff8fc0',0.15), deep=H.mat('#f75a9e',0.2);
    const ring=new T.Mesh(new T.TorusGeometry(0.3,0.17,16,28),vinyl);
    ring.rotation.x=Math.PI/2; ring.position.set(0,0.32,0); ring.castShadow=true; ring.receiveShadow=true; g.add(ring);
    const seat=new T.Mesh(new T.CylinderGeometry(0.3,0.3,0.1,24),deep); seat.position.set(0,0.26,0.02); seat.receiveShadow=true; g.add(seat);
    const back=new T.Mesh(new T.SphereGeometry(0.3,20,16),vinyl);
    back.scale.set(1.15,1.0,0.75); back.position.set(0,0.52,-0.3); back.castShadow=true; g.add(back);
  }));
  return { list:L, helpers:H3 };
}

let _cache=null;
export function getCatalog(){
  if(!_cache){
    _cache=buildCatalog();
    // merge decor/outdoor upgrade pack (shelf slots + new defs) without touching builders above
    for(const d of _cache.list){
      if(SHELVES[d.id]) d.shelves=SHELVES[d.id];
      if(NOTOP.has(d.id)) d.noTop=true;
    }
    for(const d of EXTRA){ if(!_cache.list.find(v=>v.id===d.id)) _cache.list.push(d); }
  }
  return _cache;
}
export function defById(id){
  const c=getCatalog();
  return c.list.find(d=>d.id===id)||null;
}
