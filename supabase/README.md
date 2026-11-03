# HomeCraft 3D — Supabase backend setup (do once, ~10 minutes)

The app works fully offline without this. The backend adds accounts,
cloud houses, cross-device sync, backups, and private asset storage.

## 1. Create the project
1. Go to https://supabase.com → **New project** (free tier is fine).
2. Wait for provisioning. Open **Project Settings → API** and copy:
   - **Project URL** (`https://xyzcompany.supabase.co`)
   - **anon / publishable key** (the long `eyJ…` token labelled *anon*).
   - ⚠️ Never use the **service-role / secret** key anywhere in this app.

## 2. Create tables + security (SQL)
1. In Supabase Dashboard open **SQL Editor → New query**.
2. Paste the entire contents of `schema.sql` (in this folder) and **Run**.
3. It creates `profiles`, `projects`, `project_backups`, `assets`,
   `user_settings`, the `delete_project_safe` function, and private
   `hc-assets` / `hc-thumbs` storage buckets — all with Row Level Security
   so every user sees only their own rows/files.

## 3. Auth settings (important for login emails)
1. **Authentication → Sign In / Up**: enable **Email** provider.
2. **Authentication → URL Configuration**:
   - **Site URL**: your generator URL, e.g. `https://perchance.org/home-builder-3d`
   - **Additional Redirect URLs**: add BOTH
     - `https://perchance.org/<your-generator-name>`
     - `https://<your-generator-public-id>.perchance.org/<your-generator-name>`
   - (Find the public id in the preview address bar: the subdomain part.
     If you rename/fork the generator, add the new origins here too.)
3. Confirm-email is ON by default: new accounts click the inbox link, then
   sign in. Password recovery works the same way.

## 4. Connect the app
1. Open the app → **Settings → Backend (Supabase)**.
2. Paste Project URL + anon key → **Save & connect**.
3. Status should read **connected**. If it says *tables missing*, rerun step 2.
4. Open the menu (**☰ → Cloud section**): create account / sign in.
5. **Save current house to cloud**. It appears in the cloud list with Open/Delete.

## How data maps (no redesign)
- House, rooms, floors, furniture placements, materials: the app is a
  document editor — the whole house JSON lives in `projects.data`
  (queryable with Postgres JSON operators if you ever need reports).
- Custom model binaries: uploaded to private `hc-assets/<user-id>/models/`;
  the project keeps a pointer and re-downloads on open.
- Thumbnails/backups/user settings: `hc-thumbs` bucket + `project_backups`
  / `user_settings` tables. Backups are append-only; every overwrite and
  every delete stores one first.

## iPhone / mobile notes
- Email + password only (no popups — those get blocked in embedded views).
- Uploads retry on failure; expired sessions fall back to local with an
  honest status instead of fake success.
- Autosave runs at most every 45 s and only when signed in, online, and
  the house actually changed.
