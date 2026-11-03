// Backend UI for HomeCraft 3D: Settings status + Menu auth/cloud panel.
// Injected into existing modals — no layout redesign.
import { getBackendConfig, saveBackendConfig, clearBackendConfig, isBackendConfigured, probeBackend } from './client.js';
import { signUp, signIn, sendMagicLink, signOut, sendRecovery, currentUser, getProfile, saveProfile, onAuthChange } from './auth.js';
import { listCloudProjects, pushProject, pullProjectToLocal, deleteCloudProject, listBackups, syncState } from './projects.js?v=20261103o';

const refCache = new Map();
let appRef = null, toastFn = null;
let statusTimer = null;

function el(html) { const d = document.createElement('div'); d.innerHTML = html; return d; }
function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

// ---------------- Settings → Backend section ----------------
function mountSettings() {
  const veil = document.querySelector('#settingsVeil .modal');
  if (!veil || veil.querySelector('#sbBack')) return;
  const doneRow = veil.querySelector('.rowBtns');
  const sec = el(`<div id="sbBack">
    <h3 style="margin-top:10px"><i data-lucide="database"></i>Backend (Supabase)</h3>
    <div class="sub" id="sbStatus" style="line-height:1.7">Checking…</div>
    <label class="f">Project URL <input id="sbUrl" class="txtInput" style="width:62%" placeholder="https://xyz.supabase.co" autocomplete="off"></label>
    <label class="f">Anon key <input id="sbKey" type="password" class="txtInput" style="width:62%" placeholder="publishable key (never the secret key)" autocomplete="off"></label>
    <div class="rowBtns">
      <button class="btn small primary" id="sbSaveCfg">Save &amp; connect</button>
      <button class="btn small" id="sbCheck">Check connection</button>
      <button class="btn small" id="sbClear">Forget</button>
    </div>
    <p class="sub">One-time setup: create a free project at supabase.com → run <b>src/supabase/schema.sql</b> in its SQL Editor → paste URL + anon key here. Full steps in src/supabase/README.md.</p>
  </div>`);
  veil.insertBefore(sec, doneRow);
  const cfg = getBackendConfig();
  sec.querySelector('#sbUrl').value = cfg.url || '';
  sec.querySelector('#sbKey').value = cfg.key || '';
  sec.querySelector('#sbSaveCfg').onclick = async () => {
    saveBackendConfig(sec.querySelector('#sbUrl').value, sec.querySelector('#sbKey').value);
    toastFn && toastFn(isBackendConfigured() ? 'Backend saved — checking…' : 'Enter a valid Supabase URL and anon key.');
    await refreshStatus(sec);
    renderMenu(false);
  };
  sec.querySelector('#sbClear').onclick = async () => {
    try { await signOut(); } catch (e) {}
    clearBackendConfig();
    sec.querySelector('#sbUrl').value = ''; sec.querySelector('#sbKey').value = '';
    await refreshStatus(sec);
    renderMenu(false);
  };
  sec.querySelector('#sbCheck').onclick = () => refreshStatus(sec);
  refreshStatus(sec);
}

async function refreshStatus(root) {
  const box = (root || document).querySelector('#sbStatus');
  if (!box) return;
  const row = (k, v) => `<div>• <b>${k}:</b> ${v}</div>`;
  if (!isBackendConfigured()) {
    box.innerHTML = row('Backend', 'not configured') + row('User', 'signed out') + row('Sync', 'local only') + row('Backups', '—');
    return;
  }
  box.innerHTML = row('Backend', 'checking…') + row('User', '…') + row('Sync', '…') + row('Backups', '…');
  const probe = await probeBackend();
  if (!probe.ok) {
    const why = probe.reason === 'unreachable' ? 'unreachable — check URL, HTTPS and connection'
      : probe.reason === 'no-schema' ? 'reachable, but tables missing — run src/supabase/schema.sql in the SQL editor'
      : esc(probe.detail || probe.reason);
    box.innerHTML = row('Backend', why) + row('User', '—') + row('Sync', 'local only') + row('Backups', '—');
    return;
  }
  let user = null;
  try { user = await currentUser(); } catch (e) {}
  let sync = { loggedIn: !!user };
  let backups = '—';
  if (user && appRef) {
    try { sync = await syncState(appRef); } catch (e) {}
    try {
      const { cloudUuidFor } = await import('./projects.js');
      const uuid = await cloudUuidFor(appRef.projectId);
      if (uuid) {
        const bl = await listBackups(uuid, 50);
        backups = bl.length + ' restore point' + (bl.length === 1 ? '' : 's') + (bl.length ? ' (newest ' + new Date(bl[0].created_at).toLocaleString() + ')' : '');
      } else backups = 'none yet — save to cloud first';
    } catch (e) { backups = 'unavailable'; }
  }
  const syncTxt = !user ? 'local only (sign in to sync)'
    : !sync.linked ? 'first cloud copy is being created automatically'
    : sync.dirty ? 'cloud copy behind — unsaved changes on this device'
    : 'in sync' + (sync.cloudUpdatedAt ? ' (cloud ' + new Date(sync.cloudUpdatedAt).toLocaleString() + ')' : '');
  box.innerHTML = row('Backend', 'connected')
    + row('User', user ? esc(user.email) : 'signed out')
    + row('Sync', esc(syncTxt))
    + (autoSyncError ? row('Cloud sync error', esc(autoSyncError)) : '')
    + row('Backups', esc(backups));
}

