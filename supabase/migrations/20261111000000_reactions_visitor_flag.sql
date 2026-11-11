-- Reactions: tell the site whether the visitor behind the access cookie still exists.
--
-- Run once in Supabase Dashboard -> SQL Editor, after 20261110000000_poster_reactions.sql.
-- Safe to re-run.
--
-- get_poster_reactions() keeps its signature and grants and gains a "visitor" boolean in the
-- returned JSON: true when p_visitor_id is a registered visitor, false when it is null or unknown.
-- The site uses it to detect a stale access cookie on page load and ask the person to sign in again.

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
    ), '{}'::jsonb)
  );
$$;

revoke all on function public.get_poster_reactions(uuid) from public;
grant execute on function public.get_poster_reactions(uuid) to anon, authenticated;

-- The admin summary view should run with the caller's rights, so it cannot expose
-- poster_reactions through the view owner's privileges.
alter view public.poster_reaction_summary set (security_invoker = true);
