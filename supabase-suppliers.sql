-- Kjør i Supabase SQL-editor

create table if not exists suppliers (
  id         uuid default gen_random_uuid() primary key,
  name       text not null unique,
  created_at timestamptz default now()
);

alter table suppliers enable row level security;

-- Fyll inn eksisterende leverandører
insert into suppliers (name) values
  ('Optimera'),
  ('XLBygg'),
  ('Coop Obs Bygg'),
  ('Neumann')
on conflict (name) do nothing;
