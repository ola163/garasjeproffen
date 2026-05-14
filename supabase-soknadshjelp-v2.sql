alter table soknadshjelp
  add column if not exists extra_costs jsonb default '[]'::jsonb,
  add column if not exists manual_dispensasjoner jsonb default '[]'::jsonb;
