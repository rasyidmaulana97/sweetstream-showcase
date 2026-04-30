-- MEDIA table
create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  original_name text not null,
  file_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  kind text not null check (kind in ('video','image')),
  expires_at timestamptz,
  max_views integer,
  view_count integer not null default 0,
  is_disabled boolean not null default false,
  created_at timestamptz not null default now()
);

create index media_owner_id_idx on public.media(owner_id);
create index media_slug_idx on public.media(slug);

alter table public.media enable row level security;

-- Public can read media that is still active (used for share page lookup)
create policy "Public can read active media by slug"
on public.media for select
to anon, authenticated
using (
  is_disabled = false
  and (expires_at is null or expires_at > now())
  and (max_views is null or view_count < max_views)
);

-- Owners can do anything with their own media
create policy "Owners can read own media"
on public.media for select
to authenticated
using (auth.uid() = owner_id);

create policy "Owners can insert own media"
on public.media for insert
to authenticated
with check (auth.uid() = owner_id);

create policy "Owners can update own media"
on public.media for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Owners can delete own media"
on public.media for delete
to authenticated
using (auth.uid() = owner_id);

-- REPORTS table
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz not null default now()
);

create index reports_media_id_idx on public.reports(media_id);

alter table public.reports enable row level security;

-- Anyone can submit a report
create policy "Anyone can insert a report"
on public.reports for insert
to anon, authenticated
with check (true);

-- Owners of the reported media can read reports about their media
create policy "Owners can read reports on own media"
on public.reports for select
to authenticated
using (
  exists (
    select 1 from public.media m
    where m.id = reports.media_id and m.owner_id = auth.uid()
  )
);

-- Increment view function (security definer to bump count past RLS)
create or replace function public.increment_media_view(p_slug text)
returns void
language plpgsql
security definer
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

-- STORAGE bucket (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media-files',
  'media-files',
  false,
  104857600, -- 100 MB
  array[
    'video/mp4','video/quicktime','video/webm','video/x-matroska',
    'image/jpeg','image/png','image/webp','image/gif'
  ]
);

-- Storage RLS: users can manage files in a folder named with their user id
create policy "Users can upload to own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'media-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can read own files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'media-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'media-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);