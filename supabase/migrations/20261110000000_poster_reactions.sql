-- Poster reactions for the Fisioterapia USC poster repository.
--
-- Run once in Supabase Dashboard -> SQL Editor, after the open access registry
-- migration. Safe to re-run.
--
-- Model: each visitor (public.visitors.id, the value of the site's access cookie)
-- keeps at most one reaction per poster. A poster is identified by "eje-N/<slug>"
-- because a slug is only unique inside its axis.
--
-- Clients never touch the table: the site's server calls set_poster_reaction() and
-- get_poster_reactions() with the publishable key.
--
-- View or export the totals: Table Editor -> Views -> poster_reaction_summary
-- (or SQL: select * from poster_reaction_summary) -> Export -> CSV.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

create table if not exists public.poster_reactions (
  visitor_id uuid not null references public.visitors (id) on delete cascade,
  poster_key text not null
    check (poster_key ~ '^eje-[0-9]+/[a-z0-9-]+$'),
  reaction text not null
    check (reaction in ('love', 'clap', 'insight', 'inspire')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (visitor_id, poster_key)
);

comment on table public.poster_reactions is
  'One reaction per visitor and poster (love, clap, insight or inspire).';

create index if not exists poster_reactions_poster_key_idx
  on public.poster_reactions (poster_key);

alter table public.poster_reactions enable row level security;
revoke all on public.poster_reactions from anon, authenticated;

-- No client policies: rows are written only by set_poster_reaction().

-- ---------------------------------------------------------------------------
-- 2. Set or clear a reaction
-- ---------------------------------------------------------------------------

create or replace function public.set_poster_reaction(
  p_visitor_id uuid,
  p_poster_key text,
  p_reaction text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counts jsonb;
begin
  if p_poster_key is null or p_poster_key !~ '^eje-[0-9]+/[a-z0-9-]+$' then
    raise exception 'Poster no valido'
      using errcode = 'check_violation';
  end if;

  if p_reaction is not null and p_reaction not in ('love', 'clap', 'insight', 'inspire') then
    raise exception 'Reaccion no valida'
      using errcode = 'check_violation';
  end if;

  if p_visitor_id is null
     or not exists (select 1 from public.visitors where id = p_visitor_id) then
    raise exception 'Visitante no valido'
      using errcode = 'check_violation';
  end if;

  if p_reaction is null then
    delete from public.poster_reactions
    where visitor_id = p_visitor_id and poster_key = p_poster_key;
  else
    insert into public.poster_reactions (visitor_id, poster_key, reaction)
    values (p_visitor_id, p_poster_key, p_reaction)
    on conflict (visitor_id, poster_key) do update
      set reaction = excluded.reaction,
          updated_at = now();
  end if;

  select jsonb_build_object(
    'love', count(*) filter (where reaction = 'love'),
    'clap', count(*) filter (where reaction = 'clap'),
    'insight', count(*) filter (where reaction = 'insight'),
    'inspire', count(*) filter (where reaction = 'inspire')
  )
  into v_counts
  from public.poster_reactions
  where poster_key = p_poster_key;

  return v_counts;
end;
$$;

revoke all on function public.set_poster_reaction(uuid, text, text) from public;
grant execute on function public.set_poster_reaction(uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Read totals per poster plus the visitor's own reactions
-- ---------------------------------------------------------------------------

create or replace function public.get_poster_reactions(p_visitor_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'counts', coalesce((
      select jsonb_object_agg(t.poster_key, t.counts)
      from (
        select
          poster_key,
          jsonb_build_object(
            'love', count(*) filter (where reaction = 'love'),
            'clap', count(*) filter (where reaction = 'clap'),
            'insight', count(*) filter (where reaction = 'insight'),
            'inspire', count(*) filter (where reaction = 'inspire')
          ) as counts
        from public.poster_reactions
        group by poster_key
      ) as t
    ), '{}'::jsonb),
    'mine', coalesce((
      select jsonb_object_agg(r.poster_key, r.reaction)
      from public.poster_reactions as r
      where p_visitor_id is not null and r.visitor_id = p_visitor_id
    ), '{}'::jsonb)
  );
$$;

revoke all on function public.get_poster_reactions(uuid) from public;
grant execute on function public.get_poster_reactions(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Admin summary (dashboard only; not readable through the API)
-- ---------------------------------------------------------------------------

create or replace view public.poster_reaction_summary as
  select
    poster_key,
    count(*) filter (where reaction = 'love') as love,
    count(*) filter (where reaction = 'clap') as clap,
    count(*) filter (where reaction = 'insight') as insight,
    count(*) filter (where reaction = 'inspire') as inspire,
    count(*) as total
  from public.poster_reactions
  group by poster_key
  order by total desc, poster_key;

comment on view public.poster_reaction_summary is
  'Reaction totals per poster, for administrators. Export to CSV from the dashboard.';

revoke all on public.poster_reaction_summary from anon, authenticated;
