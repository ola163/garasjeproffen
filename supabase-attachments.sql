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

-- Metadata table for attachments (label per file)
create table if not exists soknadshjelp_attachments (
  id uuid primary key default gen_random_uuid(),
  soknadshjelp_id uuid not null,
  file_path text not null,
  label text not null,
  uploaded_by text not null,
  created_at timestamptz not null default now()
);

alter table soknadshjelp_attachments enable row level security;

drop policy if exists "Admins read soknadshjelp_attachments" on soknadshjelp_attachments;
create policy "Admins read soknadshjelp_attachments"
  on soknadshjelp_attachments for select
  to authenticated
  using (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'));

drop policy if exists "Admins insert soknadshjelp_attachments" on soknadshjelp_attachments;
create policy "Admins insert soknadshjelp_attachments"
  on soknadshjelp_attachments for insert
  to authenticated
  with check (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'));

drop policy if exists "Admins update soknadshjelp_attachments" on soknadshjelp_attachments;
create policy "Admins update soknadshjelp_attachments"
  on soknadshjelp_attachments for update
  to authenticated
  using (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'));

drop policy if exists "Admins delete soknadshjelp_attachments" on soknadshjelp_attachments;
create policy "Admins delete soknadshjelp_attachments"
  on soknadshjelp_attachments for delete
  to authenticated
  using (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'));
