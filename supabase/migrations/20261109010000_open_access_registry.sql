-- Open access registry for the Fisioterapia USC poster repository.
--
-- Run once in Supabase Dashboard -> SQL Editor. Safe to re-run, and safe to run
-- whether or not the earlier email-code version of this script was applied.
--
-- Access model (trust-based, no email verification):
--   The site sends full name + email to public.register_visit(). If the email
--   ends exactly in @usc.edu.co the visit is stored and the site lets the person in.
--
-- View or export the data: Table Editor -> visitors (or visit_logs) -> Export -> CSV.
-- The CSV opens directly in Excel or Google Sheets.

-- ---------------------------------------------------------------------------
-- 0. Clean up the earlier email-code (Supabase Auth) version, if present
-- ---------------------------------------------------------------------------

drop trigger if exists enforce_institutional_email on auth.users;
drop trigger if exists on_auth_user_created_visitor on auth.users;
drop function if exists public.enforce_institutional_email();
drop function if exists public.handle_new_visitor();
drop function if exists public.record_access(text, text);

-- ---------------------------------------------------------------------------
-- 1. Validation helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_institutional_email(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- Exactly one "@", a non-empty local part and the exact domain usc.edu.co.
  select coalesce(lower(btrim(p_email, E' \t\n\r')) ~ '^[a-z0-9._%+-]+@usc\.edu\.co$', false);
$$;

-- ---------------------------------------------------------------------------
-- 2. Registry tables
-- ---------------------------------------------------------------------------

create table if not exists public.visitors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null
    check (char_length(trim(full_name)) between 3 and 120),
  email text not null unique,
  first_access_at timestamptz not null default now(),
  last_access_at timestamptz not null default now(),
  access_count integer not null default 0
);

-- Upgrade path from the auth-based version: visitors are no longer auth users.
alter table public.visitors drop constraint if exists visitors_id_fkey;
alter table public.visitors alter column id set default gen_random_uuid();

comment on table public.visitors is
  'One row per person (full name + @usc.edu.co email) who entered the repository.';

create table if not exists public.visit_logs (
  id bigint generated always as identity primary key,
  visitor_id uuid not null references public.visitors (id) on delete cascade,
  accessed_at timestamptz not null default now(),
  user_agent text
);

comment on table public.visit_logs is 'One row per entry to the repository.';

create index if not exists visit_logs_visitor_id_idx on public.visit_logs (visitor_id);
create index if not exists visit_logs_accessed_at_idx on public.visit_logs (accessed_at desc);

-- ---------------------------------------------------------------------------
-- 3. Register a visit (the only way to write; called by the site's server)
-- ---------------------------------------------------------------------------

create or replace function public.register_visit(
  p_full_name text,
  p_email text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_full_name, ''), E' \t\n\r'), '\s+', ' ', 'g');
  v_email text := lower(btrim(coalesce(p_email, ''), E' \t\n\r'));
  v_id uuid;
begin
  if not public.is_institutional_email(v_email) then
    raise exception 'Solo se permiten correos @usc.edu.co'
      using errcode = 'check_violation';
  end if;

  if char_length(v_name) < 3 or char_length(v_name) > 120 or position(' ' in v_name) = 0 then
    raise exception 'Nombre completo no valido'
      using errcode = 'check_violation';
  end if;

  insert into public.visitors (full_name, email, access_count)
  values (v_name, v_email, 1)
  on conflict (email) do update
    set full_name = excluded.full_name,
        last_access_at = now(),
        access_count = public.visitors.access_count + 1
  returning id into v_id;

  insert into public.visit_logs (visitor_id, user_agent)
  values (v_id, left(p_user_agent, 500));

  return v_id;
end;
$$;

revoke all on function public.register_visit(text, text, text) from public;
grant execute on function public.register_visit(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security: nobody reads or writes the tables through the API
-- ---------------------------------------------------------------------------

alter table public.visitors enable row level security;
alter table public.visit_logs enable row level security;

revoke all on public.visitors from anon, authenticated;
revoke all on public.visit_logs from anon, authenticated;

drop policy if exists "Visitors read own row" on public.visitors;

-- No client policies: rows are written only by register_visit() and read by
-- administrators from the dashboard.
