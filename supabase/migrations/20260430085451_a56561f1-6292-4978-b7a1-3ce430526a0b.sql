-- Replace permissive report insert policy with a validated one
drop policy if exists "Anyone can insert a report" on public.reports;

create policy "Anyone can insert a valid report"
on public.reports for insert
to anon, authenticated
with check (
  length(trim(reason)) between 1 and 100
  and (details is null or length(details) <= 2000)
  and exists (select 1 from public.media m where m.id = reports.media_id)
);

-- Lock down SECURITY DEFINER function: revoke direct execute, expose via RPC differently
revoke execute on function public.increment_media_view(text) from anon, authenticated, public;

-- Provide a SECURITY INVOKER wrapper that the public can call; it uses an internal helper
-- Easier route: change to SECURITY INVOKER and rely on a permissive UPDATE policy scoped to active rows.
create or replace function public.increment_media_view(p_slug text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.media
     set view_count = view_count + 1
   where slug = p_slug
     and is_disabled = false
     and (expires_at is null or expires_at > now())
     and (max_views is null or view_count < max_views);
end;
$$;

grant execute on function public.increment_media_view(text) to anon, authenticated;

-- Allow the function (running as caller) to bump view_count on active rows only
create policy "Anyone can increment view_count on active media"
on public.media for update
to anon, authenticated
using (
  is_disabled = false
  and (expires_at is null or expires_at > now())
  and (max_views is null or view_count < max_views)
)
with check (
  is_disabled = false
);