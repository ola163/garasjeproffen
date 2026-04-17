-- Run this in the Supabase SQL editor after creating your project

create table saved_configs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Mitt garasjedesign',
  config jsonb not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table saved_configs enable row level security;

-- Users can only access their own configs
create policy "Users manage own configs" on saved_configs
  for all using (auth.uid() = user_id);
