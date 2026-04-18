-- Run this in the Supabase SQL editor

-- Reference projects table
create table if not exists reference_projects (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  category text not null check (category in ('garasje-carport', 'hagestue-bod', 'verksted', 'pergola', 'hytte-anneks')),
  description text default '',
  images jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  created_by text not null
);

-- Enable Row Level Security
alter table reference_projects enable row level security;

-- Anyone can read projects (public gallery)
create policy "Public read reference_projects" on reference_projects
  for select using (true);

-- Only allowed admins can insert
create policy "Admins insert reference_projects" on reference_projects
  for insert with check (
    auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no')
  );

-- Only allowed admins can delete
create policy "Admins delete reference_projects" on reference_projects
  for delete using (
    auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no')
  );

-- Storage bucket for project images (public)
insert into storage.buckets (id, name, public)
  values ('reference-images', 'reference-images', true)
  on conflict (id) do nothing;

-- Public read on storage objects
create policy "Public read reference images" on storage.objects
  for select using (bucket_id = 'reference-images');

-- Admins can upload images
create policy "Admins upload reference images" on storage.objects
  for insert with check (
    bucket_id = 'reference-images' and
    auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no')
  );

-- Admins can delete images
create policy "Admins delete reference images" on storage.objects
  for delete using (
    bucket_id = 'reference-images' and
    auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no')
  );
