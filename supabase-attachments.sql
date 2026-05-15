-- Storage bucket for soknadshjelp attachments
insert into storage.buckets (id, name, public)
values ('soknadshjelp-attachments', 'soknadshjelp-attachments', false)
on conflict (id) do nothing;

-- Admins can read (download) files
drop policy if exists "Admins read soknadshjelp attachments" on storage.objects;
create policy "Admins read soknadshjelp attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'soknadshjelp-attachments'
    and auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no')
  );

-- Admins can upload files
drop policy if exists "Admins insert soknadshjelp attachments" on storage.objects;
create policy "Admins insert soknadshjelp attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'soknadshjelp-attachments'
    and auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no')
  );

-- Admins can delete files
drop policy if exists "Admins delete soknadshjelp attachments" on storage.objects;
create policy "Admins delete soknadshjelp attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'soknadshjelp-attachments'
    and auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no')
  );
