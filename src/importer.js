// HomeCraft 3D model importer.
// The upload review in app.js expects a normalized result containing source metadata,
// original bytes, dimensions, mesh/triangle counts and a thumbnail.
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

const loaderBase = 'https://esm.sh/three@0.187.0/examples/jsm/loaders/';
async function parseModel(fileName, bytes, THREE, sidecars = []) {
  const ext = fileName.split('.').pop().toLowerCase();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  if (ext === 'glb' || ext === 'gltf') {
    const { GLTFLoader } = await import(loaderBase + 'GLTFLoader.js');
    const manager = new THREE.LoadingManager();
    const urls = [];
    const byName = new Map();
    for (const f of sidecars) {
      const url = URL.createObjectURL(new Blob([f.bytes]));
      urls.push(url);
      byName.set(String(f.base || f.path || '').split('/').pop().toLowerCase(), url);
    }
    manager.setURLModifier(url => {
      const clean = decodeURIComponent(url.split(/[?#]/)[0]).split('/').pop().toLowerCase();
      return byName.get(clean) || url;
    });
    try {
      const loader = new GLTFLoader(manager);
      const input = ext === 'glb' ? buffer : new TextDecoder().decode(bytes);
      const gltf = await new Promise((resolve, reject) => loader.parse(input, '', resolve, reject));
      return gltf.scene || gltf.scenes?.[0];
    } finally {
      // Loader has fetched the referenced blobs by the time parse resolves.
      setTimeout(() => urls.forEach(URL.revokeObjectURL), 30000);
    }
  }
  if (ext === 'obj') {
    const { OBJLoader } = await import(loaderBase + 'OBJLoader.js');
    return new OBJLoader().parse(new TextDecoder().decode(bytes));
  }
  if (ext === 'stl') {
    const { STLLoader } = await import(loaderBase + 'STLLoader.js');
    const geo = new STLLoader().parse(buffer);
    geo.computeVertexNormals();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xbfae94, roughness: 0.8 })));
    return group;
  }
  if (ext === 'fbx') {
    const { FBXLoader } = await import(loaderBase + 'FBXLoader.js');
    return new FBXLoader().parse(buffer, '');
  }
  if (ext === '3ds') {
    const { TDSLoader } = await import(loaderBase + 'TDSLoader.js');
    return new TDSLoader().parse(buffer, '');
  }
  throw new Error('Unsupported 3D format: .' + ext + '. Use GLB, GLTF, OBJ, FBX, STL or 3DS.');
}

function inspectObject(obj, THREE) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const dims = {
    w: +Math.max(0.1, size.x).toFixed(2),
    d: +Math.max(0.1, size.z).toFixed(2),
    h: +Math.max(0.1, size.y).toFixed(2)
  };
  let meshes = 0, tris = 0, textures = 0;
  const textureNames = new Set();
  obj.traverse(node => {
    if (!node.isMesh || !node.geometry) return;
    meshes++;
    const g = node.geometry;
    const indexCount = g.index ? g.index.count : (g.attributes.position?.count || 0);
    const mode = node.material?.wireframe ? 1 : 3;
    tris += Math.floor(indexCount / mode);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of materials) if (mat) {
      for (const [key, value] of Object.entries(mat)) {
        if (value?.isTexture) {
          textures++;
          const image = value.image;
          const name = image?.currentSrc || image?.src || value.name || key;
          if (name) textureNames.add(String(name).split('/').pop());
        }
      }
    }
  });
  return { dims, meshes, tris, texFiles: [...textureNames] };
}

async function makeThumbnail(obj, THREE) {
  let renderer;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 180;
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(180, 180);
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.3));
    const light = new THREE.DirectionalLight(0xfff5ea, 1.5);
    light.position.set(3, 5, 4);
    scene.add(light);
    const clone = obj.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    box.getCenter(center);
    clone.position.sub(center);
    scene.add(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, Math.max(100, maxDim * 10));
    camera.position.set(maxDim * 1.5, maxDim * 1.2, maxDim * 1.8);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Model thumbnail unavailable', err);
    return null;
  } finally {
    renderer?.dispose();
  }
}

export async function importModelFile(file, THREE, onProgress) {
  if (!file) throw new Error('No file was selected.');
  const started = performance.now();
  const srcFile = file.name || 'model';
  const srcExt = srcFile.split('.').pop().toLowerCase();
  const allowed = ['glb', 'gltf', 'obj', 'fbx', 'stl', '3ds'];
  if (!allowed.includes(srcExt)) {
    throw new Error('That is not a supported 3D model. Choose a .glb, .gltf, .obj, .fbx, .stl or .3ds file. A .json file is a house/project backup, not a 3D model.');
  }
  onProgress?.('Reading ' + srcFile + '…');
  const originalBytes = new Uint8Array(await file.arrayBuffer());
  if (!originalBytes.length) throw new Error('The selected file is empty.');
  onProgress?.('Parsing 3D geometry…');
  const obj = await parseModel(srcFile, originalBytes, THREE);
  if (!obj) throw new Error('The file did not contain a 3D scene.');
  const info = inspectObject(obj, THREE);
  if (!info.meshes) throw new Error('The file opened, but it contains no visible mesh geometry.');
  onProgress?.('Creating model preview…');
  const thumb = await makeThumbnail(obj, THREE);
  const warnings = [];
  if (srcExt === 'gltf') warnings.push('A .gltf file that references separate .bin or image files needs those companion files too. For easiest importing, export as a single .glb file.');
  if (srcExt === 'obj') warnings.push('OBJ material/texture files are separate. Export as GLB to keep materials and textures together.');
  if (srcExt === 'stl') warnings.push('STL stores geometry only. It does not include the original materials or textures.');
  return {
    baseName: srcFile.replace(/\.[^/.]+$/, ''),
    srcFile, srcExt, dims: info.dims, meshes: info.meshes, tris: info.tris,
    texFiles: info.texFiles, mtlFile: null, thumb, obj, fmt: srcExt,
    originalBytes, bytes: originalBytes, optimized: null, allFiles: [{ path: srcFile, base: srcFile, ext: srcExt, bytes: originalBytes }],
    warnings, ms: Math.round(performance.now() - started)
  };
}

export async function loadModelFromFiles(primary, files, THREE) {
  if (!primary) throw new Error('The main 3D model file is missing.');
  const sidecars = (files || []).filter(f => f !== primary);
  return parseModel(primary.base || primary.path || primary.name, primary.bytes, THREE, sidecars);
}