// ---------------- Menu → account + cloud houses ----------------
function mountMenu() {
  const modal = document.querySelector('#menuVeil .modal');
  if (!modal || modal.querySelector('#sbAuth')) return;
  const anchor = modal.querySelector('#driveRow');
  const wrap = el(`<div id="sbAuth" style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:12px;background:var(--panel2);">
    <div id="sbAuthBody" style="font-size:12px">Backend: loading…</div>
    <div class="rowBtns" style="margin-top:8px">
      <button class="btn small primary" id="sbCloudSave" hidden>Save current house to cloud</button>
      <button class="btn small" id="sbCloudRefresh" hidden>Refresh cloud list</button>
    </div>
    <div id="sbCloudList" style="margin-top:6px;display:flex;flex-direction:column;gap:5px"></div>
  </div>`);
  modal.insertBefore(wrap, anchor);
  wrap.querySelector('#sbCloudSave').onclick = manualSave;
  wrap.querySelector('#sbCloudRefresh').onclick = () => renderMenu(true);
  renderMenu(false);
}

async function renderMenu(forceList) {
  const body = document.querySelector('#sbAuthBody');
  const list = document.querySelector('#sbCloudList');
  const saveBtn = document.querySelector('#sbCloudSave');
  const refBtn = document.querySelector('#sbCloudRefresh');
  if (!body) return;
  if (!isBackendConfigured()) {
    body.textContent = 'Cloud: not set up — open Settings → Backend (2 min). Houses stay on this device until then.';
    if (saveBtn) saveBtn.hidden = true;
    if (refBtn) refBtn.hidden = true;
    if (list) list.innerHTML = '';
    return;
  }
  let user = null;
  try { user = await currentUser(); } catch (e) {}
  if (saveBtn) saveBtn.hidden = !user;
  if (refBtn) refBtn.hidden = !user;
  if (!user) {
    body.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <input id="sbEmail" class="txtInput" style="flex:1;min-width:140px" placeholder="you@email.com" autocomplete="email">
        <input id="sbPass" type="password" class="txtInput" style="flex:1;min-width:120px" placeholder="password" autocomplete="current-password">
      </div>
      <div class="rowBtns" style="margin-top:6px">
        <button class="btn small primary" id="sbSignIn">Sign in with password</button>
        <button class="btn small" id="sbMagicLink">Email me a sign-in link</button>
        <button class="btn small" id="sbSignUp">Create account</button>
        <button class="btn small" id="sbForgot">Forgot password</button>
      </div>
      <div class="sub" id="sbAuthMsg"></div>`;
    body.querySelector('#sbSignIn').onclick = () => doAuth('in');
    body.querySelector('#sbMagicLink').onclick = doMagicLink;
    body.querySelector('#sbSignUp').onclick = () => doAuth('up');
    body.querySelector('#sbForgot').onclick = doForgot;
    if (list) list.innerHTML = '';
    return;
  }
  let prof = null;
  try { prof = await getProfile(); } catch (e) {}
  body.innerHTML = `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <span style="flex:1;min-width:120px">☁ <b>${esc(user.email)}</b></span>
      <input id="sbName" class="txtInput" style="width:130px" maxlength="30" value="${esc((prof && prof.display_name) || '')}" placeholder="Display name">
      <button class="btn small" id="sbNameSave">Save</button>
      <button class="btn small" id="sbSignOut">Sign out</button>
    </div><div class="sub" id="sbAuthMsg"></div>`;
  body.querySelector('#sbSignOut').onclick = async () => { await signOut(); renderMenu(false); refreshStatus(); };
  body.querySelector('#sbNameSave').onclick = async () => {
    try { await saveProfile({ display_name: body.querySelector('#sbName').value.trim() || 'Designer' }); toastFn && toastFn('Profile saved'); }
    catch (e) { toastFn && toastFn('Profile failed: ' + String((e && e.message) || e)); }
  };
  if (forceList || (list && !list.dataset.loaded)) await renderCloudList();
}

async function doMagicLink() {
  const email = (document.querySelector('#sbEmail').value || '').trim();
  const msg = document.querySelector('#sbAuthMsg');
  const say = t => { if (msg) msg.textContent = t; };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { say('Enter a valid email address.'); return; }
  say('Sending your secure sign-in link…');
  try {
    await sendMagicLink(email);
    say('Sign-in email sent. Open it on this iPhone and tap the sign-in button. HomeCraft will reopen and sign you in automatically.');
  } catch (e) { say(String((e && e.message) || e)); }
}

async function doAuth(mode) {
  const email = (document.querySelector('#sbEmail').value || '').trim();
  const pass = (document.querySelector('#sbPass').value || '').trim();
  const msg = document.querySelector('#sbAuthMsg');
  const say = t => { if (msg) msg.textContent = t; };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { say('Enter a valid email.'); return; }
  if (pass.length < 6) { say('Password must be at least 6 characters.'); return; }
  say(mode === 'up' ? 'Creating account…' : 'Signing in…');
  try {
    if (mode === 'up') {
      const r = await signUp(email, pass);
      if (r.needsConfirm) say('Account created — check your inbox to confirm, then sign in.');
      else { say('Account created — signed in.'); renderMenu(true); refreshStatus(); }
    } else {
      await signIn(email, pass);
      say('Signed in.');
      renderMenu(true); refreshStatus();
    }
  } catch (e) { say(String((e && e.message) || e)); }
}

async function doForgot() {
  const email = (document.querySelector('#sbEmail').value || '').trim();
  const msg = document.querySelector('#sbAuthMsg');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { if (msg) msg.textContent = 'Enter your email first.'; return; }
  try {
    await sendRecovery(email);
    if (msg) msg.textContent = 'Recovery email sent — open the link, then set a new password below.';
    showNewPass();
  } catch (e) { if (msg) msg.textContent = String((e && e.message) || e); }
}

function showNewPass() {
  const msg = document.querySelector('#sbAuthMsg');
  if (!msg || document.querySelector('#sbNewPass')) return;
  const d = document.createElement('div');
  d.className = 'rowBtns'; d.style.marginTop = '6px';
  d.innerHTML = `<input id="sbNewPass" type="password" class="txtInput" style="flex:1;min-width:120px" placeholder="new password">
    <button class="btn small primary" id="sbNewPassGo">Set password</button>`;
  msg.after(d);
  d.querySelector('#sbNewPassGo').onclick = async () => {
    const p = d.querySelector('#sbNewPass').value || '';
    if (p.length < 6) { msg.textContent = 'Password must be at least 6 characters.'; return; }
    try {
      const { setNewPassword } = await import('./auth.js');
      await setNewPassword(p);
      msg.textContent = 'Password updated — sign in.';
    } catch (e) { msg.textContent = String((e && e.message) || e); }
  };
}

async function manualSave() {
  if (!appRef) return;
  try {
    toastFn && toastFn('Saving to cloud…');
    await pushProject(appRef, { manual: true });
    toastFn && toastFn('House saved to cloud — verified ✓ (backup kept).');
    renderMenu(true); refreshStatus();
  } catch (e) { toastFn && toastFn('Cloud save failed: ' + String((e && e.message) || e)); }
}

async function renderCloudList() {
  const list = document.querySelector('#sbCloudList');
  if (!list) return;
  list.dataset.loaded = '1';
  list.innerHTML = '<div class="sub">Loading cloud houses…</div>';
  try {
    const { rows, total } = await listCloudProjects(0, 25);
    list.innerHTML = '';
    if (!rows.length) { list.innerHTML = '<div class="sub">No cloud houses yet — save this one above.</div>'; return; }
    if (total > rows.length) {
      const m = document.createElement('div');
      m.className = 'sub'; m.textContent = 'Showing newest ' + rows.length + ' of ' + total + '.';
      list.appendChild(m);
    }
    for (const r of rows) {
      const d = document.createElement('div');
      d.style.cssText = 'display:flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:6px 8px;';
      const lab = document.createElement('span');
      lab.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;';
      lab.textContent = r.name;
      lab.title = r.name + ' • ' + new Date(r.updated_at).toLocaleString();
      const open = document.createElement('button');
      open.className = 'btn small primary'; open.type = 'button'; open.textContent = 'Open';
      open.onclick = () => pullOpen(r.id, r.name);
      const del = document.createElement('button');
      del.className = 'btn small danger'; del.type = 'button'; del.textContent = 'Delete';
      del.onclick = () => cloudDelete(r.id, r.name);
      d.append(lab, open, del);
      list.appendChild(d);
    }
  } catch (e) {
    list.innerHTML = '<div class="sub">Cloud list failed: ' + esc((e && e.message) || e) + '</div>';
  }
}

async function pullOpen(cloudId, name) {
  if (!appRef) return;
  if (!confirm('Open "' + name + '" from cloud? It becomes a new house on this device; current work stays untouched.')) return;
  try {
    toastFn && toastFn('Downloading ' + name + '…');
    const { localId, missing } = await pullProjectToLocal(appRef, cloudId, refCache);
    const store = await import('../store.js');
    appRef.projectId = localId;
    try { store.setCurrentPid(localId); } catch (e) {}
    try { const st = store.loadProjectState(localId); if (st) appRef.state = st; } catch (e) {}
    try { const cu = store.loadCustom(); if (cu && cu.length) appRef.custom = cu; } catch (e) {}
    appRef.select(null);
    appRef.syncAll();
    try { appRef.view2d.fit(); } catch (e) {}
    try { appRef.renderProjects(); } catch (e) {}
    toastFn && toastFn(missing ? 'Opened with ' + missing + ' model(s) unavailable offline.' : 'Opened ' + name);
    renderMenu(true); refreshStatus();
  } catch (e) { toastFn && toastFn('Open failed: ' + String((e && e.message) || e)); }
}

async function cloudDelete(cloudId, name) {
  if (!confirm('Delete "' + name + '" from the cloud? A pre-delete backup is kept first.')) return;
  try {
    await deleteCloudProject(cloudId);
    toastFn && toastFn('Cloud copy deleted (backup kept).');
    const list = document.querySelector('#sbCloudList');
    if (list) delete list.dataset.loaded;
    renderMenu(true); refreshStatus();
  } catch (e) { toastFn && toastFn('Delete failed: ' + String((e && e.message) || e)); }
}

let lastPushTry = 0;
let autoSyncError = '';
async function autoTick() {
  if (!appRef || !isBackendConfigured()) return;
  if (!navigator.onLine) return;
  const now = Date.now();
  if (now - lastPushTry < 45000) return;
  try {
    const s = await syncState(appRef);
    if (!s.loggedIn) return;
    lastPushTry = now;
    if (s.linked && !s.dirty) return;
    // Create the first cloud copy automatically after sign-in.
    await pushProject(appRef, { manual: false });
    autoSyncError = '';
    const veil = document.querySelector('#settingsVeil');
    if (veil && veil.classList.contains('on')) refreshStatus();
  } catch (e) {
    autoSyncError = String((e && e.message) || e || 'Unknown cloud sync error');
    const veil = document.querySelector('#settingsVeil');
    if (veil && veil.classList.contains('on')) refreshStatus();
  }
}

export function initBackendUI(app, toast) {
  appRef = app; toastFn = toast;
  mountSettings();
  mountMenu();
  (async () => {
    try {
      const unsub = await onAuthChange((event, user) => {
        renderMenu(false); refreshStatus();
        if (user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) autoTick();
      });
      window.addEventListener('pagehide', () => { try { unsub(); } catch (e) {} });
    } catch (e) { /* backend not configured yet — mounts retry on save */ }
  })();
  if (location.hash === '#recover') {
    (async () => {
      try {
        const u = await currentUser();
        if (u) {
          const mb = document.querySelector('#menuBtn');
          if (mb) mb.click();
          renderMenu(false); showNewPass();
          const m = document.querySelector('#sbAuthMsg');
          if (m) m.textContent = 'Set your new password below.';
        }
      } catch (e) {}
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    })();
  }
  // Supabase persists the verified email-link session in Safari local storage.
  if (location.search.includes('code=') || location.hash.includes('access_token=')) {
    setTimeout(() => { try { history.replaceState(null, '', location.pathname); } catch (e) {} }, 1800);
  }
  if (!statusTimer) statusTimer = setInterval(autoTick, 20000);
  window.addEventListener('online', () => autoTick());
}
