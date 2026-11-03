// Cloud project sync for HomeCraft 3D (Supabase).
// Offline-first: localStorage stays the source of truth; cloud is layered on.
// - projects.data holds the whole house document {state} (floors/rooms/items
//   included — the app's document model, no redesign).
// - custom-model binaries live in storage; project data keeps pointers.
// - every overwrite is preceded by an append-only backup row.
import { getClient } from './client.js';
import { createProject } from '../store.js';

const LS_MAP = 'hc.sb.map';       // { localPid: cloudUuid }
const LS_HASH = 'hc.sb.hash.';    // last pushed hash per localPid
const MAX_BACKUPS = 20;

function loadMap() { try { return JSON.parse(localStorage.getItem(LS_MAP) || '{}'); } catch (e) { return {}; } }
function saveMap(m) { try { localStorage.setItem(LS_MAP, JSON.stringify(m)); } catch (e) {} }
function lastHash(pid) { try { return localStorage.getItem(LS_HASH + pid) || ''; } catch (e) { return ''; } }
function setLastHash(pid, h) { try { localStorage.setItem(LS_HASH + pid, h); } catch (e) {} }

// FNV-1a over the serialised payload — cheap dirty check for autosave.
export function payloadHash(state) {
  const s = JSON.stringify(state && state.floors ? { f: state.floors, s: state.settings } : state);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16) + ':' + s.length;
}

// ---------- project rows (metadata lists stay light) ----------
export async function listCloudProjects(page = 0, pageSize = 25) {
  const sb = await getClient();
  const from = page * pageSize, to = from + pageSize - 1;
  const { data, error, count } = await sb.from('projects')
    .select('id,name,updated_at,created_at', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, to);
  if (error) throw new Error(String(error.message || error));
  return { rows: data || [], total: count || 0 };
}

export async function cloudUuidFor(localPid) { return loadMap()[localPid] || null; }

// Split custom-model binaries out of the pushed doc (binaries -> storage).
async function extractBinaries(sb, uid, custom) {
  const out = [];
  for (const c of (custom || [])) {
    const copy = { ...c };
    const du = c.dataUrl;
    if (typeof du === 'string' && du.startsWith('data:')) {
      const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(du);
      if (m) {
        const mime = m[1] || 'model/gltf-binary';
        const ext = /gltf/i.test(mime) ? 'gltf' : /obj/i.test(mime) ? 'obj' : /stl/i.test(mime) ? 'stl' : /zip/i.test(mime) ? 'zip' : 'glb';
        const path = uid + '/models/' + (c.id || ('m' + Date.now())) + '.' + ext;
        const bytes = Uint8Array.from(atob(m[3]), ch => ch.charCodeAt(0));
        const { error } = await sb.storage.from('hc-assets').upload(path, bytes, { contentType: mime, upsert: true });
        if (error) throw new Error('Asset upload failed: ' + String(error.message || error));
        try {
          await sb.from('assets').upsert(
            { owner_id: uid, kind: 'model', name: c.name || c.id, mime, size_bytes: bytes.length, storage_path: path },
            { onConflict: 'owner_id,storage_path' });
        } catch (e) {}
        delete copy.dataUrl;
        copy.assetRef = path;
      }
    }
    out.push(copy);
  }
  return out;
}

// Resolve storage pointers back into dataUrls (cached in-memory by caller).
export async function resolveRefs(sb, custom, cache) {
  const out = [];
  for (const c of (custom || [])) {
    if (c.dataUrl || !c.assetRef) { out.push(c); continue; }
    const hit = cache && cache[c.assetRef];
    if (hit) { out.push({ ...c, dataUrl: hit }); continue; }
    const { data, error } = await sb.storage.from('hc-assets').download(c.assetRef);
    if (error || !data) { out.push({ ...c, _missing: true }); continue; }
    const du = await new Promise(res => {
      const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(data);
    });
    if (du && cache) cache[c.assetRef] = du;
    out.push(du ? { ...c, dataUrl: du } : { ...c, _missing: true });
  }
  return out;
}

export async function pushProject(app, { manual = false } = {}) {
  const sb = await getClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const localPid = app.projectId;
  const name = (app.projectName && app.projectName()) || 'My House';
  const custom = await extractBinaries(sb, user.id, app.custom || []);
  const doc = { v: 1, savedAt: Date.now(), state: app.state, custom };
  const map = loadMap();
  let uuid = map[localPid] || null;
  if (uuid) {
    // Preserve a backup before overwriting (only if remote changed).
    try {
      const { data: cur } = await sb.from('projects').select('data').eq('id', uuid).maybeSingle();
      if (cur && JSON.stringify(cur.data) !== JSON.stringify(doc)) {
        await sb.from('project_backups').insert({ project_id: uuid, owner_id: user.id, label: manual ? 'manual' : 'auto', data: cur.data });
        await pruneBackups(sb, uuid, user.id);
      }
    } catch (e) {}
    const { error } = await sb.from('projects').update({ name, data: doc }).eq('id', uuid);
    if (error) throw new Error(String(error.message || error));
  } else {
    const { data, error } = await sb.from('projects').insert({ owner_id: user.id, name, data: doc }).select('id').single();
    if (error) throw new Error(String(error.message || error));
    uuid = data.id;
    map[localPid] = uuid; saveMap(map);
  }
  setLastHash(localPid, payloadHash(app.state));
  // Read-back: prove the write actually landed before callers claim success.
  try {
    const { data: back, error: backErr } = await sb.from('projects').select('data').eq('id', uuid).single();
    if (backErr || !back) throw new Error(String((backErr && backErr.message) || 'empty read-back'));
    if (JSON.stringify(back.data) !== JSON.stringify(doc))
      throw new Error('read-back mismatch — the cloud copy differs from what was sent');
  } catch (e) {
    if (e && e.message && /read-back mismatch|empty read-back/.test(e.message)) throw e;
    throw new Error('Save sent but could not be verified: ' + String((e && e.message) || e));
  }
  return uuid;
}

