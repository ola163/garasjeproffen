-- Søknadshjelp requests table
create table if not exists soknadshjelp (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  address text,
  dibk jsonb,
  garage_config jsonb,
  permit_result text,
  permit_price numeric,
  total_price numeric,
  status text not null default 'new',
  assigned_to text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists soknadshjelp_created_at_idx on soknadshjelp(created_at desc);
create index if not exists soknadshjelp_status_idx on soknadshjelp(status);

alter table soknadshjelp enable row level security;

create policy "service_role_all" on soknadshjelp
  for all to service_role
  using (true) with check (true);

create policy "admin_read" on soknadshjelp
  for select to authenticated
  using (true);

create policy "admin_update" on soknadshjelp
  for update to authenticated
  using (true) with check (true);
