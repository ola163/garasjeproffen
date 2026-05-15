-- Activity log for admin actions (comments, DIBK edits, lead source changes)
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,   -- 'quote' | 'soknadshjelp'
  entity_id uuid not null,
  action_type text not null,   -- 'comment' | 'dibk_edit' | 'lead_source_change'
  actor_email text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table activity_log enable row level security;

create policy "authenticated read activity_log"
  on activity_log for select
  to authenticated
  using (true);

create policy "authenticated insert activity_log"
  on activity_log for insert
  to authenticated
  with check (true);

create index if not exists activity_log_entity_idx
  on activity_log (entity_id, created_at desc);

-- Lead source columns
alter table quotes add column if not exists lead_source text;
alter table soknadshjelp add column if not exists lead_source text;
