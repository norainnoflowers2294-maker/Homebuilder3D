// Realistic studio thumbnails for catalog cards. Uses the same procedural PBR textures as the 3D scene.
import { tex } from './mats.js';
let THREE = null;
let threePromise = null;

let renderer = null, scene = null, camera = null, keyL = null, fillL = null, hemi = null;
const cache = new Map();   // defId -> dataURL (null = failed, use icon)
const inflight = new Set();
let pumpScheduled = false;
const queue = [];

async function ensure(){
  if(!THREE){
    if(!threePromise) threePromise = import('three').then(mod => (THREE = mod)).catch(err => { threePromise = null; throw err; });
    await threePromise;
  }
  if(renderer) return;
  renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:true, powerPreference:'low-power'});
  renderer.setSize(224,224);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
  scene.background = new THREE.Color(0xf1eee8);
  hemi = new THREE.HemisphereLight(0xffffff, 0x6c6256, 1.35);
  scene.add(hemi);
  keyL = new THREE.DirectionalLight(0xfff4e5, 3.0);
  keyL.position.set(3.2, 5.5, 4.2);
  keyL.castShadow = true;
  keyL.shadow.mapSize.set(1024,1024);
  keyL.shadow.camera.left=-8; keyL.shadow.camera.right=8; keyL.shadow.camera.top=8; keyL.shadow.camera.bottom=-8;
  keyL.shadow.bias=-0.0002;
  scene.add(keyL);
  fillL = new THREE.DirectionalLight(0xdce7ff, 1.0);
  fillL.position.set(-3.5, 2.5, -3.2);
  scene.add(fillL);
  try{
    const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer),0.04).texture;
  }catch(e){ /* studio lights remain as a safe fallback */ }
}

function simpleH(){
  const materialCache = new Map();
  const mat = (c, rough=0.72, metal=0, clearcoat=0.08) => {
    const key = [c,rough,metal,clearcoat].join('|');
    if(materialCache.has(key)) return materialCache.get(key);
    const m = new THREE.MeshPhysicalMaterial({
      color:new THREE.Color(c||'#ffffff'), roughness:rough, metalness:metal,
      clearcoat, clearcoatRoughness:0.18
    });
    materialCache.set(key,m); return m;
  };
  const put=(parent,geo,m)=>{ const o=new THREE.Mesh(geo,m); o.castShadow=true; o.receiveShadow=true; parent.add(o); return o; };
  return {
    mat,
    tmat:(c,texName,rx=1,ry=1,rough=0.72,metal=0)=> {
      const m=mat(c,rough,metal,texName==='marble'||texName==='tile'?0.28:0.05);
      try{ const t=tex(THREE,texName||'wallpaint',rx||1,ry||1); if(t){ m.map=t; m.bumpMap=t; m.bumpScale=texName==='fabric'||texName==='carpet'?0.025:0.035; } }catch(e){}
      return m;
    },
    box:(parent,w,h,d,c,x=0,y=0,z=0,ry=0)=>{ const o=put(parent,new THREE.BoxGeometry(w,h,d),mat(c)); o.position.set(x,y,z); o.rotation.y=ry; return o; },
    tbox:(parent,w,h,d,c,texName,rx=1,ry=1,x=0,y=0,z=0,rough=0.72,metal=0)=>{ const o=put(parent,new THREE.BoxGeometry(w,h,d),this.tmat(c,texName,rx,ry,rough,metal)); o.position.set(x,y,z); return o; },
    mbox:(parent,w,h,d,c,rough=0.32,metal=0.88,x=0,y=0,z=0)=>{ const o=put(parent,new THREE.BoxGeometry(w,h,d),mat(c,rough,metal,0.35)); o.position.set(x,y,z); return o; },
    cyl:(parent,rt,rb,h,c,x=0,y=0,z=0,seg=18)=>{ const o=put(parent,new THREE.CylinderGeometry(rt,rb,h,seg),mat(c)); o.position.set(x,y,z); return o; },
    glass:(parent,w,h,d,x=0,y=0,z=0,op=0.35,c='#bcd8ff')=>{ const o=put(parent,new THREE.BoxGeometry(w,h,d),new THREE.MeshPhysicalMaterial({color:new THREE.Color(c),transparent:true,opacity:op,roughness:0.06,metalness:0.04,transmission:0.72,ior:1.48,thickness:0.1})); o.position.set(x,y,z); return o; },
    piv:(parent,x=0,y=0,z=0)=>{ const g=new THREE.Group(); g.position.set(x,y,z); parent.add(g); return g; },
    ix:(node)=>node,
  };
}
async function renderDef(def){
  await ensure();
  const g = new THREE.Group();
  const H = simpleH();
  def.build(g, THREE, H);
  // hide interactive lamp glow overload: keep as-is, small scene
  const box3 = new THREE.Box3().setFromObject(g);
  if(box3.isEmpty()) return null;
  const size = box3.getSize(new THREE.Vector3());
  const ctr = box3.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y*1.15, size.z) * 0.5;
  if(!(radius > 0)) return null;
  // soft ground disc
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius*1.7, 40),
    new THREE.MeshStandardMaterial({color:0xe8e2d8, roughness:0.96}));
  disc.rotation.x = -Math.PI/2;
  disc.position.set(ctr.x, box3.min.y - 0.004, ctr.z);
  disc.receiveShadow = true;
  scene.add(disc);
  scene.add(g);
  const dist = radius * 3.15 + 0.45;
  const az = Math.PI/5.2, el = 0.46;
  camera.position.set(
    ctr.x + dist*Math.cos(el)*Math.sin(az),
    ctr.y + dist*Math.sin(el)*0.9 + radius*0.35,
    ctr.z + dist*Math.cos(el)*Math.cos(az));
  camera.lookAt(ctr.x, ctr.y*0.92, ctr.z);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/webp',0.9);
  scene.remove(g); scene.remove(disc);
  return url;
}

