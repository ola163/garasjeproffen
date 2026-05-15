-- Lead sources table (admin-managed list)
create table if not exists lead_sources (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  value text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table lead_sources enable row level security;

drop policy if exists "Admins manage lead_sources" on lead_sources;
create policy "Admins manage lead_sources"
  on lead_sources for all
  to authenticated
  using (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'))
  with check (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'));

-- Allow anon to read (needed for public-facing forms if ever used)
drop policy if exists "Public read lead_sources" on lead_sources;
create policy "Public read lead_sources"
  on lead_sources for select
  to anon, authenticated
  using (true);

-- Seed default sources
insert into lead_sources (label, value, sort_order) values
  ('Messe/stand', 'messe_stand', 1),
  ('ChatGPT', 'chatgpt', 2),
  ('Google', 'google', 3),
  ('Andre søkemotorer', 'andre_soekemotorer', 4),
  ('Annet', 'annet', 5)
on conflict (value) do nothing;
