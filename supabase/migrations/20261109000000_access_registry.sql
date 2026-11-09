-- Institutional access registry for the Fisioterapia USC poster repository.
--
-- Run once in Supabase Dashboard -> SQL Editor. Safe to re-run.
--
-- What it does:
--   1. Rejects any auth user whose email is not exactly @usc.edu.co (server-side guard).
--   2. Stores one row per person in public.visitors (name, email, first/last access, count).
--   3. Stores one row per sign-in in public.visit_logs.
--   4. Exposes public.record_access() so a signed-in user can register a visit.
--
-- View or export the data: Table Editor -> visitors (or visit_logs) -> Export -> CSV.
-- The CSV opens directly in Excel or Google Sheets.

-- ---------------------------------------------------------------------------
-- 1. Domain guard on auth.users
-- ---------------------------------------------------------------------------

create or replace function public.is_institutional_email(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- Exactly one "@", a non-empty local part and the exact domain usc.edu.co.
  select coalesce(lower(trim(p_email)) ~ '^[a-z0-9._%+-]+@usc\.edu\.co$', false);
$$;

create or replace function public.enforce_institutional_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_institutional_email(new.email) then
    raise exception 'Solo se permiten correos @usc.edu.co'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_institutional_email on auth.users;
create trigger enforce_institutional_email
  before insert or update of email on auth.users
  for each row execute function public.enforce_institutional_email();

-- ---------------------------------------------------------------------------
-- 2. Registry tables
-- ---------------------------------------------------------------------------

create table if not exists public.visitors (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null
    check (char_length(trim(full_name)) between 3 and 120),
  email text not null unique,
  first_access_at timestamptz not null default now(),
  last_access_at timestamptz not null default now(),
  access_count integer not null default 0
);

comment on table public.visitors is
  'One row per person who accessed the repository with an institutional email.';

create table if not exists public.visit_logs (
  id bigint generated always as identity primary key,
  visitor_id uuid not null references public.visitors (id) on delete cascade,
  accessed_at timestamptz not null default now(),
  user_agent text
);

comment on table public.visit_logs is 'One row per verified sign-in.';

create index if not exists visit_logs_visitor_id_idx on public.visit_logs (visitor_id);
create index if not exists visit_logs_accessed_at_idx on public.visit_logs (accessed_at desc);

-- ---------------------------------------------------------------------------
-- 3. Create the visitor row when the auth user is created
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_visitor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
begin
  if char_length(v_name) < 3 or char_length(v_name) > 120 then
    v_name := split_part(new.email, '@', 1);
  end if;

  insert into public.visitors (id, full_name, email)
  values (new.id, v_name, lower(new.email))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_visitor on auth.users;
create trigger on_auth_user_created_visitor
  after insert on auth.users
  for each row execute function public.handle_new_visitor();

-- ---------------------------------------------------------------------------
-- 4. Register a verified visit (called by the app right after the OTP check)
-- ---------------------------------------------------------------------------

create or replace function public.record_access(p_full_name text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_name text := trim(coalesce(p_full_name, ''));
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select lower(email) into v_email from auth.users where id = v_uid;

  if not public.is_institutional_email(v_email) then
    raise exception 'Solo se permiten correos @usc.edu.co'
      using errcode = 'check_violation';
  end if;

  if char_length(v_name) < 3 or char_length(v_name) > 120 then
    v_name := null;
  end if;

  insert into public.visitors (id, full_name, email, access_count)
  values (v_uid, coalesce(v_name, split_part(v_email, '@', 1)), v_email, 1)
  on conflict (id) do update
    set full_name = coalesce(v_name, public.visitors.full_name),
        email = excluded.email,
        last_access_at = now(),
        access_count = public.visitors.access_count + 1;

  insert into public.visit_logs (visitor_id, user_agent)
  values (v_uid, left(p_user_agent, 500));
end;
$$;

revoke all on function public.record_access(text, text) from public, anon;
grant execute on function public.record_access(text, text) to authenticated;

revoke all on function public.enforce_institutional_email() from public, anon, authenticated;
revoke all on function public.handle_new_visitor() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security: clients only read their own visitor row
-- ---------------------------------------------------------------------------

alter table public.visitors enable row level security;
alter table public.visit_logs enable row level security;

revoke all on public.visitors from anon, authenticated;
revoke all on public.visit_logs from anon, authenticated;
grant select on public.visitors to authenticated;

drop policy if exists "Visitors read own row" on public.visitors;
create policy "Visitors read own row"
  on public.visitors
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- No client policies on visit_logs: it is written only by record_access()
-- and read by administrators from the dashboard.
