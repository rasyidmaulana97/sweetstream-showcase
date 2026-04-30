create policy "Public read of storage objects backing active media"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'media-files'
  and exists (
    select 1 from public.media m
    where m.file_path = storage.objects.name
      and m.is_disabled = false
      and (m.expires_at is null or m.expires_at > now())
      and (m.max_views is null or m.view_count < m.max_views)
  )
);