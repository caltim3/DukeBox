-- ═══════════════════════════════════════════════════════════════════════════
-- DukeBox library — cross-device sync of saved songs, setlists, and prefs.
-- One JSON blob per user, keyed by authenticated email. Runs on the SAME
-- Supabase project as Jupiter (shared account / auth users).
--
-- Unlike rhino_gig_book (server-proxied, no policies), DukeBox talks to Supabase
-- directly from the browser with the anon key, so RLS policies scoped to the
-- signed-in user are required.
--
-- Run in Supabase → SQL Editor → New query.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists dukebox_library (
  owner      text primary key,                       -- authenticated user email
  data       jsonb not null default '{}'::jsonb,     -- { songs, setlists, prefs }
  updated_at timestamptz not null default now()
);

alter table dukebox_library enable row level security;

-- Each user may read and write only their own row (owner = their JWT email).
drop policy if exists "dukebox_library_select_own" on dukebox_library;
create policy "dukebox_library_select_own" on dukebox_library
  for select using (owner = (auth.jwt() ->> 'email'));

drop policy if exists "dukebox_library_insert_own" on dukebox_library;
create policy "dukebox_library_insert_own" on dukebox_library
  for insert with check (owner = (auth.jwt() ->> 'email'));

drop policy if exists "dukebox_library_update_own" on dukebox_library;
create policy "dukebox_library_update_own" on dukebox_library
  for update using (owner = (auth.jwt() ->> 'email'))
  with check (owner = (auth.jwt() ->> 'email'));