async function pump(){
  pumpScheduled = false;
  let n = 0;
  while(queue.length && n < 2){
    const {def, img} = queue.shift();
    n++;
    if(inflight.has(def.id)) continue;
    inflight.add(def.id);
    try{
      let url = cache.has(def.id) ? cache.get(def.id) : undefined;
      if(url === undefined){
        url = await renderDef(def);
        cache.set(def.id, url || null);
      }
      if(url && img.isConnected && img.dataset.thumbFor === def.id) img.src = url;
    }catch(e){ cache.set(def.id, null); }
    finally { inflight.delete(def.id); }
  }
  if(queue.length && !pumpScheduled){
    pumpScheduled = true;
    (window.requestIdleCallback || ((fn)=>setTimeout(fn, 50)))(()=>{ pump().catch(()=>{}); }, {timeout:300});
  }
}

// Custom upload thumbnails (dataURL from importer) win; then cache; else queue a render.
export function requestThumb(def, img){
  if(!def || !img) return;
  if(def.thumb){ img.src = def.thumb; return; }
  if(cache.has(def.id)){
    const u = cache.get(def.id);
    if(u){ img.src = u; return; }
    return; // failed before: keep icon
  }
  img.dataset.thumbFor = def.id;
  if(!queue.some(q=>q.def.id===def.id && q.img===img)) queue.push({def, img});
  if(!pumpScheduled){
    pumpScheduled = true;
    (window.requestIdleCallback || ((fn)=>setTimeout(fn, 60)))(()=>{ pump().catch(()=>{}); }, {timeout:400});
  }
}

export function thumbCached(def){
  if(def?.thumb) return def.thumb;
  return cache.get(def?.id) || null;
}

// Synchronous thumbnail for non-DOM uses (2D plan): renders on demand and caches.
export function thumbNow(def){
  if(!def) return null;
  if(def.thumb) return def.thumb;
  return cache.get(def.id) || null;
}
