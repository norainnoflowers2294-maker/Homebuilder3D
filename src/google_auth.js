// Google Authentication & Profile Management for HomeCraft 3D
// Uses pre-configured Google OAuth Client from firebase-applet-config.json

import config from './firebase_config.js';

const LS_USER = 'homecraft_google_user';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid email profile';

class GoogleAuthService {
  constructor() {
    this.clientId = config.oAuthClientId || '';
    this.apiKey = config.apiKey || '';
    this.currentUser = null;
    this.accessToken = null;
    this.tokenExpiry = 0;
    this.listeners = new Set();
    this.loadSavedUser();
  }

  loadSavedUser() {
    try {
      const saved = localStorage.getItem(LS_USER);
      if (saved) {
        this.currentUser = JSON.parse(saved);
      }
    } catch (e) {}
  }

  onAuth(cb) {
    this.listeners.add(cb);
    cb(this.currentUser);
    return () => this.listeners.delete(cb);
  }

  notify() {
    for (const cb of this.listeners) {
      try { cb(this.currentUser); } catch (e) {}
    }
  }

  isAuthenticated() {
    return !!(this.currentUser && this.accessToken && Date.now() < this.tokenExpiry - 60000);
  }

  getUser() {
    return this.currentUser;
  }

  getToken() {
    return this.accessToken;
  }

  async signIn() {
    if (!window.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services script not ready yet');
    }

    return new Promise((resolve, reject) => {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: SCOPES,
        callback: async (resp) => {
          if (!resp || resp.error || !resp.access_token) {
            reject(new Error(resp?.error || 'Sign-in cancelled'));
            return;
          }

          this.accessToken = resp.access_token;
          this.tokenExpiry = Date.now() + ((+resp.expires_in || 3600) * 1000);

          try {
            // Fetch Google User Profile
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${this.accessToken}` }
            });
            if (res.ok) {
              const profile = await res.json();
              this.currentUser = {
                name: profile.name || profile.email,
                email: profile.email,
                picture: profile.picture,
                id: profile.sub
              };
              localStorage.setItem(LS_USER, JSON.stringify(this.currentUser));
              this.notify();
              resolve(this.currentUser);
              return;
            }
          } catch (err) {
            console.warn('Could not fetch profile info', err);
          }

          // Fallback if userinfo fails
          this.currentUser = {
            name: 'Google User',
            email: 'Google Connected'
          };
          localStorage.setItem(LS_USER, JSON.stringify(this.currentUser));
          this.notify();
          resolve(this.currentUser);
        },
        error_callback: (err) => {
          reject(err);
        }
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  async signOut() {
    if (this.accessToken && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(this.accessToken, () => {});
      } catch (e) {}
    }
    this.accessToken = null;
    this.currentUser = null;
    this.tokenExpiry = 0;
    localStorage.removeItem(LS_USER);
    this.notify();
  }
}

export const googleAuth = new GoogleAuthService();
