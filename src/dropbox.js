// Dropbox cloud backup for HomeCraft 3D (app-folder scope, no server needed).
// Setup: user pastes their own Dropbox app key (one-time, stored locally).
// Uses OAuth2 implicit grant via full-page redirect back to this app; the
// token arrives in location.hash and is picked up on boot. Files live in the
// app's own Dropbox folder, so the app can never see anything else.
import { saveState, saveCustom, listProjectsMeta, normalizeState } from './store.js';

const LS_KEY = 'hc.dropbox.appKey';
const LS_TOK = 'hc.dropbox.token';
const LS_EXP = 'hc.dropbox.exp';
const LS_STATE = 'hc.dropbox.state';

function redirectUri() { return location.origin + location.pathname; }

export function initDropbox(app, toast) {
  const $ = s => document.querySelector(s);
  const statusEl = $('#dbStatusText'), connBtn = $('#dbConnectBtn');
  const setupEl = $('#dbSetup'), connectedEl = $('#dbConnected');
  const filesEl = $('#dbFiles'), keyInput = $('#dbAppKeyInput');
  if (!statusEl || !connBtn) return;
  const S = {
    appKey: null, token: null, exp: 0, email: '', busy: false, setupWanted: false,
  };
  try {
    S.appKey = localStorage.getItem(LS_KEY) || null;
    S.token = localStorage.getItem(LS_TOK) || null;
    S.exp = +(localStorage.getItem(LS_EXP) || 0);
  } catch (e) {}
  if (keyInput && S.appKey) keyInput.value = S.appKey;
  const uriEl = $('#dbRedirect');
  if (uriEl) uriEl.textContent = redirectUri();
  const copyBtn = $('#dbCopyRedirect');
  if (copyBtn) copyBtn.onclick = async () => {
    try { await navigator.clipboard.writeText(redirectUri()); toast('Redirect URL copied'); }
    catch (e) {
      const r = document.createRange(); r.selectNodeContents(uriEl);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      toast('Copy the highlighted URL');
    }
  };

  function render() {
    const connected = authed();
    if (connected) S.setupWanted = false;
    if (setupEl) setupEl.hidden = connected || !S.setupWanted;
    if (connectedEl) connectedEl.hidden = !connected;
    if (connected) {
      statusEl.textContent = 'Connected' + (S.email ? ' as ' + S.email : '') + ' — backups in your app folder.';
      connBtn.hidden = true;
    } else {
      connBtn.hidden = false;
      connBtn.textContent = 'Connect Dropbox';
      if (!S.appKey) statusEl.textContent = 'Not connected (local storage only)';
      else if (statusEl.dataset.mode !== 'busy') statusEl.textContent = S.notice || 'Ready — connect to back up to Dropbox';
    }
  }
  function busy(b, msg) {
    S.busy = b;
    if (b) { statusEl.dataset.mode = 'busy'; statusEl.textContent = msg || 'Working…'; }
    else delete statusEl.dataset.mode;
    for (const id of ['#dbConnectBtn', '#dbKeySave', '#dbSaveBtn', '#dbRefreshBtn', '#dbDisconnectBtn']) {
      const elb = $(id); if (elb) elb.disabled = b;
    }
  }
  function authed() { return !!(S.token && Date.now() < S.exp - 60000); }
  function forgetToken() {
    S.token = null; S.exp = 0; S.email = '';
    try { localStorage.removeItem(LS_TOK); localStorage.removeItem(LS_EXP); } catch (e) {}
    render();
  }

  async function api(path, body) {
    if (!authed()) throw { expired: true };
    const r = await fetch('https://api.dropboxapi.com/2/' + path, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + S.token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : 'null',
    });
    if (r.status === 401) { forgetToken(); throw { expired: true }; }
    if (!r.ok) { let t = ''; try { t = await r.text(); } catch (e) {} throw new Error('Dropbox error ' + r.status + ' ' + t.slice(0, 160)); }
    const ct = r.headers.get('content-type') || '';
    return ct.includes('json') ? r.json() : r.text();
  }

  async function uploadFile(path, bytes) {
    if (!authed()) throw { expired: true };
    const r = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + S.token,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', autorename: false }),
      },
      body: bytes,
    });
    if (r.status === 401) { forgetToken(); throw { expired: true }; }
    if (!r.ok) { let t = ''; try { t = await r.text(); } catch (e) {} throw new Error('Upload failed (' + r.status + ') ' + t.slice(0, 160)); }
    return r.json();
  }

  async function downloadFile(path) {
    if (!authed()) throw { expired: true };
    const r = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + S.token, 'Dropbox-API-Arg': JSON.stringify({ path }) },
    });
    if (r.status === 401) { forgetToken(); throw { expired: true }; }
    if (!r.ok) throw new Error('Download failed (' + r.status + ')');
    return r.text();
  }

  function connect() {
    if (S.busy) return;
    S.notice = null;
    if (!S.appKey) {
      S.setupWanted = true; render();
      if (keyInput) keyInput.focus();
      statusEl.textContent = 'Paste your Dropbox app key below first (one-time setup).';
      return;
    }
    const st = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { sessionStorage.setItem(LS_STATE, st); } catch (e) {}
    const url = 'https://www.dropbox.com/oauth2/authorize?client_id=' + encodeURIComponent(S.appKey)
      + '&redirect_uri=' + encodeURIComponent(redirectUri())
      + '&response_type=token&token_access_type=online&state=' + encodeURIComponent(st);
    location.href = url; // full redirect; Dropbox sends us back with #access_token=…
  }

  // Coming back from Dropbox: pick up the token from the URL fragment.
  function pickupToken() {
    const h = location.hash || '';
    if (!h.includes('access_token=')) return false;
    const p = new URLSearchParams(h.replace(/^#/, ''));
    const tok = p.get('access_token'), state = p.get('state');
    let expect = null;
    try { expect = sessionStorage.getItem(LS_STATE); sessionStorage.removeItem(LS_STATE); } catch (e) {}
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    if (!tok) { statusEl.textContent = 'Dropbox sign-in failed (no token returned).'; return true; }
    if (expect && state && expect !== state) { statusEl.textContent = 'Dropbox sign-in failed (state mismatch) — try again.'; return true; }
    S.token = tok;
    S.exp = Date.now() + ((+p.get('expires_in') || 14400) * 1000);
    try { localStorage.setItem(LS_TOK, tok); localStorage.setItem(LS_EXP, String(S.exp)); } catch (e) {}
    S.setupWanted = false;
    render();
    toast('Dropbox connected');
    whoami().finally(() => { render(); refreshList().catch(() => {}); });
    return true;
  }

  async function whoami() {
    try {
      const me = await api('users/get_current_account');
      S.email = (me && me.email) || '';
    } catch (e) { S.email = ''; }
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

  async function saveBackup() {
    if (S.busy || !authed()) { statusEl.textContent = S.appKey ? 'Session expired — click Connect Dropbox.' : 'Connect Dropbox first.'; return; }
    busy(true, 'Saving backup to Dropbox…');
    try {
      const { name, file } = projectLabel();
      const payload = JSON.stringify({ app: 'homecraft3d', v: 1, savedAt: Date.now(), projectId: app.projectId, projectName: name, state: app.state, custom: app.custom });
      const meta = await uploadFile('/' + file, new TextEncoder().encode(payload));
      statusEl.textContent = 'Backed up just now as ' + (meta && meta.name || file);
      toast('Backup saved to Dropbox');
      await refreshList();
    } catch (err) {
      statusEl.textContent = err && err.expired ? 'Session expired — click Connect Dropbox.' : 'Backup failed: ' + String((err && err.message) || err);
    } finally { busy(false); render(); }
  }

  async function listAll() {
    const out = [];
    let cur = await api('files/list_folder', { path: '', recursive: false, limit: 100 });
    out.push(...(cur.entries || []));
    while (cur.has_more) {
      cur = await api('files/list_folder/continue', { cursor: cur.cursor });
      out.push(...(cur.entries || []));
    }
    return out.filter(e => e && e['.tag'] === 'file' && /\.json$/i.test(e.name || ''))
      .sort((a, b) => String(b.server_modified || '').localeCompare(String(a.server_modified || '')))
      .slice(0, 25);
  }

  async function refreshList() {
    if (!filesEl) return;
    if (!authed()) return;
    try {
      const files = await listAll();
      filesEl.innerHTML = '';
      if (!files.length) { filesEl.textContent = 'No backups yet — click “Save backup now”.'; return; }
      for (const f of files) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;background:#0f1522;border:1px solid #3a4a6b;border-radius:8px;padding:6px 8px;';
        const dt = f.server_modified ? new Date(f.server_modified).toLocaleString() : '';
        const kb = f.size ? (f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(f.size / 1024)) + ' KB') : '';
        const label = document.createElement('span');
        label.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;';
        label.textContent = f.name; label.title = f.name + ' • ' + dt + (kb ? ' • ' + kb : '');
        const sub = document.createElement('small');
        sub.style.cssText = 'color:#8fa5c4;flex:0 0 auto;';
        sub.textContent = dt + (kb ? ' • ' + kb : '');
        const btn = document.createElement('button');
        btn.className = 'btn small'; btn.type = 'button'; btn.textContent = 'Load';
        btn.onclick = () => loadBackup(f.path_lower || ('/' + f.name), f.name);
        row.append(label, sub, btn);
        filesEl.appendChild(row);
      }
    } catch (err) {
      if (filesEl) filesEl.textContent = err && err.expired ? 'Session expired — click Connect Dropbox.' : 'List failed: ' + String((err && err.message) || err);
    }
  }

  async function loadBackup(path, name) {
    if (S.busy || !authed()) { toast('Connect Dropbox first'); return; }
    if (!confirm('Load “' + name + '” from Dropbox? Current unsaved changes on this device will be replaced (undoable).')) return;
    busy(true, 'Loading ' + name + '…');
    try {
      const j = JSON.parse(await downloadFile(path));
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
    } finally { busy(false); render(); }
  }

  connBtn.onclick = () => {
    if (authed()) return;
    S.token = null;
    if (!S.appKey) { S.setupWanted = true; render(); if (keyInput) keyInput.focus(); return; }
    connect();
  };
  const keySave = $('#dbKeySave');
  if (keySave) keySave.onclick = () => {
    const v = (keyInput && keyInput.value || '').trim();
    if (!/^[a-z0-9]{10,}$/i.test(v)) { toast('That doesn’t look like an app key'); if (keyInput) keyInput.focus(); return; }
    S.appKey = v;
    try { localStorage.setItem(LS_KEY, v); } catch (e) {}
    S.setupWanted = false; render();
    connect();
  };
  const saveBtn = $('#dbSaveBtn');
  if (saveBtn) saveBtn.onclick = saveBackup;
  const refBtn = $('#dbRefreshBtn');
  if (refBtn) refBtn.onclick = () => refreshList().catch(() => {});
  const disBtn = $('#dbDisconnectBtn');
  if (disBtn) disBtn.onclick = () => {
    forgetToken();
    S.notice = null;
    render();
    statusEl.textContent = 'Disconnected. Local saves are untouched.';
  };
  pickupToken();
  render();
  if (authed()) { whoami().finally(() => { render(); refreshList().catch(() => {}); }); }
}
