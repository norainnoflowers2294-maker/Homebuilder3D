// Procedural 3D thumbnails for catalog cards: renders each def's mesh offscreen
// with neutral studio lighting. Lazy + cached; falls back to a line icon.
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
  renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:true});
  renderer.setSize(144,144);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
  hemi = new THREE.HemisphereLight(0xffffff, 0x303030, 1.15);
  scene.add(hemi);
  keyL = new THREE.DirectionalLight(0xffffff, 2.2);
  keyL.position.set(3.2, 4.5, 2.6);
  scene.add(keyL);
  fillL = new THREE.DirectionalLight(0xcfd8ff, 0.7);
  fillL.position.set(-3, 1.6, -2.2);
  scene.add(fillL);
}

function simpleH(){
  const mat = (c)=>new THREE.MeshStandardMaterial({color:new THREE.Color(c), roughness:0.82, metalness:0.02});
  const put = (parent, geo, c)=>{
    const m = new THREE.Mesh(geo, mat(c));
    parent.add(m); return m;
  };
  return {
    mat,
    tmat:(c)=>mat(c),
    box:(parent,w,h,d,c,x=0,y=0,z=0)=>{ const m=put(parent,new THREE.BoxGeometry(w,h,d),c); m.position.set(x,y,z); return m; },
    tbox:(parent,w,h,d,c,_t,_rx,_ry,x=0,y=0,z=0)=>{ const m=put(parent,new THREE.BoxGeometry(w,h,d),c); m.position.set(x,y,z); return m; },
    mbox:(parent,w,h,d,c,_r,_m,x=0,y=0,z=0)=>{ const m=put(parent,new THREE.BoxGeometry(w,h,d),c); m.position.set(x,y,z); return m; },
    cyl:(parent,rt,rb,h,c,x=0,y=0,z=0,seg=14)=>{ const m=put(parent,new THREE.CylinderGeometry(rt,rb,h,seg),c); m.position.set(x,y,z); return m; },
    glass:(parent,w,h,d,x=0,y=0,z=0,op=0.35,c='#bcd8ff')=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
        new THREE.MeshStandardMaterial({color:new THREE.Color(c),transparent:true,opacity:op,roughness:0.15,metalness:0.1}));
      m.position.set(x,y,z); parent.add(m); return m; },
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
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius*1.5, 28),
    new THREE.MeshStandardMaterial({color:0xe6dcc2, roughness:1}));
  disc.rotation.x = -Math.PI/2;
  disc.position.set(ctr.x, box3.min.y - 0.002, ctr.z);
  scene.add(disc);
  scene.add(g);
  const dist = radius * 3.4 + 0.4;
  const az = Math.PI/5.2, el = 0.46;
  camera.position.set(
    ctr.x + dist*Math.cos(el)*Math.sin(az),
    ctr.y + dist*Math.sin(el)*0.9 + radius*0.35,
    ctr.z + dist*Math.cos(el)*Math.cos(az));
  camera.lookAt(ctr.x, ctr.y*0.92, ctr.z);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
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