// Pull a cloud project into a NEW local project (never clobbers current work).
export async function pullProjectToLocal(app, cloudId, refCache) {
  const sb = await getClient();
  const { data, error } = await sb.from('projects').select('id,name,data').eq('id', cloudId).single();
  if (error || !data) throw new Error('Project not found or not yours.');
  const doc = data.data || {};
  if (!doc.state || !doc.state.floors) throw new Error('Cloud project has no house data.');
  const custom = await resolveRefs(sb, doc.custom || [], refCache);
  const missing = custom.filter(c => c._missing).length;
  const { createProject: mk } = await import('../store.js');
  const nid = mk('☁ ' + (data.name || 'House'), doc.state);
  try {
    const { saveCustom } = await import('../store.js');
    saveCustom(custom.map(({ _missing, ...c }) => c));
  } catch (e) {}
  return { localId: nid, missing };
}

export async function renameCloudProject(cloudId, name) {
  const sb = await getClient();
  const { error } = await sb.from('projects').update({ name }).eq('id', cloudId);
  if (error) throw new Error(String(error.message || error));
}

// Delete via server-side function (backup first); falls back to manual flow.
export async function deleteCloudProject(cloudId) {
  const sb = await getClient();
  try {
    const { data, error } = await sb.rpc('delete_project_safe', { p_id: cloudId });
    if (!error && data) return true;
  } catch (e) {}
  // Manual fallback: backup row, then delete assets + project (RLS enforced).
  const { data: { user } } = await sb.auth.getUser();
  const { data: cur, error: e1 } = await sb.from('projects').select('id,name,data').eq('id', cloudId).single();
  if (e1 || !cur) throw new Error('Project not found or not yours.');
  await sb.from('project_backups').insert({ project_id: cloudId, owner_id: user.id, label: 'pre-delete', data: cur.data });
  await sb.from('assets').delete().eq('project_id', cloudId);
  const { error: e2 } = await sb.from('projects').delete().eq('id', cloudId);
  if (e2) throw new Error(String(e2.message || e2));
  return true;
}

export async function listBackups(cloudId, limit = 20) {
  const sb = await getClient();
  const { data, error } = await sb.from('project_backups')
    .select('id,label,created_at').eq('project_id', cloudId)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(String(error.message || error));
  return data || [];
}

export async function restoreBackup(app, backupId, refCache) {
  const sb = await getClient();
  const { data, error } = await sb.from('project_backups').select('project_id,data').eq('id', backupId).single();
  if (error || !data) throw new Error('Backup not found or not yours.');
  if (!data.data || !data.data.state || !data.data.state.floors) throw new Error('Backup has no house data.');
  const custom = await resolveRefs(sb, data.data.custom || [], refCache);
  app.pushUndo();
  app.state = data.data.state;
  try {
    const { saveCustom } = await import('../store.js');
    app.custom = custom.map(({ _missing, ...c }) => c);
    saveCustom(app.custom);
  } catch (e) {}
  const { saveState } = await import('../store.js');
  saveState(app.state);
  app.syncAll();
  return custom.filter(c => c._missing).length;
}

async function pruneBackups(sb, projectId, uid) {
  try {
    const { data } = await sb.from('project_backups').select('id').eq('project_id', projectId)
      .order('created_at', { ascending: false }).range(MAX_BACKUPS, MAX_BACKUPS + 50);
    if (data && data.length) {
      await sb.from('project_backups').delete().in('id', data.map(r => r.id));
    }
  } catch (e) {}
}

// For the status indicator: is the current local project in sync with cloud?
export async function syncState(app) {
  try {
    const sb = await getClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return { loggedIn: false };
    const uuid = loadMap()[app.projectId];
    if (!uuid) return { loggedIn: true, linked: false };
    const { data, error } = await sb.from('projects').select('updated_at').eq('id', uuid).maybeSingle();
    if (error || !data) return { loggedIn: true, linked: false };
    const dirty = payloadHash(app.state) !== lastHash(app.projectId);
    return { loggedIn: true, linked: true, cloudUpdatedAt: data.updated_at, dirty };
  } catch (e) { return { loggedIn: false, error: true }; }
}

export { createProject };
