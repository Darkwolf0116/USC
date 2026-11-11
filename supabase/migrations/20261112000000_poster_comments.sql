-- Poster comments for the Fisioterapia USC poster repository.
--
-- Run once in Supabase Dashboard -> SQL Editor, after 20261111000000_reactions_visitor_flag.sql.
-- Safe to re-run.
--
-- Model: a visitor (public.visitors.id, the value of the site's access cookie) can write
-- comments on a poster ("eje-N/<slug>"). Each comment is shown with the visitor's full name;
-- the e-mail address is never returned to the site.
--
-- Clients never touch the table: the site's server calls add_poster_comment() and
-- get_poster_comments() with the publishable key.
--
-- Moderate or export: Table Editor -> poster_comments (delete a row to remove a comment), or
-- Views -> poster_comment_export (author, e-mail, text, date) -> Export -> CSV.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

create table if not exists public.poster_comments (
  id bigint generated always as identity primary key,
  poster_key text not null
    check (poster_key ~ '^eje-[0-9]+/[a-z0-9-]+$'),
  visitor_id uuid not null references public.visitors (id) on delete cascade,
  body text not null
    check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

comment on table public.poster_comments is
  'Comments written by visitors on a poster. Delete a row to moderate.';

create index if not exists poster_comments_poster_created_idx
  on public.poster_comments (poster_key, created_at desc);

create index if not exists poster_comments_visitor_created_idx
  on public.poster_comments (visitor_id, created_at desc);

alter table public.poster_comments enable row level security;
revoke all on public.poster_comments from anon, authenticated;

-- No client policies: rows are written only by add_poster_comment().

-- ---------------------------------------------------------------------------
-- 2. Add a comment
-- ---------------------------------------------------------------------------
-- Errors (the site maps them to HTTP statuses):
--   check_violation (23514)  invalid poster, text or visitor ("Visitante no valido")
--   P0429                    anti-spam: the visitor commented less than 15 seconds ago

create or replace function public.add_poster_comment(
  p_visitor_id uuid,
  p_poster_key text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_author text;
  v_row public.poster_comments;
begin
  if p_poster_key is null or p_poster_key !~ '^eje-[0-9]+/[a-z0-9-]+$' then
    raise exception 'Poster no valido'
      using errcode = 'check_violation';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 500 then
    raise exception 'Comentario no valido'
      using errcode = 'check_violation';
  end if;

  select full_name into v_author
  from public.visitors
  where id = p_visitor_id;

  if p_visitor_id is null or not found then
    raise exception 'Visitante no valido'
      using errcode = 'check_violation';
  end if;

  -- Serialize one visitor's comments so two simultaneous requests cannot skip the limit.
  perform pg_advisory_xact_lock(hashtextextended(p_visitor_id::text, 0));

  if exists (
    select 1
    from public.poster_comments
    where visitor_id = p_visitor_id
      and created_at > now() - interval '15 seconds'
  ) then
    raise exception 'Espera unos segundos antes de volver a comentar'
      using errcode = 'P0429';
  end if;

  insert into public.poster_comments (poster_key, visitor_id, body)
  values (p_poster_key, p_visitor_id, v_body)
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'body', v_row.body,
    'created_at', v_row.created_at,
    'author', v_author
  );
end;
$$;

revoke all on function public.add_poster_comment(uuid, text, text) from public;
grant execute on function public.add_poster_comment(uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. List the comments of a poster (newest first, at most 200; never the e-mail)
-- ---------------------------------------------------------------------------

create or replace function public.get_poster_comments(p_poster_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_poster_key is null or p_poster_key !~ '^eje-[0-9]+/[a-z0-9-]+$' then
    raise exception 'Poster no valido'
      using errcode = 'check_violation';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'body', t.body,
        'created_at', t.created_at,
        'author', t.author
      )
      order by t.created_at desc, t.id desc
    )
    from (
      select c.id, c.body, c.created_at, v.full_name as author
      from public.poster_comments as c
      join public.visitors as v on v.id = c.visitor_id
      where c.poster_key = p_poster_key
      order by c.created_at desc, c.id desc
      limit 200
    ) as t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_poster_comments(text) from public;
grant execute on function public.get_poster_comments(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Totals: get_poster_reactions() keeps its signature and gains "comments"
-- ---------------------------------------------------------------------------
-- "comments" maps each poster key with comments to its number of comments.

create or replace function public.get_poster_reactions(p_visitor_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'visitor', p_visitor_id is not null
      and exists (select 1 from public.visitors as v where v.id = p_visitor_id),
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
    ), '{}'::jsonb),
    'comments', coalesce((
      select jsonb_object_agg(c.poster_key, c.total)
      from (
        select poster_key, count(*) as total
        from public.poster_comments
        group by poster_key
      ) as c
    ), '{}'::jsonb)
  );
$$;

revoke all on function public.get_poster_reactions(uuid) from public;
grant execute on function public.get_poster_reactions(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Admin export (dashboard only; not readable through the API)
-- ---------------------------------------------------------------------------

create or replace view public.poster_comment_export as
  select
    c.poster_key,
    v.full_name as author,
    v.email,
    c.body as comment,
    c.created_at
  from public.poster_comments as c
  join public.visitors as v on v.id = c.visitor_id
  order by c.created_at desc;

alter view public.poster_comment_export set (security_invoker = true);

comment on view public.poster_comment_export is
  'Poster comments with author and e-mail, for administrators. Export to CSV from the dashboard.';

revoke all on public.poster_comment_export from anon, authenticated;
