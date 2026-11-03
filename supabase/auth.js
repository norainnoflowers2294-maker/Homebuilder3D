// Auth flows for HomeCraft 3D (email + password only — no popups, iPhone-safe).
// Sessions persist in localStorage via the supabase client (auto-refresh).
import { getClient, setLastUserId } from './client.js';

function errMsg(e, fallback) {
  const m = String((e && e.message) || e || '');
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password.';
  if (/user already registered|already exists/i.test(m)) return 'That email already has an account — sign in instead.';
  if (/email not confirmed/i.test(m)) return 'Check your inbox and confirm your email first.';
  if (/password/i.test(m) && /weak|short|length/i.test(m)) return 'Password must be at least 6 characters.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts — wait a minute and retry.';
  return m || fallback || 'Auth failed.';
}

export async function signUp(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw new Error(errMsg(error, 'Sign-up failed.'));
  if (data && data.user) {
    // Ensure a profile row exists (RLS allows own insert).
    try {
      await sb.from('profiles').upsert({ id: data.user.id, email: data.user.email }, { onConflict: 'id' });
    } catch (e) {}
    setLastUserId(data.user.id);
  }
  // If email confirmation is on, data.session is null until they click the link.
  return { user: data.user, needsConfirm: !(data.session) };
}

export async function signIn(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(errMsg(error, 'Sign-in failed.'));
  if (data && data.user) setLastUserId(data.user.id);
  return data.user;
}

export async function signOut() {
  try { (await getClient()).auth.signOut(); } catch (e) {}
  setLastUserId('');
}

export async function sendRecovery(email) {
  const sb = await getClient();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin + location.pathname + '#recover',
  });
  if (error) throw new Error(errMsg(error, 'Could not send recovery email.'));
}

export async function setNewPassword(password) {
  const sb = await getClient();
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw new Error(errMsg(error, 'Could not set new password.'));
}

export async function currentUser() {
  const sb = await getClient();
  const { data } = await sb.auth.getSession();
  return (data && data.session && data.session.user) || null;
}

export async function getProfile() {
  const sb = await getClient();
  const u = await currentUser();
  if (!u) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', u.id).maybeSingle();
  return data || { id: u.id, email: u.email };
}

export async function saveProfile(patch) {
  const sb = await getClient();
  const u = await currentUser();
  if (!u) throw new Error('Not signed in.');
  const { error } = await sb.from('profiles').upsert({ id: u.id, email: u.email, ...patch }, { onConflict: 'id' });
  if (error) throw new Error(String(error.message || error));
}

// Calls cb(event, user) on sign-in/out/token-refresh. Returns unsubscribe fn.
export async function onAuthChange(cb) {
  const sb = await getClient();
  const { data } = sb.auth.onAuthStateChange((event, session) => {
    const u = (session && session.user) || null;
    setLastUserId(u ? u.id : '');
    try { cb(event, u); } catch (e) {}
  });
  return () => { try { data.subscription.unsubscribe(); } catch (e) {} };
}
