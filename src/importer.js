// 3D Model Importer pipeline for HomeCraft 3D
// Supports .glb, .gltf, .obj, .fbx, .stl, .3ds, .zip

export function guessFromName(name = '') {
  const n = name.toLowerCase().replace(/[-_.]/g, ' ');
  if (/chair|stool|seat|bench|armchair|recliner/.test(n)) return { cat: 'chairs', room: 'Living room' };
  if (/sofa|couch|loveseat|sectional|futon/.test(n)) return { cat: 'living', room: 'Living room' };
  if (/bed|mattress|nightstand|dresser|wardrobe|closet/.test(n)) return { cat: 'bedroom', room: 'Bedroom' };
  if (/table|desk|dining/.test(n)) return { cat: 'dining', room: 'Dining room' };
  if (/lamp|light|chandelier|sconce|lantern/.test(n)) return { cat: 'lighting', room: 'Living room' };
  if (/plant|flower|tree|pot|vase|greenery|bush/.test(n)) return { cat: 'plants', room: 'Living room' };
  if (/cabinet|counter|sink|fridge|refrigerator|oven|stove|kitchen/.test(n)) return { cat: 'kitchen', room: 'Kitchen' };
  if (/bath|tub|shower|toilet|vanity/.test(n)) return { cat: 'bath', room: 'Bathroom' };
  if (/shelf|bookshelf|bookcase|rack/.test(n)) return { cat: 'shelving', room: 'Living room' };
  if (/art|mirror|clock|painting|poster|frame|tv|screen/.test(n)) return { cat: 'walldecor', room: 'Living room' };
  return { cat: 'decor', room: 'Living room' };
}

export async function importModelFile(file, THREE, onProgress) {
  if (onProgress) onProgress('Reading file…');
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const ext = file.name.split('.').pop().toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());

  let obj = null;
  if (onProgress) onProgress('Parsing 3D geometry…');

  if (ext === 'glb' || ext === 'gltf') {
    const { GLTFLoader } = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const gltf = await new Promise((res, rej) => loader.parse(bytes.buffer, '', res, rej));
    obj = gltf.scene;
  } else if (ext === 'obj') {
    const { OBJLoader } = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js');
    const text = new TextDecoder().decode(bytes);
    obj = new OBJLoader().parse(text);
  } else if (ext === 'stl') {
    const { STLLoader } = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/STLLoader.js');
    const geo = new STLLoader().parse(bytes.buffer);
    geo.computeVertexNormals();
    obj = new THREE.Group();
    obj.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xbfae94, roughness: 0.8 })));
  } else if (ext === 'fbx') {
    const { FBXLoader } = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js');
    obj = new FBXLoader().parse(bytes.buffer, '');
  } else {
    throw new Error(`Unsupported 3D file format: .${ext}`);
  }

  // Compute bounding box dimensions
  const bbox = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  const dims = {
    w: +(Math.max(0.1, size.x)).toFixed(2),
    d: +(Math.max(0.1, size.z)).toFixed(2),
    h: +(Math.max(0.1, size.y)).toFixed(2)
  };

  if (onProgress) onProgress('Rendering thumbnail…');
  let thumb = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 180;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(180, 180);
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dir = new THREE.DirectionalLight(0xfff5ea, 1.5);
    dir.position.set(3, 5, 4);
    scene.add(dir);

    const clone = obj.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    box.getCenter(center);
    clone.position.sub(center);
    scene.add(clone);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(maxDim * 1.5, maxDim * 1.2, maxDim * 1.8);
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    thumb = canvas.toDataURL('image/png');
    renderer.dispose();
  } catch (e) {
    console.warn('Thumb generation failed', e);
  }

  return {
    baseName,
    dims,
    obj,
    thumb,
    fmt: ext,
    bytes
  };
}

export async function loadModelFromFiles(primary, files, THREE) {
  if (primary.ext === 'glb' || primary.ext === 'gltf') {
    const { GLTFLoader } = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const gltf = await new Promise((res, rej) => loader.parse(primary.bytes.buffer, '', res, rej));
    return gltf.scene;
  }
  if (primary.ext === 'obj') {
    const { OBJLoader } = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js');
    const text = new TextDecoder().decode(primary.bytes);
    return new OBJLoader().parse(text);
  }
  if (primary.ext === 'stl') {
    const { STLLoader } = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/STLLoader.js');
    const geo = new STLLoader().parse(primary.bytes.buffer);
    geo.computeVertexNormals();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xbfae94, roughness: 0.8 })));
    return group;
  }
  return null;
}
