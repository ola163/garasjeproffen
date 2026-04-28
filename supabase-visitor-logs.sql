-- Run this in the Supabase SQL editor

create table visitor_logs (
  id uuid default gen_random_uuid() primary key,
  ip text not null,
  path text,
  user_agent text,
  visited_at timestamptz default now()
);

-- Index for fast unique IP queries
create index visitor_logs_ip_idx on visitor_logs (ip);
create index visitor_logs_visited_at_idx on visitor_logs (visited_at desc);

-- Lock down table — only service role key can access it
alter table visitor_logs enable row level security;
