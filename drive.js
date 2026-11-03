// Google Drive cloud backup for HomeCraft 3D (own-file scope, no server needed).
// Setup: user pastes their own OAuth client ID (one-time, stored locally).
// Uses GIS token client + Drive v3 REST (resumable uploads, any size).
import { saveState, saveCustom, listProjectsMeta, normalizeState } from './store.js';
import { googleAuth } from './google_auth.js';

const LS_ID = 'hc.drive.clientId';
const FOLDER = 'HomeCraft 3D';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

export function initDrive(app, toast) {
  const $ = s => document.querySelector(s);
  const statusEl = $('#driveStatusText'), connBtn = $('#driveConnectBtn');
  const setupEl = $('#driveSetup'), connectedEl = $('#driveConnected');
  const filesEl = $('#driveFiles'), idInput = $('#driveIdInput');
  if (!statusEl || !connBtn) return;
  const S = {
    clientId: googleAuth.clientId || null, token: googleAuth.getToken() || null, tokenExp: googleAuth.tokenExpiry || 0, email: googleAuth.getUser()?.email || '', folderId: null, busy: false, setupWanted: false,
  };
  try { if (!S.clientId) S.clientId = localStorage.getItem(LS_ID) || null; } catch (e) {}
  if (idInput && S.clientId) idInput.value = S.clientId;
  
  // Listen for Google Auth changes
  googleAuth.onAuth(user => {
    if (user && googleAuth.getToken()) {
      S.token = googleAuth.getToken();
      S.tokenExp = googleAuth.tokenExpiry;
      S.email = user.email || '';
      S.clientId = googleAuth.clientId;
      render();
      refreshList().catch(() => {});
    } else if (!user) {
      S.token = null;
      S.email = '';
      render();
    }
  });
  const originEl = $('#driveOrigin');
  if (originEl) originEl.textContent = location.origin;
  const copyBtn = $('#driveCopyOrigin');
  if (copyBtn) copyBtn.onclick = async () => {
    try { await navigator.clipboard.writeText(location.origin); toast('Origin copied'); }
    catch (e) {
      const r = document.createRange(); r.selectNodeContents(originEl);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      toast('Copy the highlighted origin');
    }
  };

  function render() {
    const connected = !!S.token;
    if (connected) S.setupWanted = false;
    if (setupEl) setupEl.hidden = connected || !S.setupWanted;
    if (connectedEl) connectedEl.hidden = !connected;
    if (connected) {
      statusEl.textContent = 'Connected' + (S.email ? ' as ' + S.email : '') + ' — backups in “' + FOLDER + '”.';
      connBtn.hidden = true;
    } else {
      connBtn.hidden = false;
      connBtn.textContent = 'Connect Drive';
      if (!S.clientId) statusEl.textContent = 'Not connected (local storage only)';
      else if (statusEl.dataset.mode !== 'busy') statusEl.textContent = S.notice || 'Ready — connect to back up to Drive';
    }
  }
  function busy(b, msg) {
    S.busy = b;
    if (b) { statusEl.dataset.mode = 'busy'; statusEl.textContent = msg || 'Working…'; }
    else delete statusEl.dataset.mode;
    for (const id of ['#driveConnectBtn', '#driveIdSave', '#driveSaveBtn', '#driveRefreshBtn', '#driveDisconnectBtn']) {
      const el = $(id); if (el) el.disabled = b;
    }
  }
  function gis() { return window.google && window.google.accounts && window.google.accounts.oauth2; }
  function authed() { return S.token && Date.now() < S.tokenExp - 60000; }

  async function api(path, opts = {}) {
    if (!authed()) throw { expired: true };
    const r = await fetch('https://www.googleapis.com' + path, {
      ...opts,
      headers: { Authorization: 'Bearer ' + S.token, ...(opts.headers || {}) },
    });
    if (r.status === 401) { S.token = null; render(); throw { expired: true }; }
    if (!r.ok) { let t = ''; try { t = await r.text(); } catch (e) {} throw new Error('Drive error ' + r.status + ' ' + t.slice(0, 160)); }
    const ct = r.headers.get('content-type') || '';
    return ct.includes('json') ? r.json() : r.text();
  }
  const q = s => encodeURIComponent(s);

  async function connect() {
    if (S.busy) return;
    S.notice = null;
    busy(true, 'Connecting to Google Drive…');
    try {
      const user = await googleAuth.signIn();
      S.token = googleAuth.getToken();
      S.tokenExp = googleAuth.tokenExpiry;
      S.email = user.email || '';
      S.clientId = googleAuth.clientId;
      busy(false);
      render();
      toast(S.email ? 'Connected to Google Drive as ' + S.email : 'Google Drive connected');
      refreshList().catch(() => {});
    } catch (err) {
      busy(false);
      if (gis() && S.clientId) {
        try {
          const tc = gis().initTokenClient({
            client_id: S.clientId, scope: SCOPE, prompt: '',
            callback: async resp => {
              if (resp?.access_token) {
                S.token = resp.access_token;
                S.tokenExp = Date.now() + ((+resp.expires_in || 3600) * 1000);
                try {
                  const about = await api('/drive/v3/about?fields=user');
                  S.email = (about && about.user && about.user.emailAddress) || '';
                } catch(e) {}
                render();
                toast('Google Drive connected');
                refreshList().catch(() => {});
              }
            }
          });
          tc.requestAccessToken();
          return;
        } catch(e) {}
      }
      S.notice = 'Sign-in cancelled or failed: ' + String(err.message || err);
      render();
    }
  }

  async function ensureFolder() {
    if (S.folderId) return S.folderId;
    const found = await api(`/drive/v3/files?q=${q(`name='${FOLDER.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)&pageSize=1`);
    if (found && found.files && found.files.length) { S.folderId = found.files[0].id; return S.folderId; }
    const created = await api('/drive/v3/files?fields=id', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
    });
    S.folderId = created.id; return S.folderId;
  }

  function projectLabel() {
    let name = 'My House';
    try {
      const m = listProjectsMeta();
      if (m && m.meta && m.meta[app.projectId] && m.meta[app.projectId].name) name = m.meta[app.projectId].name;
    } catch (e) {}
    const pid = String(app.projectId || 'house').slice(-6);
    return { name, file: ('HomeCraft-' + name + '-' + pid + '.json').replace(/[^\w\-. ()]+/g, '_') };
  }

  async function resumableUpload(url, metadata, bytes) {
    const init = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + S.token,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'application/json',
        'X-Upload-Content-Length': String(bytes.length),
      },
      body: metadata ? JSON.stringify(metadata) : undefined,
    });
    if (init.status === 401) { S.token = null; render(); throw { expired: true }; }
    if (!init.ok) throw new Error('Upload start failed (' + init.status + ')');
    const session = init.headers.get('location');
    if (!session) throw new Error('Upload start failed (no session)');
    const put = await fetch(session, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: bytes });
    if (put.status === 401) { S.token = null; render(); throw { expired: true }; }
    if (!put.ok) throw new Error('Upload failed (' + put.status + ')');
    return put.json();
  }

  async function saveBackup() {
    if (S.busy || !authed()) { statusEl.textContent = S.clientId ? 'Session expired — click Connect Drive.' : 'Connect Drive first.'; return; }
    busy(true, 'Saving backup to Drive…');
    try {
      const folderId = await ensureFolder();
      const { name, file } = projectLabel();
      const payload = JSON.stringify({ app: 'homecraft3d', v: 1, savedAt: Date.now(), projectId: app.projectId, projectName: name, state: app.state, custom: app.custom });
      const bytes = new TextEncoder().encode(payload);
      const esc = file.replace(/'/g, "\\'");
      const found = await api(`/drive/v3/files?q=${q(`name='${esc}' and '${folderId}' in parents and trashed=false`)}&fields=files(id)&pageSize=1`);
      if (found && found.files && found.files.length) {
        await resumableUpload(`https://www.googleapis.com/upload/drive/v3/files/${found.files[0].id}?uploadType=resumable`, null, bytes);
      } else {
        await resumableUpload('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
          { name: file, parents: [folderId], mimeType: 'application/json', description: 'HomeCraft 3D backup of ' + name }, bytes);
      }
      statusEl.textContent = 'Backed up just now as ' + file;
      toast('Backup saved to Drive');
      await refreshList();
    } catch (err) {
      statusEl.textContent = err && err.expired ? 'Session expired — click Connect Drive.' : 'Backup failed: ' + String((err && err.message) || err);
    } finally { busy(false); if (!S.token) render(); else delete statusEl.dataset.mode; }
  }

  async function refreshList() {
    if (!filesEl) return;
    if (!authed()) return;
    try {
      const folderId = await ensureFolder();
      const list = await api(`/drive/v3/files?q=${q(`'${folderId}' in parents and trashed=false`)}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size)&pageSize=25`);
      const files = (list && list.files) || [];
      filesEl.innerHTML = '';
      if (!files.length) { filesEl.textContent = 'No backups yet — click “Save backup now”.'; return; }
      for (const f of files) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;background:#0f1522;border:1px solid #3a4a6b;border-radius:8px;padding:6px 8px;';
        const dt = f.modifiedTime ? new Date(f.modifiedTime).toLocaleString() : '';
        const kb = f.size ? (f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(f.size / 1024)) + ' KB') : '';
        const label = document.createElement('span');
        label.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;';
        label.textContent = f.name; label.title = f.name + ' • ' + dt + (kb ? ' • ' + kb : '');
        const sub = document.createElement('small');
        sub.style.cssText = 'color:#8fa5c4;flex:0 0 auto;';
        sub.textContent = dt + (kb ? ' • ' + kb : '');
        const btn = document.createElement('button');
        btn.className = 'btn small'; btn.type = 'button'; btn.textContent = 'Load';
        btn.onclick = () => loadBackup(f.id, f.name);
        row.append(label, sub, btn);
        filesEl.appendChild(row);
      }
    } catch (err) {
      if (filesEl) filesEl.textContent = err && err.expired ? 'Session expired — click Connect Drive.' : 'List failed: ' + String((err && err.message) || err);
    }
  }

  async function loadBackup(id, name) {
    if (S.busy || !authed()) { toast('Connect Drive first'); return; }
    if (!confirm('Load “' + name + '” from Drive? Current unsaved changes on this device will be replaced (undoable).')) return;
    busy(true, 'Loading ' + name + '…');
    try {
      const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media', { headers: { Authorization: 'Bearer ' + S.token } });
      if (r.status === 401) throw { expired: true };
      if (!r.ok) throw new Error('Download failed (' + r.status + ')');
      const j = JSON.parse(await r.text());
      if (!j || !j.state || !j.state.floors) throw new Error('Not a HomeCraft backup');
      app.pushUndo();
      normalizeState(j.state);
      app.state = j.state;
      if (j.custom) { app.custom = j.custom; saveCustom(app.custom); }
      saveState(app.state);
      app.syncAll();
      toast('Backup loaded');
    } catch (err) {
      toast(err && err.expired ? 'Session expired — reconnect' : 'Load failed: ' + String((err && err.message) || err));
    } finally { busy(false); if (!S.token) render(); }
  }

  connBtn.onclick = () => {
    if (authed()) return;
    S.token = null;
    if (!S.clientId) { S.setupWanted = true; render(); if (idInput) idInput.focus(); return; }
    connect();
  };
  const idSave = $('#driveIdSave');
  if (idSave) idSave.onclick = () => {
    const v = (idInput && idInput.value || '').trim();
    if (!/\.apps\.googleusercontent\.com$/.test(v)) { toast('That doesn’t look like a client ID'); if (idInput) idInput.focus(); return; }
    S.clientId = v;
    try { localStorage.setItem(LS_ID, v); } catch (e) {}
    S.setupWanted = false; render();
    connect();
  };
  const saveBtn = $('#driveSaveBtn');
  if (saveBtn) saveBtn.onclick = saveBackup;
  const refBtn = $('#driveRefreshBtn');
  if (refBtn) refBtn.onclick = () => refreshList().catch(() => {});
  const disBtn = $('#driveDisconnectBtn');
  if (disBtn) disBtn.onclick = () => {
    if (S.token && gis() && S.clientId) { try { gis().revoke(S.token, () => {}); } catch (e) {} }
    S.token = null; S.email = ''; S.folderId = null; S.notice = null;
    render();
    statusEl.textContent = 'Disconnected. Local saves are untouched.';
  };
  render();
}
