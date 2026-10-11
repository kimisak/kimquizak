begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists private.quiz_owners (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table private.quiz_owners enable row level security;
revoke all on private.quiz_owners from public, anon, authenticated;

create or replace function private.is_quiz_owner()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from private.quiz_owners where user_id = (select auth.uid()));
$$;
revoke all on function private.is_quiz_owner() from public, anon;
grant execute on function private.is_quiz_owner() to authenticated;

create table if not exists public.quiz_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 4000000
  ),
  created_at timestamptz not null default now()
);
create index if not exists quiz_snapshots_owner_created_idx
  on public.quiz_snapshots (owner_id, created_at desc);
alter table public.quiz_snapshots enable row level security;
revoke all on public.quiz_snapshots from public, anon, authenticated;
grant select, insert on public.quiz_snapshots to authenticated;

drop policy if exists "Owner reads own snapshots" on public.quiz_snapshots;
create policy "Owner reads own snapshots" on public.quiz_snapshots
  for select to authenticated
  using ((select private.is_quiz_owner()) and owner_id = (select auth.uid()));

drop policy if exists "Owner saves own snapshots" on public.quiz_snapshots;
create policy "Owner saves own snapshots" on public.quiz_snapshots
  for insert to authenticated
  with check ((select private.is_quiz_owner()) and owner_id = (select auth.uid()));

commit;

-- Enroll the same UUID as KIMQUIZAK_OWNER_USER_ID using the SQL editor:
-- insert into private.quiz_owners (user_id) values ('YOUR-OWNER-UUID')
-- on conflict do nothing;
-- Never grant browser roles write access to private.quiz_owners.
