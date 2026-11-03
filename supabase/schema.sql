-- HomeCraft 3D — Supabase backend schema.
-- Run once in Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Per-user private tables with Row Level Security + private storage buckets.
-- The app only uses the public anon key; no service-role key anywhere.

create or replace function hc_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- profiles: one row per auth user
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text default 'Designer',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table profiles enable row level security;
drop policy if exists "own profile read" on profiles;
create policy "own profile read" on profiles for select using (auth.uid() = id);
drop policy if exists "own profile write" on profiles;
create policy "own profile write" on profiles for insert with check (auth.uid() = id);
drop policy if exists "own profile update" on profiles;
create policy "own profile update" on profiles for update using (auth.uid() = id);
drop trigger if exists trg_profiles_touch on profiles;
create trigger trg_profiles_touch before update on profiles
  for each row execute function hc_touch_updated_at();

-- projects: one row per 3D house, full state as JSON
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My House',
  data jsonb not null default '{}'::jsonb,
  thumbnail_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table projects enable row level security;
drop policy if exists "own projects all" on projects;
create policy "own projects all" on projects
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop trigger if exists trg_projects_touch on projects;
create trigger trg_projects_touch before update on projects
  for each row execute function hc_touch_updated_at();
create index if not exists idx_projects_owner on projects(owner_id, updated_at desc);

-- project_backups: append-only restore points
create table if not exists project_backups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text default 'auto',
  data jsonb not null,
  created_at timestamptz default now()
);
alter table project_backups enable row level security;
drop policy if exists "own backups read" on project_backups;
create policy "own backups read" on project_backups for select using (auth.uid() = owner_id);
drop policy if exists "own backups write" on project_backups;
create policy "own backups write" on project_backups for insert with check (auth.uid() = owner_id);
create index if not exists idx_backups_project on project_backups(project_id, created_at desc);

-- assets: uploaded models/textures/images/thumbnails registry
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  kind text not null default 'model',
  name text not null,
  mime text,
  size_bytes bigint default 0,
  storage_path text not null,
  created_at timestamptz default now()
);
alter table assets enable row level security;
drop policy if exists "own assets all" on assets;
create policy "own assets all" on assets
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create index if not exists idx_assets_owner on assets(owner_id, created_at desc);
-- one registry row per stored file (lets the app upsert safely)
create unique index if not exists idx_assets_owner_path on assets(owner_id, storage_path);

-- user_settings: small JSON blob per user
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table user_settings enable row level security;
drop policy if exists "own settings all" on user_settings;
create policy "own settings all" on user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists trg_settings_touch on user_settings;
create trigger trg_settings_touch before update on user_settings
  for each row execute function hc_touch_updated_at();

-- privileged op: delete keeps a backup first (runs server-side)
create or replace function delete_project_safe(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_row projects%rowtype;
begin
  select * into v_row from projects where id = p_id;
  if not found then return false; end if;
  if v_row.owner_id <> auth.uid() then raise exception 'not your project'; end if;
  insert into project_backups(project_id, owner_id, label, data)
    values (v_row.id, v_row.owner_id, 'pre-delete', v_row.data);
  delete from assets where project_id = p_id and owner_id = auth.uid();
  delete from projects where id = p_id;
  return true;
end $$;

-- private storage buckets + owner-folder policies
insert into storage.buckets (id, name, public)
  values ('hc-assets','hc-assets', false), ('hc-thumbs','hc-thumbs', false)
  on conflict (id) do nothing;
drop policy if exists "own folder read" on storage.objects;
create policy "own folder read" on storage.objects for select using (
  bucket_id in ('hc-assets','hc-thumbs')
  and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "own folder write" on storage.objects;
create policy "own folder write" on storage.objects for insert with check (
  bucket_id in ('hc-assets','hc-thumbs')
  and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "own folder update" on storage.objects;
create policy "own folder update" on storage.objects for update using (
  bucket_id in ('hc-assets','hc-thumbs')
  and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "own folder delete" on storage.objects;
create policy "own folder delete" on storage.objects for delete using (
  bucket_id in ('hc-assets','hc-thumbs')
  and (storage.foldername(name))[1] = auth.uid()::text
);
