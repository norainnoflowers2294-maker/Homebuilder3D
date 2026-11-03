// Supabase client factory for HomeCraft 3D.
// Public anon key only (never a service-role key). URL + key live in
// localStorage (hc.sb.url / hc.sb.key), entered in Settings → Backend.
// Imported lazily so a blocked CDN or iPhone offline never breaks the app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LS_URL = 'hc.sb.url';
const LS_KEY = 'hc.sb.key';
const LS_UID = 'hc.sb.uid';
const LS_DISABLED = 'hc.sb.disabled';
// Public Supabase publishable key. Safe for browser use when RLS is enabled.
const DEFAULT_URL = 'https://xvwbqswmgwprtbqfhjuy.supabase.co';
const DEFAULT_KEY = 'sb_publishable_WyNTlLFiGJG57m1XCMnMaA_vqMyj9jW';

let client = null;
let clientFor = '';

function readCfg() {
  let url = '', key = '';
  try {
    const disabled = localStorage.getItem(LS_DISABLED) === '1';
    url = (localStorage.getItem(LS_URL) || (disabled ? '' : DEFAULT_URL)).trim().replace(/\/+$/, '');
    key = (localStorage.getItem(LS_KEY) || (disabled ? '' : DEFAULT_KEY)).trim();
  } catch (e) {}
  return { url, key };
}

export function getBackendConfig() { return readCfg(); }
export function isBackendConfigured() {
  const { url, key } = readCfg();
  return url.startsWith('https://') && url.includes('.supabase.co') && key.length > 20;
}
export function saveBackendConfig(url, key) {
  try {
    localStorage.setItem(LS_URL, (url || '').trim().replace(/\/+$/, ''));
    localStorage.setItem(LS_KEY, (key || '').trim());
    localStorage.removeItem(LS_DISABLED);
  } catch (e) {}
  client = null; clientFor = '';
}
export function clearBackendConfig() {
  try { localStorage.removeItem(LS_URL); localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_UID); localStorage.setItem(LS_DISABLED, '1'); } catch (e) {}
  client = null; clientFor = '';
}

// Last known user id (for scoping local caches). Set on auth events.
export function lastUserId() { try { return localStorage.getItem(LS_UID) || ''; } catch (e) { return ''; } }
export function setLastUserId(id) { try { id ? localStorage.setItem(LS_UID, id) : localStorage.removeItem(LS_UID); } catch (e) {} }

// All Supabase traffic goes through this with a hard timeout so a dead
// endpoint or dropped mobile connection fails honestly instead of hanging.
async function fetchWithTimeout(url, opts = {}) {
  const ms = 15000;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: c.signal });
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('Request timed out after 15 s — check connection.');
    throw e;
  } finally { clearTimeout(t); }
}

export async function getClient() {
  const { url, key } = readCfg();
  if (!isBackendConfigured()) throw new Error('Backend not configured — enter your Supabase URL and anon key in Settings → Backend.');
  const tag = url + '|' + key.slice(-8);
  if (!client || clientFor !== tag) {
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,   // email-confirm / recovery links return here
        storageKey: 'hc.sb.session',
      },
      global: { fetch: fetchWithTimeout, headers: { 'x-hc-app': 'home-builder-3d' } },
    });
    clientFor = tag;
  }
  return client;
}

// Honest connection probe. Returns {ok, reason, detail} — never throws.
// ok=true only when: reachable AND session readable AND project tables exist.
function netFail(msg) {
  return /failed to fetch|load failed|networkerror|network request failed|timed out|timeout|aborterror|typeerror|econn|enotfound|dns/i.test(String(msg || ''));
}
function noSchema(msg) {
  return /relation .* does not exist|schema cache|pgrst| 404|not found/i.test(String(msg || ''));
}
export async function probeBackend() {
  if (!isBackendConfigured()) return { ok: false, stage: 'config', reason: 'not-configured' };
  let sb;
  try { sb = await getClient(); }
  catch (e) { return { ok: false, stage: 'config', reason: 'bad-config', detail: String((e && e.message) || e) }; }
  try {
    const { error: sessErr } = await sb.auth.getSession();
    if (sessErr) throw sessErr;
  } catch (e) {
    return { ok: false, stage: 'reach', reason: 'unreachable', detail: 'Cannot reach ' + readCfg().url };
  }
  // Schema check: profiles table must exist (created by src/supabase/schema.sql).
  try {
    const { error } = await sb.from('profiles').select('id', { count: 'exact', head: true });
    if (error) {
      const msg = String((error && error.message) || error);
      if (noSchema(msg))
        return { ok: false, stage: 'schema', reason: 'no-schema', detail: 'Tables missing — run src/supabase/schema.sql in the Supabase SQL editor.' };
      if (netFail(msg))
        return { ok: false, stage: 'reach', reason: 'unreachable', detail: 'Cannot reach ' + readCfg().url + ' — check the URL, HTTPS and connection.' };
      throw error;
    }
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (netFail(msg))
      return { ok: false, stage: 'reach', reason: 'unreachable', detail: 'Cannot reach ' + readCfg().url + ' — check the URL, HTTPS and connection.' };
    return { ok: false, stage: 'schema', reason: 'schema-error', detail: msg };
  }
  return { ok: true, stage: 'ok', reason: 'connected' };
}
