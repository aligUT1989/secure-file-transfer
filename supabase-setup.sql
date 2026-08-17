-- ============================================================
--  Secure File Transfer — Supabase setup
--  Run this ONCE in your Supabase project:
--  Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- ============================================================

-- 1) Create a PRIVATE storage bucket called "files".
--    (private = nobody can read it without being logged in and
--     without a signed URL that the app generates for you)
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;

-- 2) Row-level security policies on storage objects.
--    Every file is stored under a folder named after the user's
--    id, e.g.  <user-id>/vacation.jpg
--    These policies make sure a logged-in user can ONLY read,
--    upload, or delete files inside their own <user-id>/ folder.
--    No one can see anyone else's files.

-- Allow users to LIST/READ only their own files
create policy "Users read own files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to UPLOAD only into their own folder
create policy "Users upload own files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to UPDATE (overwrite) only their own files
create policy "Users update own files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to DELETE only their own files
create policy "Users delete own files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Done. Your storage is now locked down per-user.
